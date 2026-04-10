# What's Everyone Talking About — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a members-only, search-first interface that answers natural-language questions about CPO Connect WhatsApp chats with cited sources.

**Architecture:** Postgres + pgvector stores embedded chat messages. A monthly local script parses WhatsApp exports, embeds via Gemini (batch API), and POSTs to an authenticated admin ingest endpoint. At query time, the Node/Express server embeds the query via Gemini, runs a cosine-similarity search, and uses Claude Sonnet 4.5 to synthesize an answer with inline citations. The React members area gets a new hero page for asking questions, plus a profile toggle for name opt-out and an admin page for ingestion history.

**Tech Stack:** Node.js/Express 5, TypeScript, raw `pg` client, pgvector, `@anthropic-ai/sdk`, `@google/genai`, React 19, react-router-dom 7, @tanstack/react-query, Tailwind + shadcn UI, Vitest.

---

## Design decisions locked in from the spec update

These were ambiguities in the original spec that are now resolved by the
codex review feedback folded into
`docs/specs/2026-04-10-whats-everyone-talking-about.md`. They are listed
here so the executor doesn't have to re-derive them from the spec diff.

1. **`member_profiles` primary key is `email` (TEXT), not UUID.** WETA
   tables use `author_email TEXT` (nullable, no hard FK — phone-number-only
   senders from WhatsApp exports won't match any profile) and
   `triggered_by_email TEXT` instead of the UUID fields in the original draft.
2. **Reference HTML archive** (`/reference/chat-analysis-*.html`) is
   served via an auth-gated Express static mount in `server.ts`. See
   Task 12.
3. **Evergreen prompt tiles** — 4 tiles seeded via migration 009 (see
   Task 2). Erik can edit via SQL or a future admin UI.
4. **`req.user.id` is a session UUID**, not a profile identifier. The
   plan uses `req.user.email` everywhere a profile identifier is needed.
5. **Phone-number senders** stored verbatim with `author_email = NULL`.
   `authorReconciliation.matchAuthor` returns `null` for any name that
   starts with `+` (see Task 6).
6. **Migration idempotency** — every DDL uses `IF NOT EXISTS` because
   `server/db.ts:runMigrations` replays every `.sql` file on every boot.
7. **Dual auth on `POST /api/admin/chat/ingest`** — either an admin
   session cookie (cookie path) or a valid `X-Ingest-Key` header matching
   `INGEST_API_KEY` via `crypto.timingSafeEqual` (headless path). The
   ingest-whatsapp.ts script uses the header path. The
   `requireIngestAuth` middleware (introduced in Task 10) handles both
   paths in one place.
8. **Per-route body limit** — `POST /api/admin/chat/ingest` mounts its own
   `express.json({ limit: '50mb' })`. The global body limit stays at the
   default ~100KB. A single month of ingestion runs 5–15MB.
9. **Per-member rate limit on `POST /api/chat/ask`** — 10/min and 100/hr
   keyed on `req.user.email`, using the existing `createRateLimiter`
   helper. 429 returns `{error: 'rate_limited', retryAfterSec}` with a
   standard `Retry-After` header.
10. **Privacy: two independent opt-outs.** `chat_identification_opted_out`
    hides the member's name on source cards. `chat_query_logging_opted_out`
    redacts the member's questions in the `events` table (logs char count
    + channel filter only, no text). Both default to opted in. Profile
    page has two toggles; chat page shows a one-line disclosure.
11. **Failure modes on `POST /api/chat/ask`** are mapped to specific
    status codes (see Task 9 — formerly Task 8). No happy-path-only
    implementations.
12. **Frontend file paths corrected** — router is in `src/App.tsx` (not
    `src/pages/App.tsx`); nav links live in `src/components/Navbar.tsx`
    (not `src/components/members/MembersLayout.tsx`).
13. **`src/constants/chatChannels.ts`** is scoped to WETA-searchable
    channels only. The marketing-page `ChannelsSection.tsx` stays
    untouched for Phase 1.

---

## File map

**New backend files:**
- `server/migrations/009-chat-tables.sql` — four new tables, indexes, evergreen tile seed (all DDL idempotent)
- `server/migrations/010-profile-chat-opt-out.sql` — **two** new columns on `member_profiles` (identification + query-logging opt-outs)
- `server/services/chatEmbedding.ts` — Gemini query embedding wrapper
- `server/services/chatSynthesis.ts` — Claude synthesis wrapper (20s timeout)
- `server/services/authorReconciliation.ts` — fuzzy match WhatsApp names to profiles
- `server/middleware/requireAdmin.ts` — admin email check middleware (cookie path)
- `server/middleware/requireIngestAuth.ts` — dual auth (cookie OR `X-Ingest-Key` header via `timingSafeEqual`)
- `server/routes/chat.ts` — all four chat endpoints, per-route body limit on ingest
- `src/test/chatEmbedding.test.ts`
- `src/test/chatSynthesis.test.ts`
- `src/test/authorReconciliation.test.ts`
- `src/test/requireAdmin.test.ts`
- `src/test/requireIngestAuth.test.ts`

**Modified backend files:**
- `server.ts` — mount chat router, mount `/reference` static under auth
- `server/services/analytics.ts` — add `CHAT_QUERY` event name

**New local script files:**
- `scripts/ingest-whatsapp.ts` — the monthly ingestion CLI
- `scripts/lib/whatsapp-parser.ts` — parse WhatsApp `_chat.txt` exports
- `scripts/lib/gemini-batch-embed.ts` — Gemini batch API wrapper
- `src/test/whatsapp-parser.test.ts`

**New frontend files:**
- `src/constants/chatChannels.ts` — the single channel source of truth
- `src/hooks/useChatApi.ts` — React Query hooks for all chat endpoints
- `src/pages/members/WhatsTalked.tsx`
- `src/components/members/whats-talked/WhatsTalkedHero.tsx`
- `src/components/members/whats-talked/ChannelTabs.tsx`
- `src/components/members/whats-talked/PromptTile.tsx`
- `src/components/members/whats-talked/AskForm.tsx`
- `src/components/members/whats-talked/AnswerPanel.tsx`
- `src/components/members/whats-talked/SourceCard.tsx`
- `src/components/members/whats-talked/EmptyState.tsx`
- `src/pages/members/MonthlySummaries.tsx` — new, replaces ChatInsights composition
- `src/pages/members/admin/ChatIngestionHistory.tsx`
- `src/components/members/admin/IngestionRunCard.tsx`

**Modified frontend files:**
- `src/App.tsx` — new route, default redirect, rename old route
- `src/components/Navbar.tsx` — rename + add link
- `src/pages/members/Profile.tsx` — opt-out toggle

**Deleted files:**
- `src/pages/members/ChatInsights.tsx` — replaced by `MonthlySummaries.tsx` (or kept as a thin re-export, per Task 28)

**Deployment / ops:**
- Render env vars: `ANTHROPIC_API_KEY`, `ADMIN_EMAILS`, `INGEST_API_KEY` (`GEMINI_API_KEY` already set per Erik)
- Local gitignored file: `.env.ingest` — holds `INGEST_API_KEY` for the ingest script (copy of the Render value)

---

## Phase A — Dependencies & schema

### Task 1: Add the `@google/genai` npm dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `@google/genai`**

Run:
```bash
cd "/Users/eschwaa/Projects/CPO Connect/cpo-connect-hub"
npm install @google/genai
```

Expected: `package.json` and `package-lock.json` updated, `node_modules/@google/genai` exists.

- [ ] **Step 2: Verify the install**

Run:
```bash
node -e "console.log(require('@google/genai/package.json').version)"
```

Expected: prints a version number (e.g. `0.8.0` or similar).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(weta): add @google/genai dependency"
```

---

### Task 2: Migration 009 — chat tables + evergreen tile seed

**Files:**
- Create: `server/migrations/009-chat-tables.sql`

- [ ] **Step 1: Write the migration SQL**

Create `server/migrations/009-chat-tables.sql` with:

```sql
-- pgvector is already enabled on the shared Postgres instance (v0.8.1).
-- This migration is a no-op on the extension but declares the dependency explicitly.
CREATE EXTENSION IF NOT EXISTS vector;

-- -- chat_messages -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  source_export TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at
  ON cpo_connect.chat_messages (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel
  ON cpo_connect.chat_messages (channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding
  ON cpo_connect.chat_messages USING hnsw (embedding vector_cosine_ops);

-- -- chat_conversations (Phase 1 schema, populated in Phase 2) --------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_conversations (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  message_count INT NOT NULL,
  summary TEXT,
  topics TEXT[],
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_start
  ON cpo_connect.chat_conversations (start_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_embedding
  ON cpo_connect.chat_conversations USING hnsw (embedding vector_cosine_ops);

-- -- chat_ingestion_runs ----------------------------------------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  run_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_completed_at TIMESTAMPTZ,
  triggered_by_email TEXT,
  source_months TEXT[],
  messages_ingested INT DEFAULT 0,
  messages_skipped INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_ingestion_runs_started
  ON cpo_connect.chat_ingestion_runs (run_started_at DESC);

-- -- chat_prompt_tiles ------------------------------------------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_prompt_tiles (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  channel TEXT,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed evergreen tiles (idempotent: skip if any evergreen row already exists)
INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'AI tooling debates', 'What have people said about AI coding tools?', 1
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen');

INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'Hiring & the CV crisis', 'What are people saying about the hiring market?', 2
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'Hiring & the CV crisis');

INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'Burnout & sustainable work', 'What have members shared about burnout and sustainable pace?', 3
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'Burnout & sustainable work');

INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'PM tool recommendations', 'What product management tools do members recommend?', 4
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'PM tool recommendations');
```

- [ ] **Step 2: Run the migration locally**

Run:
```bash
cd "/Users/eschwaa/Projects/CPO Connect/cpo-connect-hub"
npm run dev:server
# wait for "Migrations complete" log, then Ctrl+C
```

Expected: server starts, logs `Migrations complete`, no SQL errors.

- [ ] **Step 3: Verify the tables exist**

Run:
```bash
psql "$DATABASE_URL" -c "\dt cpo_connect.chat_*"
```

Expected: lists `chat_messages`, `chat_conversations`, `chat_ingestion_runs`, `chat_prompt_tiles`.

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen'"
```

Expected: `4`.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/009-chat-tables.sql
git commit -m "feat(weta): add chat tables migration with pgvector indexes and evergreen tile seed"
```

---

### Task 3: Migration 010 — profile opt-out columns

**Files:**
- Create: `server/migrations/010-profile-chat-opt-out.sql`

Two separate columns: one for hiding the member's name on source cards
(`chat_identification_opted_out`), one for redacting the member's raw
question text in the events table (`chat_query_logging_opted_out`). Both
default to `false` (opted in).

- [ ] **Step 1: Write the migration SQL**

Create `server/migrations/010-profile-chat-opt-out.sql` with:

```sql
ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS chat_identification_opted_out BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS chat_query_logging_opted_out BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
npm run dev:server
# wait for "Migrations complete", Ctrl+C
```

Expected: no errors.

- [ ] **Step 3: Verify the columns**

Run:
```bash
psql "$DATABASE_URL" -c "\d cpo_connect.member_profiles" | grep chat_
```

Expected: two lines:
- `chat_identification_opted_out | boolean | not null default false`
- `chat_query_logging_opted_out | boolean | not null default false`

- [ ] **Step 4: Commit**

```bash
git add server/migrations/010-profile-chat-opt-out.sql
git commit -m "feat(weta): add chat identification + query logging opt-out columns"
```

---

## Phase B — Backend services (TDD)

### Task 4: `chatEmbedding.ts` — Gemini query embedding wrapper

**Files:**
- Create: `server/services/chatEmbedding.ts`
- Test: `src/test/chatEmbedding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/chatEmbedding.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @google/genai before importing the module under test
const embedContentMock = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: embedContentMock,
    },
  })),
}))

describe('chatEmbedding', () => {
  beforeEach(() => {
    embedContentMock.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('embeds a query and returns a 768-dimensional vector', async () => {
    embedContentMock.mockResolvedValueOnce({
      embeddings: [{ values: new Array(768).fill(0.1) }],
    })

    const { embedQuery } = await import('../../server/services/chatEmbedding')
    const vec = await embedQuery('What are people saying about Claude Code?')

    expect(vec).toHaveLength(768)
    expect(embedContentMock).toHaveBeenCalledTimes(1)
    const call = embedContentMock.mock.calls[0][0]
    expect(call.model).toBe('gemini-embedding-2-preview')
    expect(call.contents).toContain('Represent this search query')
  })

  it('throws a descriptive error when the API returns no embeddings', async () => {
    embedContentMock.mockResolvedValueOnce({ embeddings: [] })

    const { embedQuery } = await import('../../server/services/chatEmbedding')
    await expect(embedQuery('hello')).rejects.toThrow(/no embedding returned/i)
  })

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY
    vi.resetModules()
    const mod = await import('../../server/services/chatEmbedding')
    await expect(mod.embedQuery('hello')).rejects.toThrow(/GEMINI_API_KEY/)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```bash
npm run test -- src/test/chatEmbedding.test.ts
```

Expected: FAIL — `Cannot find module 'server/services/chatEmbedding'`.

- [ ] **Step 3: Implement `chatEmbedding.ts`**

Create `server/services/chatEmbedding.ts`:

```typescript
import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-embedding-2-preview'
const QUERY_INSTRUCTION =
  'Represent this search query for retrieving relevant community chat messages.'

/** Error class the ask endpoint maps to 503 embedding_unavailable. */
export class EmbeddingUnavailableError extends Error {
  readonly code = 'embedding_unavailable' as const
  constructor(cause: string) {
    super(`embedding_unavailable: ${cause}`)
  }
}

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

export async function embedQuery(query: string): Promise<number[]> {
  const c = getClient()
  let response
  try {
    response = await c.models.embedContent({
      model: MODEL,
      contents: `${QUERY_INSTRUCTION}\n\n${query}`,
      config: { outputDimensionality: 768 },
    })
  } catch (err) {
    throw new EmbeddingUnavailableError((err as Error).message)
  }

  const vec = response.embeddings?.[0]?.values
  if (!vec || vec.length === 0) {
    throw new EmbeddingUnavailableError('no embedding returned')
  }
  return vec
}
```

- [ ] **Step 4: Run test, verify it passes**

Run:
```bash
npm run test -- src/test/chatEmbedding.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/chatEmbedding.ts src/test/chatEmbedding.test.ts
git commit -m "feat(weta): add Gemini query embedding service with tests"
```

---

### Task 5: `chatSynthesis.ts` — Claude synthesis wrapper

**Files:**
- Create: `server/services/chatSynthesis.ts`
- Test: `src/test/chatSynthesis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/chatSynthesis.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}))

describe('chatSynthesis', () => {
  beforeEach(() => {
    createMock.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('synthesizes an answer from retrieved messages', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'People are excited about Claude Code [1].' }],
      model: 'claude-sonnet-4-5',
    })

    const { synthesizeAnswer } = await import('../../server/services/chatSynthesis')
    const result = await synthesizeAnswer({
      query: 'What about Claude Code?',
      sources: [
        {
          id: '1',
          channel: 'ai',
          authorDisplayName: 'Dave',
          sentAt: '2026-03-11T15:00:00Z',
          messageText: 'Claude Code is amazing.',
        },
      ],
    })

    expect(result.answer).toContain('Claude Code')
    expect(result.model).toBe('claude-sonnet-4-5')
    expect(createMock).toHaveBeenCalledTimes(1)
    const payload = createMock.mock.calls[0][0]
    expect(payload.model).toBe('claude-sonnet-4-5')
    expect(payload.system).toContain('community knowledge synthesizer')
    expect(payload.messages[0].content).toContain('[1]')
    expect(payload.messages[0].content).toContain('Dave')
  })

  it('throws when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    vi.resetModules()
    const mod = await import('../../server/services/chatSynthesis')
    await expect(
      mod.synthesizeAnswer({ query: 'q', sources: [] })
    ).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })

  it('returns a graceful message when no sources are provided', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: "I couldn't find anything." }],
      model: 'claude-sonnet-4-5',
    })

    const { synthesizeAnswer } = await import('../../server/services/chatSynthesis')
    const result = await synthesizeAnswer({ query: 'obscure thing', sources: [] })
    expect(result.answer).toBeTruthy()
    expect(result.model).toBe('claude-sonnet-4-5')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```bash
npm run test -- src/test/chatSynthesis.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `chatSynthesis.ts`**

Create `server/services/chatSynthesis.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5'

export interface SynthesisSource {
  id: string
  channel: string
  authorDisplayName: string
  sentAt: string
  messageText: string
}

export interface SynthesisInput {
  query: string
  sources: SynthesisSource[]
}

export interface SynthesisOutput {
  answer: string
  model: string
}

const SYSTEM_PROMPT = `You are a community knowledge synthesizer for CPO Connect, a peer network of senior product leaders. You read WhatsApp chat excerpts and write short, honest summaries of what the community has said.

Rules:
- Answer in 2-4 sentences. Be concise.
- Cite sources inline using [N] markers that map to the numbered sources provided.
- If the sources don't contain enough info, say so plainly. Don't fabricate.
- Names marked "A member" have opted out of attribution — refer to them that way and don't guess who they are.`

let client: Anthropic | null = null

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  if (!client) {
    client = new Anthropic({ apiKey })
  }
  return client
}

function formatSources(sources: SynthesisSource[]): string {
  if (sources.length === 0) {
    return '(no sources retrieved)'
  }
  return sources
    .map((s, i) => {
      const date = s.sentAt.slice(0, 10)
      return `[${i + 1}] ${s.authorDisplayName} in ${s.channel} on ${date}: "${s.messageText}"`
    })
    .join('\n\n')
}

const CLAUDE_TIMEOUT_MS = 20_000

/** Error class the ask endpoint maps to 503 synthesis_unavailable. */
export class SynthesisUnavailableError extends Error {
  readonly code = 'synthesis_unavailable' as const
  constructor(cause: string) {
    super(`synthesis_unavailable: ${cause}`)
  }
}

export async function synthesizeAnswer(input: SynthesisInput): Promise<SynthesisOutput> {
  const c = getClient()
  const userMessage = `Question: ${input.query}\n\nSources:\n${formatSources(input.sources)}\n\nWrite a short synthesized answer with [N] citation markers.`

  let response
  try {
    response = await c.messages.create(
      {
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { timeout: CLAUDE_TIMEOUT_MS },
    )
  } catch (err) {
    throw new SynthesisUnavailableError((err as Error).message)
  }

  const textBlock = response.content.find((b) => b.type === 'text') as
    | { type: 'text'; text: string }
    | undefined
  const answer = textBlock?.text ?? ''

  return { answer, model: response.model }
}
```

The ask endpoint (Task 9) catches `SynthesisUnavailableError` and
responds with `503 {error: 'synthesis_unavailable'}`.

- [ ] **Step 4: Run test, verify it passes**

Run:
```bash
npm run test -- src/test/chatSynthesis.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/chatSynthesis.ts src/test/chatSynthesis.test.ts
git commit -m "feat(weta): add Claude synthesis service with tests"
```

---

### Task 6: `authorReconciliation.ts` — fuzzy match WhatsApp names to member profiles

**Files:**
- Create: `server/services/authorReconciliation.ts`
- Test: `src/test/authorReconciliation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/authorReconciliation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  matchAuthor,
} from '../../server/services/authorReconciliation'

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Erik Schwartz  ')).toBe('erik schwartz')
  })

  it('strips leading tilde prefix (WhatsApp unknown-contact prefix)', () => {
    expect(normalizeName('~ Joana')).toBe('joana')
  })

  it('strips emoji', () => {
    expect(normalizeName('Natalia 🚀 Jaszczuk')).toBe('natalia jaszczuk')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeName('Erik   Schwartz')).toBe('erik schwartz')
  })

  it('returns empty string for phone-number-only authors', () => {
    // Phone numbers are kept verbatim but normalized — they simply won't match anything
    expect(normalizeName('+44 7850 325835')).toBe('+44 7850 325835')
  })
})

describe('matchAuthor', () => {
  const profiles = [
    { email: 'erik@example.com', name: 'Erik Schwartz' },
    { email: 'joana@example.com', name: 'Joana Ribeiro' },
    { email: 'dave@example.com', name: 'Dave Killeen' },
  ]

  it('matches an exact name', () => {
    expect(matchAuthor('Erik Schwartz', profiles)).toBe('erik@example.com')
  })

  it('matches case-insensitively', () => {
    expect(matchAuthor('erik schwartz', profiles)).toBe('erik@example.com')
  })

  it('matches a single-word first name against a profile first name', () => {
    expect(matchAuthor('~ Joana', profiles)).toBe('joana@example.com')
  })

  it('returns null for a phone number', () => {
    expect(matchAuthor('+44 7850 325835', profiles)).toBeNull()
  })

  it('returns null when no profile matches', () => {
    expect(matchAuthor('Unknown Person', profiles)).toBeNull()
  })

  it('returns null when multiple profiles share the same first name (ambiguous)', () => {
    const ambiguous = [
      { email: 'erik1@example.com', name: 'Erik Schwartz' },
      { email: 'erik2@example.com', name: 'Erik Johnson' },
    ]
    expect(matchAuthor('Erik', ambiguous)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```bash
npm run test -- src/test/authorReconciliation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `authorReconciliation.ts`**

Create `server/services/authorReconciliation.ts`:

```typescript
export interface ProfileMatchCandidate {
  email: string
  name: string
}

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu

export function normalizeName(raw: string): string {
  return raw
    .replace(/^~\s*/, '')
    .replace(EMOJI_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isPhoneNumber(normalized: string): boolean {
  // Starts with + and has mostly digits/spaces
  return /^\+\d/.test(normalized)
}

export function matchAuthor(
  rawAuthor: string,
  profiles: ProfileMatchCandidate[],
): string | null {
  const normalized = normalizeName(rawAuthor)
  if (!normalized || isPhoneNumber(normalized)) {
    return null
  }

  // Exact normalized match
  const exact = profiles.filter((p) => normalizeName(p.name) === normalized)
  if (exact.length === 1) {
    return exact[0].email
  }
  if (exact.length > 1) {
    return null // ambiguous
  }

  // Single-token match against profile first names (e.g. "Joana" -> "Joana Ribeiro")
  if (!normalized.includes(' ')) {
    const firstNameMatches = profiles.filter((p) => {
      const firstToken = normalizeName(p.name).split(' ')[0]
      return firstToken === normalized
    })
    if (firstNameMatches.length === 1) {
      return firstNameMatches[0].email
    }
  }

  return null
}
```

- [ ] **Step 4: Run test, verify it passes**

Run:
```bash
npm run test -- src/test/authorReconciliation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/authorReconciliation.ts src/test/authorReconciliation.test.ts
git commit -m "feat(weta): add author reconciliation service with name fuzzy matching"
```

---

### Task 7: `requireAdmin.ts` middleware

**Files:**
- Create: `server/middleware/requireAdmin.ts`
- Test: `src/test/requireAdmin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/requireAdmin.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireAdmin } from '../../server/middleware/requireAdmin'

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@example.com,erik@theaiexpert.ai'
  })

  it('calls next() when the user email is in ADMIN_EMAILS', () => {
    const req = { user: { id: 's', email: 'erik@theaiexpert.ai', name: 'Erik' } } as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not in ADMIN_EMAILS', () => {
    const req = { user: { id: 's', email: 'joe@example.com', name: 'Joe' } } as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when req.user is missing', () => {
    const req = {} as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('treats ADMIN_EMAILS match case-insensitively and trims whitespace', () => {
    process.env.ADMIN_EMAILS = ' Erik@TheAiExpert.ai , admin@example.com '
    const req = { user: { id: 's', email: 'erik@theaiexpert.ai', name: 'E' } } as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```bash
npm run test -- src/test/requireAdmin.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `requireAdmin.ts`**

Create `server/middleware/requireAdmin.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express'

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  const adminEmails = getAdminEmails()
  const userEmail = req.user.email.toLowerCase()

  if (!adminEmails.includes(userEmail)) {
    res.status(403).json({ error: 'Admin access required', code: 'not_admin' })
    return
  }

  next()
}
```

- [ ] **Step 4: Run test, verify it passes**

Run:
```bash
npm run test -- src/test/requireAdmin.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/middleware/requireAdmin.ts src/test/requireAdmin.test.ts
git commit -m "feat(weta): add requireAdmin middleware with ADMIN_EMAILS env check"
```

---

## Phase C — Backend routes

### Task 8: `POST /api/chat/ask` — query synthesis endpoint

**Files:**
- Create: `server/routes/chat.ts`
- Modify: `server/services/analytics.ts`

- [ ] **Step 1: Add `CHAT_QUERY` + `CHAT_QUERY_REDACTED` to analytics event names**

Edit `server/services/analytics.ts`. Change the `AnalyticsEvent` const to:

```typescript
export const AnalyticsEvent = {
  LOGIN_REQUEST: 'login_request',
  LOGIN_SUCCESS: 'login_success',
  LOGOUT: 'logout',
  PROFILE_VIEW: 'profile_view',
  PROFILE_UPDATE: 'profile_update',
  DIRECTORY_VIEW: 'directory_view',
  CHAT_QUERY: 'chat_query',                    // full text logged (default)
  CHAT_QUERY_REDACTED: 'chat_query_redacted',  // opted out — metadata only
} as const
```

- [ ] **Step 2: Create the chat router with `POST /ask`, rate limit, failure mapping, privacy-aware logging**

Create `server/routes/chat.ts`:

```typescript
import { Router } from 'express'
import pool from '../db.ts'
import { requireAuth } from '../middleware/auth.ts'
import { createRateLimiter } from '../services/rate-limit.ts'
import {
  embedQuery,
  EmbeddingUnavailableError,
} from '../services/chatEmbedding.ts'
import {
  synthesizeAnswer,
  SynthesisUnavailableError,
  type SynthesisSource,
} from '../services/chatSynthesis.ts'
import { trackEvent, AnalyticsEvent } from '../services/analytics.ts'

const router = Router()

// Per-member rate limits (keyed on lowercase email):
// 10 questions per minute, 100 per hour. Matches the pattern in
// server/routes/auth.ts.
const askMinuteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 })
const askHourLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 100 })

interface DBRow {
  id: string
  channel: string
  author_name: string
  author_email: string | null
  message_text: string
  sent_at: string
  opted_out: boolean | null
  similarity: number
}

// ---------------------------------------------------------------------------
// POST /api/chat/ask — synthesized answer with cited sources
// ---------------------------------------------------------------------------
router.post('/ask', requireAuth, async (req, res) => {
  const startedAt = Date.now()
  const email = req.user!.email.toLowerCase()

  // ---- Rate limit (fail-fast before any LLM cost) ----
  const minuteCheck = askMinuteLimiter.check(`ask:minute:${email}`)
  const hourCheck = askHourLimiter.check(`ask:hour:${email}`)
  if (!minuteCheck.allowed || !hourCheck.allowed) {
    const retryAfterSec = !minuteCheck.allowed ? 60 : 60 * 60
    res.setHeader('Retry-After', String(retryAfterSec))
    res.status(429).json({ error: 'rate_limited', retryAfterSec })
    return
  }

  // ---- Input validation ----
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (!query || query.length > 500) {
    res.status(400).json({ error: 'bad_query', code: 'bad_query' })
    return
  }
  const limit = Math.min(
    Math.max(typeof req.body?.limit === 'number' ? req.body.limit : 12, 1),
    30,
  )
  const channel = typeof req.body?.channel === 'string' ? req.body.channel : null
  const dateFrom = typeof req.body?.dateFrom === 'string' ? req.body.dateFrom : null
  const dateTo = typeof req.body?.dateTo === 'string' ? req.body.dateTo : null

  // ---- Privacy-aware event logging (fire-and-forget, never blocks) ----
  pool
    .query(
      `SELECT chat_query_logging_opted_out AS opted_out
       FROM cpo_connect.member_profiles
       WHERE email = $1`,
      [email],
    )
    .then((r) => {
      const optedOut = r.rows[0]?.opted_out === true
      if (optedOut) {
        trackEvent(AnalyticsEvent.CHAT_QUERY_REDACTED, email, {
          char_count: query.length,
          channel,
          limit,
        })
      } else {
        trackEvent(AnalyticsEvent.CHAT_QUERY, email, { query, channel, limit })
      }
    })
    .catch(() => {
      /* logging must never block the request — fail silently */
    })

  try {
    // ---- Embed query (Gemini) ----
    let embedding: number[]
    try {
      embedding = await embedQuery(query)
    } catch (err) {
      if (err instanceof EmbeddingUnavailableError) {
        res.setHeader('Retry-After', '30')
        res.status(503).json({ error: 'embedding_unavailable', retryAfterSec: 30 })
        return
      }
      throw err
    }

    // ---- Vector search ----
    const sql = `
      SELECT
        cm.id::text AS id,
        cm.channel,
        cm.author_name,
        cm.author_email,
        cm.message_text,
        cm.sent_at,
        mp.chat_identification_opted_out AS opted_out,
        1 - (cm.embedding <=> $1::vector) AS similarity
      FROM cpo_connect.chat_messages cm
      LEFT JOIN cpo_connect.member_profiles mp
        ON cm.author_email = mp.email
      WHERE cm.embedding IS NOT NULL
        AND ($2::text IS NULL OR cm.channel = $2)
        AND ($3::timestamptz IS NULL OR cm.sent_at >= $3)
        AND ($4::timestamptz IS NULL OR cm.sent_at <= $4)
      ORDER BY cm.embedding <=> $1::vector
      LIMIT $5
    `
    const result = await pool.query<DBRow>(sql, [
      `[${embedding.join(',')}]`,
      channel,
      dateFrom,
      dateTo,
      limit,
    ])

    // ---- Zero-match empty state ----
    if (result.rows.length === 0) {
      res.status(200).json({
        answer: null,
        sources: [],
        message: 'No relevant chat history found for this question',
        queryMs: Date.now() - startedAt,
        model: null,
      })
      return
    }

    // ---- Build sources with identification opt-out honored ----
    const sources: Array<SynthesisSource & { authorOptedOut: boolean; similarity: number }> =
      result.rows.map((row, i) => {
        const optedOut = row.opted_out === true
        return {
          id: String(i + 1),
          channel: row.channel,
          authorDisplayName: optedOut ? 'A member' : row.author_name,
          authorOptedOut: optedOut,
          sentAt: new Date(row.sent_at).toISOString(),
          messageText: row.message_text,
          similarity: Number(row.similarity),
        }
      })

    // ---- Claude synthesis (with explicit failure mapping) ----
    let answer: string
    let model: string
    try {
      const out = await synthesizeAnswer({ query, sources })
      answer = out.answer
      model = out.model
    } catch (err) {
      if (err instanceof SynthesisUnavailableError) {
        res.status(503).json({ error: 'synthesis_unavailable' })
        return
      }
      throw err
    }

    res.status(200).json({
      answer,
      sources,
      queryMs: Date.now() - startedAt,
      model,
    })
  } catch (err) {
    // DB error or any unanticipated failure → 500
    console.error('POST /api/chat/ask unhandled:', (err as Error).message)
    res.status(500).json({ error: 'internal' })
  }
})

export default router
```

- [ ] **Step 3: Mount the router in server.ts**

Edit `server.ts`. Add the import and mount. Note that Task 10 will add a
`/api/admin/chat/ingest`-specific 50MB body limit **before** the router
mount; that's out of scope for Task 8 and added later.

```typescript
import chatRouter from './server/routes/chat.ts'
// ...
app.use('/api/chat', chatRouter)
app.use('/api/admin/chat', chatRouter) // admin routes share the same router
```

Admin authorization is enforced per-endpoint inside `chat.ts`:
- `POST /ingest` uses `requireIngestAuth` (dual cookie/header auth — Task 10)
- `GET /ingestion-runs` uses `requireAuth, requireAdmin` (cookie only — Task 11)

- [ ] **Step 4: Smoke test the endpoint**

Start the dev server, log in via magic link (or use an existing cookie), then:

```bash
curl -X POST http://localhost:3001/api/chat/ask \
  -H 'Content-Type: application/json' \
  -H 'Cookie: cpo_session=<your-signed-session-cookie>' \
  -d '{"query":"hello"}'
```

Expected: `200 OK` with `{ answer, sources: [], queryMs, model }`. Sources will be empty until ingestion runs.

- [ ] **Step 5: Commit**

```bash
git add server/routes/chat.ts server/services/analytics.ts server.ts
git commit -m "feat(weta): add POST /api/chat/ask endpoint with Gemini embed + Claude synthesis"
```

---

### Task 9: `GET /api/chat/prompt-tiles` endpoint

**Files:**
- Modify: `server/routes/chat.ts`

- [ ] **Step 1: Add the endpoint**

Append to `server/routes/chat.ts` (above `export default router`):

```typescript
// ---------------------------------------------------------------------------
// GET /api/chat/prompt-tiles?channel=<id> — returns current + evergreen tiles
// ---------------------------------------------------------------------------
router.get('/prompt-tiles', requireAuth, async (req, res) => {
  try {
    const channel = typeof req.query.channel === 'string' ? req.query.channel : null

    const result = await pool.query<{
      id: string
      scope: string
      title: string
      query: string
      sort_order: number
    }>(
      `SELECT id::text, scope, title, query, sort_order
       FROM cpo_connect.chat_prompt_tiles
       WHERE channel IS NULL OR channel = $1
       ORDER BY scope, sort_order, id`,
      [channel],
    )

    const current = result.rows
      .filter((r) => r.scope === 'current')
      .map((r) => ({ id: r.id, title: r.title, query: r.query }))
    const evergreen = result.rows
      .filter((r) => r.scope === 'evergreen')
      .map((r) => ({ id: r.id, title: r.title, query: r.query }))

    res.status(200).json({ current, evergreen })
  } catch (err) {
    console.error('GET /api/chat/prompt-tiles error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})
```

- [ ] **Step 2: Smoke test**

```bash
curl -H 'Cookie: cpo_session=<cookie>' http://localhost:3001/api/chat/prompt-tiles
```

Expected: `{ "current": [], "evergreen": [ {title: "AI tooling debates", ...}, ...4 items ] }`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/chat.ts
git commit -m "feat(weta): add GET /api/chat/prompt-tiles endpoint"
```

---

### Task 10: `POST /api/admin/chat/ingest` endpoint + `requireIngestAuth` middleware + 50MB body limit

**Files:**
- Create: `server/middleware/requireIngestAuth.ts`
- Create: `src/test/requireIngestAuth.test.ts`
- Modify: `server/routes/chat.ts`
- Modify: `server.ts`

The ingest endpoint is the one place the plan introduces a new auth path:
either a valid admin session cookie (same as the ingestion-runs endpoint)
**or** a matching `X-Ingest-Key` header. The script uses the header path
because there is no way to set a cookie from a CLI. All of that logic is
encapsulated in a single new middleware, `requireIngestAuth`, so the
endpoint stays clean.

- [ ] **Step 1: Write the failing test for `requireIngestAuth`**

Create `src/test/requireIngestAuth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireIngestAuth } from '../../server/middleware/requireIngestAuth'

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe('requireIngestAuth', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'erik@theaiexpert.ai'
    process.env.INGEST_API_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  })

  it('delegates to requireAdmin when a cookie session is already set', () => {
    const req = {
      user: { id: 's', email: 'erik@theaiexpert.ai', name: 'Erik' },
      header: () => undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('accepts a matching X-Ingest-Key header and sets a synthetic user', () => {
    const headerValue = process.env.INGEST_API_KEY!
    const req = {
      user: undefined,
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key' ? headerValue : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect((req as Request).user).toEqual({
      id: 'script',
      email: 'script:ingest',
      name: 'Ingestion Script',
    })
  })

  it('rejects a mismatched X-Ingest-Key header with 401', () => {
    const req = {
      user: undefined,
      header: (name: string) =>
        name.toLowerCase() === 'x-ingest-key'
          ? 'this-is-not-the-key-of-equal-length-to-the-env-var-XX'
          : undefined,
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects when INGEST_API_KEY is unset and no cookie', () => {
    delete process.env.INGEST_API_KEY
    const req = {
      user: undefined,
      header: () => 'whatever',
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects with 401 when neither cookie nor header is present', () => {
    const req = { user: undefined, header: () => undefined } as unknown as Request
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requireIngestAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm run test -- src/test/requireIngestAuth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `requireIngestAuth`**

Create `server/middleware/requireIngestAuth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { requireAdmin } from './requireAdmin.ts'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return timingSafeEqual(bufA, bufB)
}

export function requireIngestAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Path 1: cookie session already established upstream by requireAuth.
  // Delegate to requireAdmin to enforce ADMIN_EMAILS.
  if (req.user) {
    return requireAdmin(req, res, next)
  }

  // Path 2: X-Ingest-Key header verified against INGEST_API_KEY.
  const provided = req.header('x-ingest-key') ?? ''
  const expected = process.env.INGEST_API_KEY ?? ''

  if (!provided || !expected || !safeEqual(provided, expected)) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }

  // Synthetic identity for run attribution in chat_ingestion_runs.triggered_by_email
  req.user = {
    id: 'script',
    email: 'script:ingest',
    name: 'Ingestion Script',
  }
  next()
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm run test -- src/test/requireIngestAuth.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Mount the per-route body limit in `server.ts`**

Edit `server.ts`. Before `app.use('/api/chat', chatRouter)`, add the
route-specific body parser. Note: this uses `express.raw` / `express.json`
mounted directly on the route path so it takes effect **before** the
router's handler:

```typescript
import express from 'express'
// ...
// Admin ingest: larger body limit for the embedding payloads (5-15MB/month).
// This mount must come BEFORE app.use('/api/admin/chat', ...) so the larger
// limit applies to /api/admin/chat/ingest specifically.
app.use('/api/admin/chat/ingest', express.json({ limit: '50mb' }))

app.use('/api/chat', chatRouter)
app.use('/api/admin/chat', chatRouter)
```

The global `express.json()` at the top of `server.ts` keeps its default
~100KB limit for every other route. If a request reaches
`/api/admin/chat/ingest` it goes through the 50MB parser first; the
router's handler sees `req.body` already parsed.

- [ ] **Step 6: Append the ingest endpoint to `server/routes/chat.ts`**

```typescript
import { createHash } from 'node:crypto'
import { requireIngestAuth } from '../middleware/requireIngestAuth.ts'

interface IngestMessageBody {
  channel: string
  authorName: string
  messageText: string
  sentAt: string
  sourceExport: string          // REQUIRED — filename of the zip this row came from
  embedding: number[]
}

interface IngestPromptTileBody {
  scope: 'current' | 'evergreen'
  channel?: string
  title: string
  query: string
}

function contentHash(m: IngestMessageBody): string {
  return createHash('sha256')
    .update(`${m.channel}|${m.authorName}|${m.sentAt}|${m.messageText}`)
    .digest('hex')
}

// ---------------------------------------------------------------------------
// POST /api/admin/chat/ingest — bulk ingest messages + refresh current tiles
// Auth: admin session cookie OR X-Ingest-Key header (see requireIngestAuth).
// Body limit: 50MB (mounted per-route in server.ts, not globally).
// ---------------------------------------------------------------------------
router.post('/ingest', requireIngestAuth, async (req, res) => {
  const startedAt = Date.now()
  let runId: number | null = null

  try {
    const month = typeof req.body?.month === 'string' ? req.body.month : ''
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month must be YYYY-MM', code: 'bad_month' })
      return
    }

    const messages = Array.isArray(req.body?.messages)
      ? (req.body.messages as IngestMessageBody[])
      : []
    const promptTiles = Array.isArray(req.body?.promptTiles)
      ? (req.body.promptTiles as IngestPromptTileBody[])
      : []

    // Create run row
    const runResult = await pool.query<{ id: number }>(
      `INSERT INTO cpo_connect.chat_ingestion_runs
         (triggered_by_email, source_months, status)
       VALUES ($1, $2, 'running')
       RETURNING id`,
      [req.user!.email, [month]],
    )
    runId = Number(runResult.rows[0].id)

    let ingested = 0
    let skipped = 0

    for (const m of messages) {
      // Per-message validation — skip invalid rows, don't fail the whole run
      if (!Array.isArray(m.embedding) || m.embedding.length !== 768) {
        skipped++
        continue
      }
      if (typeof m.sourceExport !== 'string' || m.sourceExport.length === 0) {
        skipped++
        continue
      }
      if (typeof m.channel !== 'string' || !m.channel) {
        skipped++
        continue
      }

      const hash = contentHash(m)
      const insert = await pool.query(
        `INSERT INTO cpo_connect.chat_messages
           (channel, author_name, message_text, sent_at, source_export, content_hash, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (content_hash) DO NOTHING`,
        [
          m.channel,
          m.authorName,
          m.messageText,
          m.sentAt,
          m.sourceExport,
          hash,
          `[${m.embedding.join(',')}]`,
        ],
      )
      if (insert.rowCount && insert.rowCount > 0) {
        ingested++
      } else {
        skipped++
      }
    }

    // Optional: refresh current-scope prompt tiles
    if (promptTiles.length > 0) {
      await pool.query(`DELETE FROM cpo_connect.chat_prompt_tiles WHERE scope = 'current'`)
      for (const [i, t] of promptTiles.entries()) {
        await pool.query(
          `INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [t.scope, t.channel ?? null, t.title, t.query, i],
        )
      }
    }

    await pool.query(
      `UPDATE cpo_connect.chat_ingestion_runs
         SET status = 'success',
             run_completed_at = NOW(),
             messages_ingested = $2,
             messages_skipped = $3
       WHERE id = $1`,
      [runId, ingested, skipped],
    )

    res.status(200).json({
      runId,
      ingested,
      skipped,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    console.error('POST /api/admin/chat/ingest error:', (err as Error).message)
    if (runId !== null) {
      await pool
        .query(
          `UPDATE cpo_connect.chat_ingestion_runs
             SET status = 'failed',
                 run_completed_at = NOW(),
                 error_message = $2
           WHERE id = $1`,
          [runId, (err as Error).message],
        )
        .catch(() => {})
    }
    res.status(500).json({ error: 'Ingestion failed', code: 'ingest_error' })
  }
})
```

- [ ] **Step 7: Commit**

```bash
git add server/middleware/requireIngestAuth.ts \
        src/test/requireIngestAuth.test.ts \
        server/routes/chat.ts \
        server.ts
git commit -m "feat(weta): add POST /api/admin/chat/ingest with requireIngestAuth + 50MB body limit"
```

---

### Task 11: `GET /api/admin/chat/ingestion-runs` endpoint

**Files:**
- Modify: `server/routes/chat.ts`

- [ ] **Step 1: Add the endpoint**

Append to `server/routes/chat.ts` (above `export default router`):

```typescript
// ---------------------------------------------------------------------------
// GET /api/admin/chat/ingestion-runs — history + corpus size
// ---------------------------------------------------------------------------
router.get('/ingestion-runs', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [runsResult, totalResult, latestResult] = await Promise.all([
      pool.query<{
        id: string
        run_started_at: string
        run_completed_at: string | null
        triggered_by_email: string | null
        source_months: string[] | null
        messages_ingested: number
        messages_skipped: number
        status: string
        error_message: string | null
      }>(
        `SELECT id::text, run_started_at, run_completed_at, triggered_by_email,
                source_months, messages_ingested, messages_skipped, status, error_message
         FROM cpo_connect.chat_ingestion_runs
         ORDER BY run_started_at DESC
         LIMIT 50`,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM cpo_connect.chat_messages`,
      ),
      pool.query<{ latest: string | null }>(
        `SELECT MAX(sent_at)::text AS latest FROM cpo_connect.chat_messages`,
      ),
    ])

    res.status(200).json({
      runs: runsResult.rows.map((r) => ({
        id: r.id,
        runStartedAt: r.run_started_at,
        runCompletedAt: r.run_completed_at,
        triggeredBy: r.triggered_by_email ?? '',
        sourceMonths: r.source_months ?? [],
        messagesIngested: r.messages_ingested,
        messagesSkipped: r.messages_skipped,
        status: r.status as 'running' | 'success' | 'failed',
        errorMessage: r.error_message,
      })),
      totalMessages: Number(totalResult.rows[0].count),
      latestMessageAt: latestResult.rows[0]?.latest ?? '',
    })
  } catch (err) {
    console.error('GET /api/admin/chat/ingestion-runs error:', (err as Error).message)
    res.status(500).json({ error: 'Service temporarily unavailable', code: 'service_error' })
  }
})
```

- [ ] **Step 2: Smoke test** (as admin)

```bash
curl -H 'Cookie: cpo_session=<cookie>' http://localhost:3001/api/admin/chat/ingestion-runs
```

Expected: `{ "runs": [], "totalMessages": 0, "latestMessageAt": "" }` before any ingestion.

- [ ] **Step 3: Commit**

```bash
git add server/routes/chat.ts
git commit -m "feat(weta): add GET /api/admin/chat/ingestion-runs endpoint"
```

---

### Task 12: Serve `reference/` archive HTML behind auth

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Add auth-gated static mount**

Edit `server.ts`. After the `app.use('/api/chat', chatRouter)` line, add:

```typescript
import express from 'express'
// existing imports...
import { requireAuth } from './server/middleware/auth.ts'

// Auth-gated archive: /reference/* serves files from ./reference
app.use(
  '/reference',
  async (req, res, next) => {
    await requireAuth(req, res, next)
  },
  express.static(path.join(__dirname, 'reference')),
)
```

Note: `requireAuth` currently returns void after responding on failure. Wrap it so `express.static` only runs if `next()` was called.

- [ ] **Step 2: Manually test the gate**

Without a session cookie:

```bash
curl -i http://localhost:3001/reference/chat-analysis-mar2026.html | head -5
```

Expected: `HTTP/1.1 401`.

With a session cookie:

```bash
curl -I -H 'Cookie: cpo_session=<cookie>' http://localhost:3001/reference/chat-analysis-mar2026.html
```

Expected: `HTTP/1.1 200`, `content-type: text/html`.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat(weta): serve reference/ archive HTML behind requireAuth"
```

---

## Phase D — Local ingestion script

### Task 13: `whatsapp-parser.ts` — parse WhatsApp `_chat.txt`

**Files:**
- Create: `scripts/lib/whatsapp-parser.ts`
- Test: `src/test/whatsapp-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/whatsapp-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseWhatsappChat, filterMonth } from '../../scripts/lib/whatsapp-parser'

const FIXTURE = `[01/03/2026, 09:00:00] Erik Schwartz: Good morning everyone
[01/03/2026, 09:05:12] ~ Joana: Morning!
[02/03/2026, 14:23:45] Dave Killeen: I've been thinking about Claude Code
hooks and they're genuinely great
[15/04/2026, 10:00:00] Erik Schwartz: This should not be in March results
[01/03/2026, 15:00:00] CPO Connect // AI: ‎Messages and calls are end-to-end encrypted.
[01/03/2026, 15:01:00] Gregor Young: ‎image omitted
`

describe('parseWhatsappChat', () => {
  it('parses a multi-line message into one entry', () => {
    const msgs = parseWhatsappChat(FIXTURE)
    const daveMsg = msgs.find((m) => m.author === 'Dave Killeen')
    expect(daveMsg).toBeDefined()
    expect(daveMsg!.text).toContain('thinking about Claude Code')
    expect(daveMsg!.text).toContain('hooks and they')
  })

  it('returns ISO-compatible sentAt timestamps', () => {
    const msgs = parseWhatsappChat(FIXTURE)
    expect(msgs[0].sentAt).toMatch(/^2026-03-01T\d{2}:00:00/)
  })

  it('skips system messages (channel name as sender, E2E notice)', () => {
    const msgs = parseWhatsappChat(FIXTURE)
    expect(msgs.find((m) => m.author.includes('CPO Connect //'))).toBeUndefined()
  })

  it('skips messages with only media placeholders', () => {
    const msgs = parseWhatsappChat(FIXTURE)
    expect(msgs.find((m) => m.text.includes('image omitted'))).toBeUndefined()
  })
})

describe('filterMonth', () => {
  it('returns only messages from the specified YYYY-MM', () => {
    const msgs = parseWhatsappChat(FIXTURE)
    const march = filterMonth(msgs, '2026-03')
    expect(march.every((m) => m.sentAt.startsWith('2026-03'))).toBe(true)
    expect(march.length).toBeGreaterThan(0)
    expect(march.find((m) => m.sentAt.startsWith('2026-04'))).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run:
```bash
npm run test -- src/test/whatsapp-parser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `whatsapp-parser.ts`**

Create `scripts/lib/whatsapp-parser.ts`:

```typescript
export interface ParsedMessage {
  author: string
  text: string
  sentAt: string // ISO string in UTC
}

const LINE_RE =
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2})\] ([^:]+?): (.*)$/

const MEDIA_MARKERS = [
  'image omitted',
  'video omitted',
  'audio omitted',
  'GIF omitted',
  'sticker omitted',
  'document omitted',
  'Contact card omitted',
]

const SYSTEM_PHRASES = [
  'Messages and calls are end-to-end encrypted',
  "changed this group's icon",
  'changed the group description',
  'changed the group name',
  'created this group',
  'joined using this',
  ' added ',
  ' left',
  'This message was deleted',
  'You deleted this message',
]

function stripFormatting(s: string): string {
  return s.replace(/\u200e/g, '').replace(/\u202a/g, '').replace(/\u202c/g, '').trim()
}

function isSystemLine(author: string, text: string): boolean {
  if (author.includes('CPO Connect //')) return true
  if (!text) return true
  return SYSTEM_PHRASES.some((p) => text.includes(p))
}

function isMediaOnly(text: string): boolean {
  return MEDIA_MARKERS.some((m) => text.trim() === m || text.includes(m))
}

export function parseWhatsappChat(raw: string): ParsedMessage[] {
  const out: ParsedMessage[] = []
  let current: ParsedMessage | null = null

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/^\u200e/, '')
    const m = LINE_RE.exec(line)
    if (m) {
      if (current && !isSystemLine(current.author, current.text) && !isMediaOnly(current.text)) {
        out.push(current)
      }
      const [, dd, mm, yyyy, hh, mi, ss, author, text] = m
      const iso = new Date(
        Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)),
      ).toISOString()
      current = {
        author: stripFormatting(author),
        text: stripFormatting(text),
        sentAt: iso,
      }
    } else if (current !== null) {
      current.text += '\n' + line
    }
  }
  if (current && !isSystemLine(current.author, current.text) && !isMediaOnly(current.text)) {
    out.push(current)
  }
  return out
}

export function filterMonth(messages: ParsedMessage[], month: string): ParsedMessage[] {
  // month format: 'YYYY-MM'
  return messages.filter((m) => m.sentAt.startsWith(month))
}
```

- [ ] **Step 4: Run test, verify it passes**

Run:
```bash
npm run test -- src/test/whatsapp-parser.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/whatsapp-parser.ts src/test/whatsapp-parser.test.ts
git commit -m "feat(weta): add WhatsApp chat parser with system/media filtering"
```

---

### Task 14: `gemini-batch-embed.ts` — Gemini batch embedding helper

**Files:**
- Create: `scripts/lib/gemini-batch-embed.ts`

- [ ] **Step 1: Write the module (no test — it wraps an external API)**

Create `scripts/lib/gemini-batch-embed.ts`:

```typescript
import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-embedding-2-preview'
const INGEST_INSTRUCTION = 'Represent this community chat message for semantic search.'
const BATCH_SIZE = 100
const MAX_RETRIES = 3

export interface EmbedItem {
  id: string
  text: string
}

export interface EmbeddedItem extends EmbedItem {
  embedding: number[]
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return new GoogleGenAI({ apiKey })
}

async function embedOne(client: GoogleGenAI, text: string): Promise<number[]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: MODEL,
        contents: `${INGEST_INSTRUCTION}\n\n${text}`,
        config: { outputDimensionality: 768 },
      })
      const vec = response.embeddings?.[0]?.values
      if (!vec) throw new Error('no embedding returned')
      return vec
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err
      const delay = 500 * 2 ** (attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

export async function embedBatch(items: EmbedItem[]): Promise<EmbeddedItem[]> {
  const client = getClient()
  const out: EmbeddedItem[] = []

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE)
    const embedded = await Promise.all(
      chunk.map(async (item) => {
        const embedding = await embedOne(client, item.text)
        return { ...item, embedding }
      }),
    )
    out.push(...embedded)
    console.log(`  [embed] ${out.length}/${items.length} done`)
  }

  return out
}
```

(Note: Phase 2 can migrate to the true Gemini Batch API for the 50% discount. For Phase 1, a sequential sync approach with retries keeps the code simple and still well under rate limits.)

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/gemini-batch-embed.ts
git commit -m "feat(weta): add Gemini embedding helper with retry + chunking"
```

---

### Task 15: `ingest-whatsapp.ts` — the monthly ingestion CLI

**Files:**
- Create: `scripts/ingest-whatsapp.ts`

- [ ] **Step 1: Write the script**

Create `scripts/ingest-whatsapp.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Usage: npx tsx scripts/ingest-whatsapp.ts --month 2026-04
 *
 * Parses three WhatsApp chat exports from ~/Projects/CPO Connect/, filters to
 * the specified month, embeds with Gemini, and POSTs to the admin ingest
 * endpoint.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import AdmZip from 'adm-zip' // Note: this is a new dev dep — see Step 0
import { parseWhatsappChat, filterMonth, type ParsedMessage } from './lib/whatsapp-parser.ts'
import { embedBatch, type EmbedItem } from './lib/gemini-batch-embed.ts'

const CHANNELS = [
  { id: 'ai', zip: 'WhatsApp Chat - CPO Connect __ AI.zip' },
  { id: 'general', zip: 'WhatsApp Chat - CPO Connect __ General.zip' },
  { id: 'leadership_culture', zip: 'WhatsApp Chat - CPO Connect __ Leadership & Culture.zip' },
]

function parseArgs(): { month: string; serverUrl: string; apiKey: string } {
  const args = process.argv.slice(2)
  const monthIdx = args.indexOf('--month')
  if (monthIdx < 0) {
    throw new Error('usage: --month YYYY-MM')
  }
  const month = args[monthIdx + 1]
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('--month must be YYYY-MM')
  }
  const serverUrl = process.env.INGEST_SERVER_URL ?? 'http://localhost:3001'
  const apiKey = process.env.INGEST_API_KEY ?? ''
  if (!apiKey) {
    throw new Error(
      'INGEST_API_KEY env var must be set. The simplest setup is a gitignored ' +
        '.env.ingest file with INGEST_API_KEY=<the key from Render>, sourced ' +
        'before running this script (e.g. `set -a; source .env.ingest; set +a; npx tsx ...`).',
    )
  }
  return { month, serverUrl, apiKey }
}

function extractChatTxt(zipPath: string): string {
  const zip = new AdmZip(zipPath)
  const entry = zip.getEntries().find((e) => e.entryName.endsWith('_chat.txt'))
  if (!entry) {
    throw new Error(`No _chat.txt found in ${zipPath}`)
  }
  return entry.getData().toString('utf-8')
}

interface ChannelResult {
  channel: string
  messages: Array<ParsedMessage & { channel: string; sourceExport: string }>
}

async function readChannel(
  channelId: string,
  zipFilename: string,
  month: string,
  baseDir: string,
): Promise<ChannelResult> {
  const zipPath = path.join(baseDir, zipFilename)
  const raw = extractChatTxt(zipPath)
  const parsed = parseWhatsappChat(raw)
  const monthly = filterMonth(parsed, month)
  console.log(`  [${channelId}] ${monthly.length} messages in ${month}`)
  return {
    channel: channelId,
    messages: monthly.map((m) => ({
      ...m,
      channel: channelId,
      sourceExport: zipFilename,
    })),
  }
}

async function main() {
  const { month, serverUrl, apiKey } = parseArgs()
  const baseDir = path.join(os.homedir(), 'Projects', 'CPO Connect')
  console.log(`Ingesting ${month} from ${baseDir}`)

  const channelResults = await Promise.all(
    CHANNELS.map((c) => readChannel(c.id, c.zip, month, baseDir)),
  )
  const allMessages = channelResults.flatMap((r) => r.messages)
  console.log(`Total: ${allMessages.length} messages to embed`)

  if (allMessages.length === 0) {
    console.log('Nothing to ingest. Exiting.')
    return
  }

  const items: EmbedItem[] = allMessages.map((m, i) => ({
    id: String(i),
    text: m.text,
  }))
  const embedded = await embedBatch(items)
  const embeddingById = new Map(embedded.map((e) => [e.id, e.embedding]))

  const payload = {
    month,
    sourceExports: CHANNELS.map((c) => c.zip),
    messages: allMessages.map((m, i) => ({
      channel: m.channel,
      authorName: m.author,
      messageText: m.text,
      sentAt: m.sentAt,
      sourceExport: m.sourceExport,          // REQUIRED per-message — different channels ship in different zips
      embedding: embeddingById.get(String(i))!,
    })),
  }

  console.log(`POST ${serverUrl}/api/admin/chat/ingest`)
  const res = await fetch(`${serverUrl}/api/admin/chat/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ingest-Key': apiKey,              // headless auth — no cookie needed
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error(`Failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  const result = await res.json()
  console.log(`Ingested: ${result.ingested}, skipped: ${result.skipped}, runId: ${result.runId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Install `adm-zip` as a dev dependency**

Run:
```bash
npm install --save-dev adm-zip @types/adm-zip
```

Expected: `package.json` devDependencies updated.

- [ ] **Step 3: Dry-run the script (no server call)**

Temporarily comment out the `fetch` call, then:

```bash
INGEST_API_KEY=dummy npx tsx scripts/ingest-whatsapp.ts --month 2026-03
```

Expected: prints `[ai] N messages in 2026-03`, same for general + leadership_culture, then a message count. No embedding happens because the script exits before that without the fetch. (Remove the comment before committing.)

Create a gitignored `.env.ingest` file with the real key:

```bash
# .env.ingest (NEVER commit)
INGEST_API_KEY=<paste-from-render-env-vars>
INGEST_SERVER_URL=http://localhost:3001
```

Verify `.gitignore` covers it:

```bash
grep -F '.env' "/Users/eschwaa/Projects/CPO Connect/cpo-connect-hub/.gitignore"
```

Expected: a line like `.env*` or `.env.ingest` appears. If not, add it.

- [ ] **Step 4: Restore the fetch call**

Un-comment the POST. Run `git diff scripts/ingest-whatsapp.ts` to confirm no diff before commit.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest-whatsapp.ts package.json package-lock.json
git commit -m "feat(weta): add monthly ingest-whatsapp.ts CLI script"
```

---

## Phase E — Frontend constants & hooks

### Task 16: `chatChannels.ts` constant

**Files:**
- Create: `src/constants/chatChannels.ts`

- [ ] **Step 1: Create the file**

Create `src/constants/chatChannels.ts`:

```typescript
export interface ChatChannel {
  id: string | null
  label: string
  isAll?: boolean
}

export const CHAT_CHANNELS: ChatChannel[] = [
  { id: null, label: 'All channels', isAll: true },
  { id: 'ai', label: 'AI' },
  { id: 'general', label: 'General' },
  { id: 'leadership_culture', label: 'Leadership & Culture' },
]

export function allChannelsLabel(): string {
  const nonAll = CHAT_CHANNELS.filter((c) => !c.isAll).length
  return `All ${nonAll} channels`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/chatChannels.ts
git commit -m "feat(weta): add chatChannels constant"
```

---

### Task 17: `useChatApi.ts` — React Query hooks

**Files:**
- Create: `src/hooks/useChatApi.ts`

- [ ] **Step 1: Create the hooks file**

Create `src/hooks/useChatApi.ts`:

```typescript
import { useMutation, useQuery } from '@tanstack/react-query'

export interface ChatSource {
  id: string
  channel: string
  authorDisplayName: string
  authorOptedOut: boolean
  sentAt: string
  messageText: string
  similarity: number
}

export interface ChatAnswer {
  answer: string
  sources: ChatSource[]
  queryMs: number
  model: string
}

export interface AskChatInput {
  query: string
  channel?: string | null
  limit?: number
  dateFrom?: string
  dateTo?: string
}

async function postAsk(input: AskChatInput): Promise<ChatAnswer> {
  const res = await fetch('/api/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`ask failed: ${res.status}`)
  return res.json()
}

export function useAskChat() {
  return useMutation({ mutationFn: postAsk })
}

export interface PromptTile {
  id: string
  title: string
  query: string
}

export interface PromptTilesResponse {
  current: PromptTile[]
  evergreen: PromptTile[]
}

async function fetchPromptTiles(channel: string | null): Promise<PromptTilesResponse> {
  const url = channel
    ? `/api/chat/prompt-tiles?channel=${encodeURIComponent(channel)}`
    : '/api/chat/prompt-tiles'
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`prompt-tiles failed: ${res.status}`)
  return res.json()
}

export function usePromptTiles(channel: string | null) {
  return useQuery({
    queryKey: ['chat-prompt-tiles', channel],
    queryFn: () => fetchPromptTiles(channel),
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

export interface IngestionRun {
  id: string
  runStartedAt: string
  runCompletedAt: string | null
  triggeredBy: string
  sourceMonths: string[]
  messagesIngested: number
  messagesSkipped: number
  status: 'running' | 'success' | 'failed'
  errorMessage: string | null
}

export interface IngestionRunsResponse {
  runs: IngestionRun[]
  totalMessages: number
  latestMessageAt: string
}

async function fetchIngestionRuns(): Promise<IngestionRunsResponse> {
  const res = await fetch('/api/admin/chat/ingestion-runs', { credentials: 'include' })
  if (!res.ok) throw new Error(`ingestion-runs failed: ${res.status}`)
  return res.json()
}

export function useIngestionRuns() {
  return useQuery({
    queryKey: ['chat-ingestion-runs'],
    queryFn: fetchIngestionRuns,
    staleTime: 60 * 1000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useChatApi.ts
git commit -m "feat(weta): add React Query hooks for chat endpoints"
```

---

## Phase F — Frontend components

### Task 18: `ChannelTabs.tsx` — channel filter tabs

**Files:**
- Create: `src/components/members/whats-talked/ChannelTabs.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/members/whats-talked/ChannelTabs.tsx`:

```typescript
import { CHAT_CHANNELS, allChannelsLabel, type ChatChannel } from '@/constants/chatChannels'
import { cn } from '@/lib/utils'

interface ChannelTabsProps {
  selectedChannel: string | null
  onChange: (channel: string | null) => void
}

export function ChannelTabs({ selectedChannel, onChange }: ChannelTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by channel"
      className="flex flex-wrap gap-2"
    >
      {CHAT_CHANNELS.map((ch: ChatChannel) => {
        const label = ch.isAll ? allChannelsLabel() : ch.label
        const isActive = selectedChannel === ch.id
        return (
          <button
            key={String(ch.id)}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(ch.id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/ChannelTabs.tsx
git commit -m "feat(weta): add ChannelTabs component"
```

---

### Task 19: `PromptTile.tsx` — clickable suggestion tile

**Files:**
- Create: `src/components/members/whats-talked/PromptTile.tsx`

- [ ] **Step 1: Create the component**

```typescript
interface PromptTileProps {
  title: string
  onClick: () => void
}

export function PromptTile({ title, onClick }: PromptTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent"
    >
      {title}
    </button>
  )
}
```

Save to `src/components/members/whats-talked/PromptTile.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/PromptTile.tsx
git commit -m "feat(weta): add PromptTile component"
```

---

### Task 20: `AskForm.tsx` — search input

**Files:**
- Create: `src/components/members/whats-talked/AskForm.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState, useEffect, type FormEvent } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AskFormProps {
  initialQuery?: string
  isLoading: boolean
  onSubmit: (query: string) => void
}

export function AskForm({ initialQuery = '', isLoading, onSubmit }: AskFormProps) {
  const [value, setValue] = useState(initialQuery)

  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          placeholder="Ask anything about the chats…"
          className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary"
          aria-label="Ask a question"
        />
      </div>
      <Button type="submit" disabled={isLoading || value.trim().length === 0}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
      </Button>
    </form>
  )
}
```

Save to `src/components/members/whats-talked/AskForm.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/AskForm.tsx
git commit -m "feat(weta): add AskForm component"
```

---

### Task 21: `SourceCard.tsx` — individual source message display

**Files:**
- Create: `src/components/members/whats-talked/SourceCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { ChatSource } from '@/hooks/useChatApi'

interface SourceCardProps {
  index: number
  source: ChatSource
}

const CHANNEL_LABELS: Record<string, string> = {
  ai: 'AI',
  general: 'General',
  leadership_culture: 'Leadership & Culture',
}

export function SourceCard({ index, source }: SourceCardProps) {
  const date = new Date(source.sentAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const channelLabel = CHANNEL_LABELS[source.channel] ?? source.channel

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">[{index}]</span>
        <span className="font-medium text-foreground">{source.authorDisplayName}</span>
        <span>·</span>
        <span>{channelLabel}</span>
        <span>·</span>
        <span>{date}</span>
        {source.authorOptedOut && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">opted out</span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{source.messageText}</p>
    </div>
  )
}
```

Save to `src/components/members/whats-talked/SourceCard.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/SourceCard.tsx
git commit -m "feat(weta): add SourceCard component"
```

---

### Task 22: `AnswerPanel.tsx` — synthesized answer display

**Files:**
- Create: `src/components/members/whats-talked/AnswerPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { ChatAnswer } from '@/hooks/useChatApi'
import { SourceCard } from './SourceCard'

interface AnswerPanelProps {
  data: ChatAnswer
}

export function AnswerPanel({ data }: AnswerPanelProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Answer</h2>
        <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
          {data.answer}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Synthesized by {data.model} in {data.queryMs} ms from {data.sources.length} sources
        </p>
      </section>

      {data.sources.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            Sources ({data.sources.length})
          </h2>
          <div className="space-y-3">
            {data.sources.map((s, i) => (
              <SourceCard key={s.id} index={i + 1} source={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

Save to `src/components/members/whats-talked/AnswerPanel.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/AnswerPanel.tsx
git commit -m "feat(weta): add AnswerPanel component"
```

---

### Task 23: `EmptyState.tsx` — no-results empty state

**Files:**
- Create: `src/components/members/whats-talked/EmptyState.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { MessageSquareOff } from 'lucide-react'

interface EmptyStateProps {
  query: string
}

export function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
      <MessageSquareOff className="mb-3 h-10 w-10 text-muted-foreground" />
      <h3 className="mb-1 text-base font-semibold">No matching messages</h3>
      <p className="text-sm text-muted-foreground">
        We couldn't find anything related to &ldquo;{query}&rdquo; in the archived chats.
        Try rewording the question or switching channels.
      </p>
    </div>
  )
}
```

Save to `src/components/members/whats-talked/EmptyState.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/EmptyState.tsx
git commit -m "feat(weta): add EmptyState component"
```

---

### Task 24: `WhatsTalkedHero.tsx` — hero composition (tiles + form)

**Files:**
- Create: `src/components/members/whats-talked/WhatsTalkedHero.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { ChannelTabs } from './ChannelTabs'
import { AskForm } from './AskForm'
import { PromptTile } from './PromptTile'
import { usePromptTiles } from '@/hooks/useChatApi'

interface WhatsTalkedHeroProps {
  selectedChannel: string | null
  onChannelChange: (channel: string | null) => void
  onSubmitQuery: (query: string) => void
  isLoading: boolean
}

export function WhatsTalkedHero({
  selectedChannel,
  onChannelChange,
  onSubmitQuery,
  isLoading,
}: WhatsTalkedHeroProps) {
  const { data: tiles } = usePromptTiles(selectedChannel)

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">What's Everyone Talking About?</h1>
        <p className="text-muted-foreground">A quick way to catch up on the community.</p>
      </header>

      <section className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Search across</p>
        <ChannelTabs selectedChannel={selectedChannel} onChange={onChannelChange} />
      </section>

      <AskForm isLoading={isLoading} onSubmit={onSubmitQuery} />

      {(tiles?.current?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Right now</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tiles!.current.map((t) => (
              <PromptTile key={t.id} title={t.title} onClick={() => onSubmitQuery(t.query)} />
            ))}
          </div>
        </section>
      )}

      {(tiles?.evergreen?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Always useful</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiles!.evergreen.map((t) => (
              <PromptTile key={t.id} title={t.title} onClick={() => onSubmitQuery(t.query)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

Save to `src/components/members/whats-talked/WhatsTalkedHero.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/members/whats-talked/WhatsTalkedHero.tsx
git commit -m "feat(weta): add WhatsTalkedHero composition with tiles + form"
```

---

### Task 25: `WhatsTalked.tsx` — the page

**Files:**
- Create: `src/pages/members/WhatsTalked.tsx`

- [ ] **Step 1: Create the page with URL state**

```typescript
import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsTalkedHero } from '@/components/members/whats-talked/WhatsTalkedHero'
import { AnswerPanel } from '@/components/members/whats-talked/AnswerPanel'
import { EmptyState } from '@/components/members/whats-talked/EmptyState'
import { useAskChat } from '@/hooks/useChatApi'

export default function WhatsTalked() {
  const [searchParams, setSearchParams] = useSearchParams()
  const channel = searchParams.get('channel')
  const query = searchParams.get('q') ?? ''

  const askMutation = useAskChat()

  const runQuery = useCallback(
    (nextQuery: string) => {
      const next = new URLSearchParams(searchParams)
      next.set('q', nextQuery)
      if (channel) next.set('channel', channel)
      else next.delete('channel')
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams, channel],
  )

  const clearQuery = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    setSearchParams(next, { replace: false })
    askMutation.reset()
  }, [searchParams, setSearchParams, askMutation])

  // Auto-execute when query param is set
  useEffect(() => {
    if (query) {
      askMutation.mutate({ query, channel })
    } else {
      askMutation.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, channel])

  const handleChannelChange = (nextChannel: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (nextChannel) next.set('channel', nextChannel)
    else next.delete('channel')
    setSearchParams(next, { replace: true })
  }

  if (!query) {
    return (
      <div className="space-y-8">
        <WhatsTalkedHero
          selectedChannel={channel}
          onChannelChange={handleChannelChange}
          onSubmitQuery={runQuery}
          isLoading={askMutation.isPending}
        />
        <LoggingNotice />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={clearQuery}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-sm font-medium italic text-muted-foreground">"{query}"</p>
      </div>

      {askMutation.isPending && (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {askMutation.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Something went wrong. Please try again.
        </div>
      )}

      {askMutation.isSuccess && askMutation.data.sources.length === 0 && (
        <EmptyState query={query} />
      )}

      {askMutation.isSuccess && askMutation.data.sources.length > 0 && (
        <AnswerPanel data={askMutation.data} />
      )}

      {askMutation.isSuccess && (
        <div>
          <Button onClick={clearQuery}>Ask another question</Button>
        </div>
      )}

      <LoggingNotice />
    </div>
  )
}

/** Privacy disclosure for query logging. See spec I6. */
function LoggingNotice() {
  return (
    <p className="text-center text-xs text-muted-foreground">
      We may log the text of your questions to improve this feature. You can
      opt out in your{' '}
      <a href="/members/profile" className="underline hover:text-foreground">
        profile
      </a>
      .
    </p>
  )
}
```

Save to `src/pages/members/WhatsTalked.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/pages/members/WhatsTalked.tsx
git commit -m "feat(weta): add WhatsTalked page with URL-driven state"
```

---

## Phase G — Nav + routes + Profile + Admin

### Task 26: Update Navbar + App.tsx routes

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update the member links in Navbar**

Edit `src/components/Navbar.tsx`. Change the `memberLinks` constant (line 28):

```typescript
const memberLinks = [
  { label: "What's Everyone Talking About", to: "/members/whats-talked" },
  { label: "Monthly Summaries", to: "/members/summaries" },
  { label: "Directory", to: "/members/directory" },
  { label: "Profile", to: "/members/profile" },
]
```

Also update the two `<Link to="/members/chat-insights">` instances (line 164 and 294) to point to `/members/whats-talked`.

- [ ] **Step 2: Update App.tsx routes**

Edit `src/App.tsx`. Add the new imports:

```typescript
import WhatsTalked from "@/pages/members/WhatsTalked"
import MonthlySummaries from "@/pages/members/MonthlySummaries"
import ChatIngestionHistory from "@/pages/members/admin/ChatIngestionHistory"
```

Remove the `ChatInsights` import.

Update the routes:

```typescript
<Route
  path="/members"
  element={
    <ProtectedRoute>
      <Navigate to="/members/whats-talked" replace />
    </ProtectedRoute>
  }
/>
<Route
  path="/members/whats-talked"
  element={
    <ProtectedRoute>
      <MembersLayout>
        <WhatsTalked />
      </MembersLayout>
    </ProtectedRoute>
  }
/>
<Route
  path="/members/summaries"
  element={
    <ProtectedRoute>
      <MembersLayout>
        <MonthlySummaries />
      </MembersLayout>
    </ProtectedRoute>
  }
/>
<Route
  path="/members/chat-insights"
  element={<Navigate to="/members/summaries" replace />}
/>
<Route
  path="/members/admin/chat-ingest"
  element={
    <ProtectedRoute>
      <MembersLayout>
        <ChatIngestionHistory />
      </MembersLayout>
    </ProtectedRoute>
  }
/>
<Route
  path="/members/directory"
  element={
    <ProtectedRoute>
      <MembersLayout>
        <Directory />
      </MembersLayout>
    </ProtectedRoute>
  }
/>
<Route
  path="/members/profile"
  element={
    <ProtectedRoute>
      <MembersLayout>
        <Profile />
      </MembersLayout>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd "/Users/eschwaa/Projects/CPO Connect/cpo-connect-hub"
npx tsc --noEmit
```

Expected: no errors. (There will be errors on the new page/component imports until Task 27 and 31 are complete — defer this check until after those tasks if needed.)

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx src/App.tsx
git commit -m "feat(weta): add WhatsTalked and admin routes, rename Chat Insights to Monthly Summaries"
```

---

### Task 27: `MonthlySummaries.tsx` — archive index page

**Files:**
- Create: `src/pages/members/MonthlySummaries.tsx`
- Delete: `src/pages/members/ChatInsights.tsx`

- [ ] **Step 1: Create the new page**

Create `src/pages/members/MonthlySummaries.tsx`:

```typescript
import { ExternalLink } from 'lucide-react'

interface ArchiveEntry {
  slug: string
  label: string
}

// Ordered newest-first.
const ARCHIVE: ArchiveEntry[] = [
  { slug: 'mar2026', label: 'March 2026' },
  { slug: 'feb2026', label: 'February 2026' },
  { slug: 'jan2026', label: 'January 2026' },
]

export default function MonthlySummaries() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Monthly Summaries</h1>
        <p className="text-muted-foreground">
          Deep-dive archives for each month's chat activity across all channels.
        </p>
      </header>

      <ul className="space-y-3">
        {ARCHIVE.map((entry) => (
          <li key={entry.slug}>
            <a
              href={`/reference/chat-analysis-${entry.slug}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="font-medium text-foreground">{entry.label}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Delete `ChatInsights.tsx`**

```bash
rm src/pages/members/ChatInsights.tsx
```

- [ ] **Step 3: Verify no stale imports**

Run:
```bash
grep -r "ChatInsights" src/ --exclude-dir=node_modules
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/pages/members/MonthlySummaries.tsx
git rm src/pages/members/ChatInsights.tsx
git commit -m "feat(weta): replace ChatInsights with MonthlySummaries archive index"
```

---

### Task 28: Profile opt-out toggles (identification + query logging)

**Files:**
- Modify: `src/pages/members/Profile.tsx`
- Modify: `server/routes/members.ts`

The Profile page gets **two** independent toggles. Both target new
columns on `member_profiles` added by migration 010.

- [ ] **Step 1: Add both fields to the backend whitelist**

Edit `server/routes/members.ts`. Update `EDITABLE_FIELDS`:

```typescript
const EDITABLE_FIELDS = [
  'name', 'role', 'current_org', 'sector', 'location',
  'focus_areas', 'areas_of_interest', 'linkedin_url', 'bio', 'skills',
  'phone', 'show_email', 'show_phone',
  'chat_identification_opted_out',
  'chat_query_logging_opted_out',
] as const
```

Update `PROFILE_COLUMNS`:

```typescript
const PROFILE_COLUMNS = `email, name, role, current_org, sector, location,
  focus_areas, areas_of_interest, linkedin_url, bio, skills,
  phone, photo_url, show_email, show_phone,
  chat_identification_opted_out, chat_query_logging_opted_out, updated_at`
```

Update the PUT handler's type check so both new fields are treated as
booleans:

```typescript
const BOOLEAN_FIELDS = new Set([
  'show_email',
  'show_phone',
  'chat_identification_opted_out',
  'chat_query_logging_opted_out',
])

for (const field of EDITABLE_FIELDS) {
  if (field in req.body) {
    const val = req.body[field]
    if (BOOLEAN_FIELDS.has(field)) {
      if (typeof val === 'boolean') updates[field] = val
    } else if (typeof val === 'string') {
      updates[field] = val
    }
  }
}
```

- [ ] **Step 2: Update the Profile interface and UI**

Edit `src/pages/members/Profile.tsx`. Add both fields to the `Profile`
interface:

```typescript
chat_identification_opted_out: boolean
chat_query_logging_opted_out: boolean
```

Add a new card near the bottom of the form (before the Save button area)
with **two** toggles:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Privacy — chat analysis</CardTitle>
  </CardHeader>
  <CardContent className="space-y-5">
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="chat-id-opt-out"
          checked={form.chat_identification_opted_out ?? false}
          onChange={(e) =>
            setForm({ ...form, chat_identification_opted_out: e.target.checked })
          }
          className="mt-1 h-4 w-4"
        />
        <Label htmlFor="chat-id-opt-out" className="cursor-pointer font-normal">
          Hide my name from chat analysis results
        </Label>
      </div>
      <p className="pl-7 text-xs text-muted-foreground">
        Your messages are still searchable but attributed as &ldquo;A member
        said…&rdquo; instead of with your name.
      </p>
    </div>

    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="chat-log-opt-out"
          checked={form.chat_query_logging_opted_out ?? false}
          onChange={(e) =>
            setForm({ ...form, chat_query_logging_opted_out: e.target.checked })
          }
          className="mt-1 h-4 w-4"
        />
        <Label htmlFor="chat-log-opt-out" className="cursor-pointer font-normal">
          Don't log the text of my questions
        </Label>
      </div>
      <p className="pl-7 text-xs text-muted-foreground">
        We still count that you asked something (for usage stats), but won't
        store the text of your questions or the answers.
      </p>
    </div>
  </CardContent>
</Card>
```

(Read the existing `src/pages/members/Profile.tsx` first to match the
actual `form` state setter names — this plan uses `setForm` but the real
file may use `setProfile` or similar.)

- [ ] **Step 3: Verify end-to-end**

Start both dev servers. Log in, go to `/members/profile`, toggle each
checkbox, save, reload — verify both stay set. Then unset one and leave
the other set, save, reload — verify they persist independently.

- [ ] **Step 4: Commit**

```bash
git add src/pages/members/Profile.tsx server/routes/members.ts
git commit -m "feat(weta): add chat identification + query logging opt-out toggles on profile"
```

---

### Task 29: Admin — `ChatIngestionHistory.tsx` + `IngestionRunCard.tsx`

**Files:**
- Create: `src/components/members/admin/IngestionRunCard.tsx`
- Create: `src/pages/members/admin/ChatIngestionHistory.tsx`

- [ ] **Step 1: Create the run card**

```typescript
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { IngestionRun } from '@/hooks/useChatApi'

interface IngestionRunCardProps {
  run: IngestionRun
}

function StatusIcon({ status }: { status: IngestionRun['status'] }) {
  if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />
  return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
}

export function IngestionRunCard({ run }: IngestionRunCardProps) {
  const started = new Date(run.runStartedAt).toLocaleString()
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StatusIcon status={run.status} />
          <span>{run.sourceMonths.join(', ') || '—'}</span>
        </div>
        <span className="text-xs text-muted-foreground">{started}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Triggered by {run.triggeredBy || 'unknown'} ·{' '}
        {run.messagesIngested} ingested · {run.messagesSkipped} skipped
      </div>
      {run.errorMessage && (
        <p className="mt-2 text-xs text-destructive">{run.errorMessage}</p>
      )}
    </div>
  )
}
```

Save to `src/components/members/admin/IngestionRunCard.tsx`.

- [ ] **Step 2: Create the admin page**

```typescript
import { Loader2 } from 'lucide-react'
import { useIngestionRuns } from '@/hooks/useChatApi'
import { IngestionRunCard } from '@/components/members/admin/IngestionRunCard'

export default function ChatIngestionHistory() {
  const { data, isLoading, isError, error } = useIngestionRuns()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    const message = (error as Error).message
    const isForbidden = message.includes('403')
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
        {isForbidden
          ? 'Admin access required.'
          : 'Failed to load ingestion history.'}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Chat ingestion history</h1>
        <p className="text-muted-foreground">
          Corpus size: {data.totalMessages.toLocaleString()} messages
          {data.latestMessageAt && (
            <>
              {' '}· latest message{' '}
              {new Date(data.latestMessageAt).toLocaleDateString()}
            </>
          )}
        </p>
      </header>

      {data.runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
      ) : (
        <div className="space-y-3">
          {data.runs.map((r) => (
            <IngestionRunCard key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  )
}
```

Save to `src/pages/members/admin/ChatIngestionHistory.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/members/admin/IngestionRunCard.tsx \
        src/pages/members/admin/ChatIngestionHistory.tsx
git commit -m "feat(weta): add admin chat ingestion history page"
```

---

## Phase H — Bootstrap, QA, deploy

### Task 30: Full test + TypeScript sweep

**Files:**
- None (verification only)

- [ ] **Step 1: Run vitest**

```bash
cd "/Users/eschwaa/Projects/CPO Connect/cpo-connect-hub"
npm run test
```

Expected: all tests PASS (new tests + existing `rate-limit.test.ts`).

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors or only pre-existing warnings.

- [ ] **Step 4: Run vite build**

```bash
npm run build
```

Expected: successful build, `dist/` populated.

- [ ] **Step 5: If all green, proceed. If anything fails, fix and re-run.**

No commit — this is a gate check.

---

### Task 31: First ingestion run — bootstrap Jan/Feb/Mar 2026

**Files:**
- None (operational task)

- [ ] **Step 1: Set local env vars**

Ensure `.env` has `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`,
`SESSION_SECRET`, `ADMIN_EMAILS=erik@theaiexpert.ai` (or whatever Erik's
address is), and `INGEST_API_KEY=<the-key-also-set-on-render>`.

Also set the same `INGEST_API_KEY` in a gitignored `.env.ingest` file for
the script to source.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev:server
```

Wait for `Migrations complete`.

- [ ] **Step 3: Run ingestion for January using the headless API key**

```bash
set -a; source .env.ingest; set +a
npx tsx scripts/ingest-whatsapp.ts --month 2026-01
```

Expected log output:
```
Ingesting 2026-01 from /Users/eschwaa/Projects/CPO Connect
  [ai] ~480 messages in 2026-01
  [general] ~N messages in 2026-01
  [leadership_culture] ~N messages in 2026-01
Total: ~N messages to embed
  [embed] 100/N done
  ...
POST http://localhost:3001/api/admin/chat/ingest
Ingested: N, skipped: 0, runId: 1
```

- [ ] **Step 4: Run ingestion for February and March**

```bash
npx tsx scripts/ingest-whatsapp.ts --month 2026-02
npx tsx scripts/ingest-whatsapp.ts --month 2026-03
```

- [ ] **Step 6: Verify corpus size**

```bash
psql "$DATABASE_URL" -c "SELECT channel, COUNT(*) FROM cpo_connect.chat_messages GROUP BY channel"
```

Expected: three rows, e.g. `ai | 1191`, `general | ~785`, `leadership_culture | ~209` (approximate totals for 3 months).

- [ ] **Step 7: Quick smoke query against the DB**

```bash
psql "$DATABASE_URL" -c "SELECT author_name, channel, sent_at, LEFT(message_text, 80) FROM cpo_connect.chat_messages ORDER BY sent_at DESC LIMIT 5"
```

Expected: recent March messages appear.

No commit — data-only task.

---

### Task 32: Manual QA checklist

**Files:**
- None (QA only)

- [ ] **Step 1: Start both dev servers**

```bash
npm run dev:all
```

- [ ] **Step 2: Walk through the QA list**

Open http://localhost:5173 in a browser:

- [ ] Log in via magic link
- [ ] Land on `/members/whats-talked`
- [ ] See the hero with 4 evergreen tiles
- [ ] Click channel tabs — URL `?channel=` updates
- [ ] Click an evergreen tile — URL updates to `?q=...`, loading state shows, answer + sources appear
- [ ] Verify at least 5 source cards show up with real author names, channel, date
- [ ] Type a custom query: "what did people say about burnout?" — answer appears
- [ ] Verify query response time under 3 seconds
- [ ] Click "Back" — returns to hero
- [ ] Click "Ask another question" — returns to hero
- [ ] Verify the privacy notice appears below the hero form with a link to profile
- [ ] Navigate to `/members/profile` — verify **both** toggles exist: "Hide my name" and "Don't log the text of my questions"
- [ ] Toggle "Hide my name" on, save
- [ ] Go back to `/members/whats-talked`, run a query that should include your own messages
- [ ] Verify your messages show as "A member" with the "opted out" pill
- [ ] Toggle it off, save, re-run — your name returns
- [ ] Toggle "Don't log questions" on, save
- [ ] Run a query, then check the events table: `psql "$DATABASE_URL" -c "SELECT event, metadata FROM cpo_connect.events WHERE email = 'you@example.com' ORDER BY created_at DESC LIMIT 3"`
- [ ] Verify the most recent row has `event = 'chat_query_redacted'` and metadata contains `char_count` but NO `query` field
- [ ] Toggle it off again, re-run — event is `chat_query` with the full query text
- [ ] Test rate limit: fire 11 queries in under a minute — the 11th returns 429 with a `Retry-After` header
- [ ] Navigate to `/members/summaries` — see three month links
- [ ] Click March 2026 — opens `/reference/chat-analysis-mar2026.html` in a new tab, page renders
- [ ] Navigate to `/members/admin/chat-ingest` (as admin email) — see 3 ingestion runs listed
- [ ] Navigate there as a non-admin — see "Admin access required" error
- [ ] Directory + Profile pages still load correctly (no regressions)
- [ ] Test failure mode: temporarily unset `GEMINI_API_KEY`, restart server, run a query — frontend shows the "Search is briefly busy" toast, backend logs a 503 `embedding_unavailable`. Restore the key.

- [ ] **Step 3: File any issues found**

Fix any bugs, re-run affected tests, commit fixes under their own messages.

No commit unless bugs were fixed.

---

### Task 33: Render environment variables setup

**Files:**
- None (Render dashboard + local `.env.ingest`)

- [ ] **Step 1: Set env vars on the cpo-connect-hub Render service**

Go to Render dashboard → cpo-connect-hub service → Environment → Add:

- `ANTHROPIC_API_KEY` = (production Anthropic key)
- `ADMIN_EMAILS` = `erik@theaiexpert.ai` (comma-separated list if needed)
- `INGEST_API_KEY` = a new long random hex string. Generate with:
  ```bash
  openssl rand -hex 32
  ```
  Copy the value, paste into Render, then **also** paste into a local
  `.env.ingest` file in `cpo-connect-hub/` (make sure it's gitignored)
  so the monthly ingestion script can authenticate.

Confirm that `GEMINI_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `MAGIC_LINK_BASE_URL`, `RESEND_API_KEY` are already set.

- [ ] **Step 2: Trigger a manual deploy**

In Render dashboard → cpo-connect-hub → Manual Deploy → Deploy latest commit.

- [ ] **Step 3: Verify the migrations run in prod logs**

Tail the Render log:
- Look for `Migrations complete`
- No SQL errors

- [ ] **Step 4: Smoke test prod**

Open https://cpo-connect-hub.onrender.com, log in, navigate to What's Everyone Talking About, click an evergreen tile.

Expected: answer appears within 3 seconds. Source cards populated from the bootstrapped corpus (which only exists locally right now — for prod to have data, see the note below).

**IMPORTANT:** The bootstrap ingestion in Task 31 ran against the *local* DB via the dev server. The shared Postgres instance is the *same* instance used by prod (per the Global CLAUDE.md — shared `truth_tone` instance). So the data is already in prod. No extra ingestion step needed. Verify by running a query in prod and confirming sources appear.

If prod uses a different DB: re-run Task 31 pointing at the prod `DATABASE_URL`.

No commit — deploy/ops only.

---

### Task 34: Final plan wrap-up commit

**Files:**
- None

- [ ] **Step 1: Push all commits to the feature branch**

```bash
git push -u origin spec/whats-everyone-talking-about
```

- [ ] **Step 2: Confirm the branch is on GitHub**

```bash
gh pr list --head spec/whats-everyone-talking-about
```

If a PR already exists for the spec, this PR #19 now also contains the full implementation. If no PR exists, don't create one unless the executor is explicitly asked — per the dispatch protocol, the spec + plan go in together for review before implementation.

---

## Self-Review

**Spec coverage (post codex review feedback):**
- Vision (catch-up / historical Q&A / cross-channel) — ✅ covered by `POST /api/chat/ask` + `WhatsTalked.tsx`
- Design principles (read-only, members-only, monthly ingest, names by default/opt-out, stateless, channel-aware, local embed) — ✅ all covered
- Architecture runtime flow with rate limit + failure mapping + privacy logging — ✅ Task 8
- Architecture ingestion flow with dual auth + per-route body limit + per-msg sourceExport — ✅ Tasks 10 (endpoint) + 15 (script)
- Migration idempotency (I1) — ✅ Tasks 2 and 3 use `IF NOT EXISTS` throughout
- Express body limit (I2) — ✅ Task 10 Step 5 mounts `express.json({ limit: '50mb' })` on the ingest route only
- Admin middleware chain (I3) — ✅ Task 7 (`requireAdmin` uses `req.user.email`, composes with `requireAuth`), Task 10 (`requireIngestAuth` delegates to `requireAdmin` for cookie path)
- Correct file paths (I4) — ✅ Task 26 uses `src/components/Navbar.tsx` and `src/App.tsx`
- Rate limit on ask endpoint (I5) — ✅ Task 8 uses `createRateLimiter` with 10/min + 100/hr
- Privacy / query logging redaction (I6) — ✅ Tasks 3 (migration), 8 (logging code), 25 (notice), 28 (profile toggle)
- Failure modes on ask (I7) — ✅ Task 4 (`EmbeddingUnavailableError`), Task 5 (`SynthesisUnavailableError` + 20s timeout), Task 8 (error mapping to 503)
- N1 EDITABLE_FIELDS updated — ✅ Task 28 Step 1
- N2 chatChannels.ts scoped to WETA — ✅ Task 16 (spec + plan both note marketing page stays untouched)
- Dual auth with `INGEST_API_KEY` (B2) — ✅ Task 10 (`requireIngestAuth.ts` + tests)
- Per-message `sourceExport` (B1) — ✅ Task 10 (validation) + Task 15 (script populates it)
- Components frontend new — ✅ Tasks 16–25
- Components frontend modified — ✅ Tasks 26–28
- Components backend new — ✅ Tasks 2–12
- Local script — ✅ Tasks 13–15
- Admin UI — ✅ Task 29
- Data model — ✅ Tasks 2–3
- API endpoints — ✅ Tasks 8–12
- Admin role — ✅ Task 7 (`requireAdmin`) + Task 10 (`requireIngestAuth`)
- Frontend design — ✅ Tasks 16, 24, 25, 28, 29
- State management — ✅ Tasks 17, 25
- Environment variables — ✅ Task 33 (includes INGEST_API_KEY generation)
- Gemini embedding details — ✅ Task 4 + Task 14
- Security + privacy — ✅ Tasks 7, 8, 10 (dual auth), 12 (reference auth gate), 28 (opt-outs)
- Phase 1 scope items 1–10 — ✅ all mapped
- Success criteria — ✅ validated in Task 32 QA list (now includes rate-limit test and redacted event check)

**Placeholder scan:** No TBD, TODO, or "similar to Task N" placeholders.
Every code block is complete.

**Type consistency:** `ChatSource`, `ChatAnswer`, `IngestionRun`,
`PromptTile`, `SynthesisSource`, `SynthesisInput`,
`EmbeddingUnavailableError`, `SynthesisUnavailableError` are defined once
and reused. `author_email` / `triggered_by_email` naming consistent
across migration 009, chat.ts router, ingest endpoint, and admin
endpoints. `X-Ingest-Key` header name consistent between
`requireIngestAuth.ts` and the ingestion script.

**Still open for Erik:**
1. **`INGEST_API_KEY` generation is a manual step.** The plan says to run
   `openssl rand -hex 32` and paste into Render env vars + local
   `.env.ingest`. The executor cannot do this autonomously. Flag when
   the PR is ready.
2. **Admin email list.** `ADMIN_EMAILS` needs to be set in Render with
   Erik's real email (currently the plan uses `erik@theaiexpert.ai` as
   an example).

---

## Task Count

**34 tasks** organized into 8 phases. TDD-first on every backend
service and middleware. Frequent commits. No placeholder content.

Task 10 (ingest endpoint) was expanded to include the new
`requireIngestAuth` middleware + tests + per-route body limit mount to
avoid renumbering; the task is larger than average but still
self-contained.
