# What's Everyone Talking About — Design Spec

**Date:** 2026-04-10
**Status:** Approved (brainstorm complete)
**Author:** Erik + Rune
**Target:** CPO Connect Hub members area

---

## Vision

**"What's Everyone Talking About"** is a search-first interface in the CPO Connect members area that lets logged-in members ask natural language questions about the community's WhatsApp conversations and get synthesized answers with cited sources.

It becomes the hero feature of the members area, replacing static monthly chat insight pages as the default landing. Monthly summaries remain as deep-dive archives under a separate nav item.

**Three use cases:**
- **Catch-up** — "What did I miss this week in Leadership?"
- **Historical Q&A** — "What have people said about Claude Code this year?"
- **Cross-channel memory** — "Has anyone ever mentioned Gamma AI?"

## Design Principles

1. **Read-only.** No writing back to WhatsApp.
2. **Members-only.** Login-gated. Shares the existing session auth.
3. **Monthly manual ingestion.** No real-time updates. Erik runs a local script when new WhatsApp exports are available.
4. **Honest attribution.** Names by default, per-member opt-out via profile toggle.
5. **Stateless queries.** Each question stands alone. No conversational follow-up in Phase 1.
6. **Channel-aware.** Members pick which channel(s) to search. Extensible to new channels.
7. **Local embedding, server query.** Heavy batch embedding happens on Erik's laptop during ingestion. Per-query embedding happens on the server at runtime.

---

## Architecture

### Runtime Flow (member query)

```
member types question
  → POST /api/chat/ask { query, channel?, dateFrom?, dateTo? }
  → session middleware (members-only)
  → log query to events table
  → Gemini Embedding 2 Preview embeds query (768 dims)
  → pgvector semantic search on chat_messages (filtered by channel if specified)
  → load top-K messages (default 12) + join member_profiles for opt-out handling
  → Claude Sonnet 4.5 synthesizes answer with citation markers
  → return { answer, sources[], queryMs, model }
```

### Ingestion Flow (monthly, local)

```
Erik downloads WhatsApp export zips to ~/Projects/CPO Connect/
Erik runs: npx tsx scripts/ingest-whatsapp.ts --month 2026-04
  → script parses the three zips (AI, General, Leadership & Culture)
  → script filters to the target month only
  → script calls Gemini batch API to embed all new messages
  → script POSTs to /api/admin/chat/ingest (authenticated)
  → server validates admin session
  → server deduplicates by content hash
  → server inserts into chat_messages + writes to chat_ingestion_runs
  → server regenerates prompt tiles (optional LLM call to identify trending topics)
  → script regenerates monthly summary HTML and saves to reference/chat-analysis-<month>.html
  → script git add / commit / push the summary file
  → script reports ingested/skipped counts
```

### Components

**Frontend (new):**
- `src/pages/members/WhatsTalked.tsx` — the page
- `src/components/members/whats-talked/WhatsTalkedHero.tsx` — hero with search + tiles
- `src/components/members/whats-talked/ChannelTabs.tsx` — channel filter tabs
- `src/components/members/whats-talked/PromptTile.tsx` — clickable suggestion tile
- `src/components/members/whats-talked/AskForm.tsx` — search input
- `src/components/members/whats-talked/AnswerPanel.tsx` — synthesized answer renderer
- `src/components/members/whats-talked/SourceCard.tsx` — individual source message card
- `src/components/members/whats-talked/EmptyState.tsx` — no-results state
- `src/constants/chatChannels.ts` — channel config constant (the one place channels are defined)

**Frontend (modified):**
- `src/pages/members/Profile.tsx` — add **both** `chat_identification_opted_out`
  and `chat_query_logging_opted_out` toggles
- `src/components/Navbar.tsx` — the nav link list is here (`memberLinks`
  constant, not in `MembersLayout.tsx`). Add "What's Everyone Talking About",
  rename "Chat Insights" to "Monthly Summaries". `MembersLayout.tsx` is a
  layout wrapper with no navigation — untouched by WETA.
- `src/pages/members/ChatInsights.tsx` — deleted; replaced by new
  `MonthlySummaries.tsx` that links to `reference/chat-analysis-*.html`
- `src/App.tsx` — the router lives here (there is no `src/pages/App.tsx`).
  Add routes for `/members/whats-talked`, `/members/summaries`,
  `/members/admin/chat-ingest`. Change the `/members` default redirect
  from `/members/chat-insights` to `/members/whats-talked`.
- `server/routes/members.ts` — extend `EDITABLE_FIELDS` whitelist so the
  existing `PUT /api/members/profile` endpoint can persist the two new
  opt-out booleans. Without this, the profile toggles silently no-op on save.
- `server.ts` — mount the chat router AND an auth-gated static mount for
  `/reference/` so `MonthlySummaries.tsx`'s archive links resolve.

**Backend (new):**
- `server/routes/chat.ts` — all four new endpoints
- `server/services/chatEmbedding.ts` — wraps Gemini API calls for query embedding
- `server/services/chatSynthesis.ts` — wraps Claude API calls for answer synthesis
- `server/services/authorReconciliation.ts` — fuzzy-match WhatsApp names to member_profiles
- `server/migrations/009_chat_messages.sql` — new tables + extension check
- `server/migrations/010_profile_opt_out.sql` — new column on member_profiles

**Local script (new):**
- `scripts/ingest-whatsapp.ts` — the monthly ingestion pipeline
- `scripts/lib/whatsapp-parser.ts` — parse WhatsApp .txt export format
- `scripts/lib/gemini-batch-embed.ts` — Gemini batch API wrapper

**Admin UI (new):**
- `src/pages/members/admin/ChatIngestionHistory.tsx` — read-only history of ingestion runs
- `src/components/members/admin/IngestionRunCard.tsx` — individual run display

---

## Data Model

### Existing schema confirmed
- ✅ pgvector v0.8.1 enabled on shared Postgres
- ✅ `cpo_connect` schema exists
- ✅ `member_profiles` table exists

### New tables (in `cpo_connect` schema)

> **Migration idempotency:** `server/db.ts` replays every `.sql` file in
> `server/migrations/` on every server boot. Every DDL statement in WETA
> migrations MUST use `IF NOT EXISTS` (tables, indexes, columns). The examples
> below reflect this.

#### `chat_messages`

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,                    -- 'ai' | 'general' | 'leadership_culture'
  author_name TEXT NOT NULL,                -- from WhatsApp export (raw)
  author_email TEXT,                        -- nullable; matched via authorReconciliation (see Phase B)
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  source_export TEXT NOT NULL,              -- filled from the per-message `sourceExport` field
                                            -- in the ingest payload, e.g. 'WhatsApp Chat - CPO Connect __ AI.zip'
  content_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of channel+author+sent_at+text for dedup
  embedding vector(768),                    -- Gemini Embedding 2 Preview
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at
  ON cpo_connect.chat_messages (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel
  ON cpo_connect.chat_messages (channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding
  ON cpo_connect.chat_messages USING hnsw (embedding vector_cosine_ops);
```

**Note on `author_email` (was `author_profile_id UUID` in an earlier draft):**
`cpo_connect.member_profiles` uses `email TEXT` as its primary key, not a UUID.
WETA stores the resolved email (nullable, no hard FK so phone-number-only senders
from the WhatsApp export don't break inserts).

#### `chat_conversations` (created in Phase 1, populated in Phase 2)

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.chat_conversations (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  message_count INT NOT NULL,
  summary TEXT,                             -- LLM-generated paragraph
  topics TEXT[],                            -- extracted topic tags
  embedding vector(768),                    -- summary embedding
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_start
  ON cpo_connect.chat_conversations (start_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_embedding
  ON cpo_connect.chat_conversations USING hnsw (embedding vector_cosine_ops);
```

#### `chat_ingestion_runs`

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.chat_ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  run_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_completed_at TIMESTAMPTZ,
  triggered_by_email TEXT,                  -- nullable; 'script:ingest' for headless API-key runs
  source_months TEXT[],                     -- e.g. ['2026-04']
  messages_ingested INT DEFAULT 0,
  messages_skipped INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',   -- 'running' | 'success' | 'failed'
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_ingestion_runs_started
  ON cpo_connect.chat_ingestion_runs (run_started_at DESC);
```

**Note on `triggered_by_email`:** Same reason as `author_email` above — we
reference the profile by its real PK (`email`), not a non-existent `id` UUID.
For headless ingestion runs (authenticated via `INGEST_API_KEY`), the server
writes the literal string `'script:ingest'` so it's clear the run was not
human-triggered.

#### `chat_prompt_tiles`

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.chat_prompt_tiles (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,                      -- 'current' | 'evergreen'
  channel TEXT,                             -- null = all channels
  title TEXT NOT NULL,
  query TEXT NOT NULL,                      -- the pre-filled search query
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Extensions on existing tables

Two new opt-out flags on `member_profiles`. The columns are separate because
they protect different things: **identification** = "what I said in chat"
(whether my name appears next to retrieved source cards); **query logging** =
"what I ask about in this UI" (whether the events table records my raw
question text).

```sql
ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS chat_identification_opted_out BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS chat_query_logging_opted_out BOOLEAN NOT NULL DEFAULT false;
```

Both default to `false` (opted in) so the feature is legible by default and
can be improved from real usage data. Members can toggle either independently
in the Profile page.

---

## API Endpoints

All endpoints under `server/routes/chat.ts`, mounted at `/api/chat` and `/api/admin/chat`.

### `POST /api/chat/ask`
**Auth:** Member session required (cookie).
**Rate limit:** Per-member, keyed on `req.user.email`. **10 questions per
minute** and **100 per hour** hard caps. Uses the existing
`createRateLimiter` helper from `server/services/rate-limit.ts` (same
pattern as `server/routes/auth.ts`). Over the limit: `429
{error: 'rate_limited', retryAfterSec: <number>}` with a standard
`Retry-After` header. Frontend shows "You're asking too fast — give it a
moment and try again."

**Request:**
```typescript
{
  query: string;             // natural language question, 1-500 chars
  limit?: number;            // top-K to retrieve, default 12, max 30
  channel?: string;          // null = all channels
  dateFrom?: string;         // ISO date, optional
  dateTo?: string;           // ISO date, optional
}
```

**Response (happy path):**
```typescript
{
  answer: string;            // synthesized paragraph(s) with citation markers [1], [2]
  sources: Array<{
    id: string;
    channel: string;
    authorDisplayName: string;  // real name or "A member" if opted out
    authorOptedOut: boolean;
    sentAt: string;             // ISO
    messageText: string;
    similarity: number;         // cosine similarity score 0-1
  }>;
  queryMs: number;
  model: string;             // e.g. 'claude-sonnet-4-5'
}
```

**Failure modes (must be implemented — do not leave as happy-path only):**

| Condition | Status | Response body | Frontend UX |
|---|---|---|---|
| Zero vector matches | `200` | `{answer: null, sources: [], message: 'No relevant chat history found for this question'}` | Empty state component |
| Gemini rate limit / 5xx | `503` | `{error: 'embedding_unavailable', retryAfterSec: 30}` | Toast: "Search is briefly busy, try again in a moment" |
| Claude timeout (>20s) or 5xx | `503` | `{error: 'synthesis_unavailable'}` | Toast: "Couldn't generate an answer right now, please try again" |
| DB unreachable / query error | `500` | `{error: 'internal'}` | Toast: "Something went wrong" |
| Over per-member rate limit | `429` | `{error: 'rate_limited', retryAfterSec: N}` | Toast: "You're asking too fast — give it a moment" |
| Query missing / too long (>500) | `400` | `{error: 'bad_query'}` | Inline form error |

Claude calls must use a 20-second client-side timeout. Gemini calls have the
SDK default. Both services must be wrapped so the ask handler can catch and
map the error to the right response above.

**Flow:**
1. `requireAuth` middleware validates the member (`req.user.email` is set)
2. Per-member rate-limit check (`createRateLimiter`). Over limit → 429
3. **Privacy-aware event logging** (fire-and-forget, never blocks): read
   `member_profiles.chat_query_logging_opted_out` for the member (cached
   per-request). If opted in, log `{event: 'chat_query', email,
   metadata: {query, channel, limit}}`. If opted out, log
   `{event: 'chat_query_redacted', email, metadata: {char_count,
   channel, limit}}` — no query text, no answer text.
4. Embed query via `chatEmbedding.ts` (Gemini, 768 dims). Catch errors →
   503 `embedding_unavailable`.
5. `SELECT ... FROM chat_messages LEFT JOIN member_profiles ... WHERE
   (channel = $1 OR $1 IS NULL) AND (sent_at BETWEEN $2 AND $3 OR $2 IS
   NULL) ORDER BY embedding <=> $4 LIMIT $5`
6. If zero rows returned → respond 200 with empty-state shape above.
7. Swap `authorDisplayName` to "A member" when
   `chat_identification_opted_out = true`.
8. Build Claude prompt: system message explains role (community knowledge
   synthesizer), context includes retrieved messages with `[N]` markers,
   user message is the original query.
9. Call Claude Sonnet 4.5 with a 20-second timeout. Catch errors → 503
   `synthesis_unavailable`.
10. Return answer + sources.

### `GET /api/chat/prompt-tiles?channel=<name>`
**Auth:** Member session required.

**Response:**
```typescript
{
  current: Array<{ id: string; title: string; query: string }>;    // from DB, updated monthly
  evergreen: Array<{ id: string; title: string; query: string }>;  // from DB, static
}
```

Returns tiles filtered by channel (null channel = tiles that work for all channels).

### `POST /api/admin/chat/ingest`
**Auth:** **Either** (a) admin session cookie + `requireAdmin` middleware, **or**
(b) a valid `X-Ingest-Key: <INGEST_API_KEY>` header verified via
`crypto.timingSafeEqual`. Path (b) is how the local script authenticates
headlessly (no browser cookie is ever present on the CLI).

**Body limit:** This route mounts its own `express.json({ limit: '50mb' })`
instance. The global `express.json()` in `server.ts` uses the default ~100KB
limit, which is enough for every other endpoint. A single month of 3
channels worth of 768-dim float embeddings is several MB — one month can
run 5–15MB. 50MB gives headroom and still protects against runaway payloads.

```typescript
// server.ts (sketch)
import chatRouter from './server/routes/chat.ts'
app.use('/api/chat', chatRouter) // uses global express.json()

// The admin ingest route mounts its own express.json for larger payloads:
app.use('/api/admin/chat/ingest', express.json({ limit: '50mb' }))
```

**Request:**
```typescript
{
  month: string;                // 'YYYY-MM' — primarily for source_months audit
  sourceExports: string[];      // filenames for run-level audit (redundant with per-message)
  messages: Array<{
    channel: string;            // 'ai' | 'general' | 'leadership_culture'
    authorName: string;
    messageText: string;
    sentAt: string;             // ISO
    sourceExport: string;       // REQUIRED — the specific zip this message came from
                                // (different channels live in different zips in one run)
    embedding: number[];        // 768-dim array, already computed by the script
  }>;
  promptTiles?: Array<{
    scope: 'current' | 'evergreen';
    channel?: string;
    title: string;
    query: string;
  }>;
}
```

The per-message `sourceExport` field is required because one ingestion run
processes multiple zip files (one per channel). The server writes this value
verbatim into `chat_messages.source_export`, which is `NOT NULL`. A
missing or empty `sourceExport` on a message causes that message to be
skipped (counted in `skipped`), not to fail the whole run.

**Response:**
```typescript
{
  runId: number;
  ingested: number;
  skipped: number;
  durationMs: number;
}
```

**Flow:**
1. Auth: if the request has a valid admin session cookie, use the cookie
   path. Otherwise, if `X-Ingest-Key` matches `INGEST_API_KEY` via
   `crypto.timingSafeEqual`, authenticate as the synthetic identity
   `'script:ingest'`. Otherwise `401`.
2. Create `chat_ingestion_runs` row with `status = 'running'`. The
   `triggered_by_email` column is the member email for cookie auth or the
   literal string `'script:ingest'` for API-key auth.
3. For each message in the payload:
   - Validate: `sourceExport` non-empty, `embedding.length === 768`, `sentAt` parseable.
   - Compute `content_hash = sha256(channel || author || sent_at || text)`.
   - `INSERT ... ON CONFLICT (content_hash) DO NOTHING`. Count ingested vs skipped.
4. If `promptTiles` provided: `DELETE FROM chat_prompt_tiles WHERE scope =
   'current'` then bulk insert.
5. Update `chat_ingestion_runs` with final counts + `status = 'success'`
   (or `'failed'` + `error_message` on error).
6. Return the run summary.

### `GET /api/admin/chat/ingestion-runs`
**Auth:** Admin role required.

**Response:**
```typescript
{
  runs: Array<{
    id: number;
    runStartedAt: string;
    runCompletedAt: string | null;
    triggeredBy: string;        // profile display name
    sourceMonths: string[];
    messagesIngested: number;
    messagesSkipped: number;
    status: 'running' | 'success' | 'failed';
    errorMessage: string | null;
  }>;
  totalMessages: number;        // current corpus size across all channels
  latestMessageAt: string;      // most recent sent_at
}
```

---

## Admin Role

Phase 1 approach: hardcoded admin email list in a Render env var, checked by
a dedicated `requireAdmin` middleware that runs **after** the existing
`requireAuth` middleware. The existing auth attaches the member to
`req.user` (see `server/middleware/auth.ts`), not `req.session` — the
admin check reads `req.user.email`.

```
ADMIN_EMAILS=erik@theaiexpert.ai,other@example.com
```

Middleware code (actual implementation, used as the reference in the plan):

```typescript
// server/middleware/requireAdmin.ts
import type { Request, Response, NextFunction } from 'express'

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
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
  const admins = getAdminEmails()
  if (!admins.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ error: 'Admin access required', code: 'not_admin' })
    return
  }
  next()
}
```

Admin endpoints compose the two middlewares: `requireAuth → requireAdmin`.

```typescript
// server/routes/chat.ts (sketch)
router.get('/ingestion-runs', requireAuth, requireAdmin, handler)
```

### Headless auth for the ingest endpoint (`INGEST_API_KEY`)

The local ingestion script cannot set a `cpo_session` cookie — there's no
CLI login flow. For `POST /api/admin/chat/ingest` specifically, a second
auth path accepts a long-lived API key in the `X-Ingest-Key` header.

```typescript
// server/middleware/requireIngestAuth.ts (sketch)
import { timingSafeEqual } from 'node:crypto'

export function requireIngestAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // 1. Cookie path: if req.user is already set by requireAuth, defer to requireAdmin
  if (req.user) {
    return requireAdmin(req, res, next)
  }
  // 2. Header path
  const header = req.header('x-ingest-key')
  const expected = process.env.INGEST_API_KEY
  if (!header || !expected || header.length !== expected.length) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (!timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Not authenticated', code: 'not_authenticated' })
    return
  }
  // Synthetic identity for run attribution
  req.user = { id: 'script', email: 'script:ingest', name: 'Ingestion Script' }
  next()
}
```

The ingest endpoint mounts `requireIngestAuth` as its sole auth
middleware (it handles both paths). `INGEST_API_KEY` must be a long,
random string (≥32 hex chars, e.g. `openssl rand -hex 32`) set as a
Render env var and a gitignored local `.env.ingest` file. Never committed
to source.

Phase 2 upgrade: proper role column on `member_profiles` + role-based middleware. Not in scope for Phase 1 — YAGNI.

---

## Frontend Design

### Route + navigation

- **New route:** `/members/whats-talked`
- **Default redirect:** `/members` → `/members/whats-talked`
- **Renamed route:** `/members/chat-insights` → `/members/summaries` (the monthly archive)

Nav structure:
```
Members
├── What's Everyone Talking About  (hero, default)
├── Monthly Summaries               (archive, renamed from Chat Insights)
├── Directory
└── Profile
```

### Hero page (before query)

```
┌──────────────────────────────────────────────────────┐
│  What's Everyone Talking About?                      │
│  A quick way to catch up on the community.          │
│                                                      │
│  Search across                                       │
│  [● All 3 channels] [○ AI] [○ General]               │
│  [○ Leadership & Culture]                            │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │ Ask anything about the chats…              │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Right now                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ tile 1   │ │ tile 2   │ │ tile 3   │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                                                      │
│  Always useful                                       │
│  ┌──────────────┐ ┌──────────────┐                  │
│  │ evergreen 1  │ │ evergreen 2  │                  │
│  └──────────────┘ └──────────────┘                  │
└──────────────────────────────────────────────────────┘
```

### Results state (after query submitted)

```
┌──────────────────────────────────────────────────────┐
│  ← Back   "What did people think about Claude Code?" │
│                                                      │
│  Answer                                              │
│  ─────────────────────────────────────────────       │
│  <synthesized 2-4 sentence paragraph from Claude     │
│   with inline citation markers like [1], [2]>        │
│                                                      │
│  Sources (8)                                         │
│  ─────────────────────────────────────────────       │
│  ┌──────────────────────────────────────────────┐   │
│  │ [1] Jane Doe · General · 3 Apr 2026          │   │
│  │ "Just tried Claude Code for the first time   │   │
│  │  today and I'm blown away by the hooks..."   │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ [2] A member · AI · 14 Apr 2026 (opted out)  │   │
│  │ "..."                                        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [ Ask another question ]                            │
└──────────────────────────────────────────────────────┘
```

### Channel config constant

```typescript
// src/constants/chatChannels.ts — WETA-searchable channels only
export const CHAT_CHANNELS = [
  { id: null,                 label: 'All channels',         isAll: true },
  { id: 'ai',                 label: 'AI'                                },
  { id: 'general',            label: 'General'                           },
  { id: 'leadership_culture', label: 'Leadership & Culture'              },
] as const;
```

The "All N channels" label is computed at runtime from the number of
non-`isAll` entries, so adding a fourth channel = one line change.

**Scope:** This constant is the source of truth for **WETA's searchable
channels only**. The marketing-page channel grid in
`src/components/ChannelsSection.tsx` (which shows all 8 community channels
including Jobs, Mentoring, Book Club, etc.) is a separate concern and
stays as-is for Phase 1. Don't try to unify the two — they describe
different things. The insights modules under `src/data/insights/*` also
stay on their current structure; those are archival and will be removed
when the `ChatInsights.tsx` page is replaced by `MonthlySummaries.tsx`.

### Profile page update

New section in `src/pages/members/Profile.tsx` with **two** independent
toggles:

```
┌──────────────────────────────────────────────────┐
│  Privacy — chat analysis                         │
│  ────────────────────────                        │
│  [ toggle ] Hide my name from chat               │
│             analysis results                     │
│                                                  │
│  When enabled, your messages are still           │
│  searchable but attributed as "A member          │
│  said..." instead of with your name.             │
│                                                  │
│  [ toggle ] Don't log my questions               │
│                                                  │
│  When enabled, we'll still count that you        │
│  asked something (for usage stats), but won't    │
│  store the text of your questions.               │
└──────────────────────────────────────────────────┘
```

Both toggles are wired to the existing `PUT /api/members/profile`
endpoint. The backend `EDITABLE_FIELDS` whitelist in
`server/routes/members.ts` must be extended to include
`chat_identification_opted_out` and `chat_query_logging_opted_out` (see
Phase G of the plan). Without that change, the toggles silently no-op on
save.

### Chat page query-logging notice

The WETA hero (`src/pages/members/WhatsTalked.tsx`) displays a small,
understated one-liner below the ask form:

> "We may log the text of your questions to improve this feature. You can
> opt out in your [profile](/members/profile)."

This is the disclosure half of the I6 privacy fix. The toggle in Profile
is the control half. Together they satisfy informed consent without
turning the page into a compliance form.

### Admin ingestion history page

Route: `/members/admin/chat-ingest` (admin-gated)

Read-only list of `chat_ingestion_runs` — status, timestamps, counts, error messages. No action buttons in Phase 1. Ingestion happens via the local script; this page is for monitoring only.

---

## State Management

React Query for async data:
- `useQueryChat(query, filters)` — `POST /api/chat/ask`, cached by `(query, channel, dateFrom, dateTo)` for 5 minutes
- `usePromptTiles(channel)` — `GET /api/chat/prompt-tiles?channel=X`, cached for 1 hour
- `useIngestionRuns()` — `GET /api/admin/chat/ingestion-runs`, admin page only

URL state:
- Selected channel stored in `?channel=<id>` search param (shareable, survives refresh)
- Active query stored in `?q=<query>` search param when a query is active
- URL-driven so back button works naturally

---

## Environment Variables

### Local (`.env` in cpo-connect-hub)
- `ANTHROPIC_API_KEY` ✅ already configured
- `GEMINI_API_KEY` ✅ just added
- `DATABASE_URL` ✅ already configured

### Render (cpo-connect-hub service)
- `ANTHROPIC_API_KEY` — needs to be set (for server-side synthesis)
- `GEMINI_API_KEY` ✅ already added per Erik
- `ADMIN_EMAILS` — comma-separated list of admin email addresses (case-insensitive)
- `INGEST_API_KEY` — long random hex string (`openssl rand -hex 32`)
  used by the local ingestion script to authenticate against
  `POST /api/admin/chat/ingest` via the `X-Ingest-Key` header. **Flag
  for manual setup** when the implementation PR is ready — Erik must
  generate and paste this into Render and into his local
  `.env.ingest` file.

### Local (gitignored)
- `.env.ingest` — holds `INGEST_API_KEY` for the local script. Must
  be added to `.gitignore` if not already covered by the existing `.env*`
  pattern. Never committed.

---

## Gemini Embedding Details

- **Model:** `gemini-embedding-2-preview`
- **Tier:** Paid (to avoid "used for training" on member data)
- **Dimensions:** 768 (sweet spot, recommended by Google)
- **Max input tokens:** 8,192 per call
- **Batch API:** Used during ingestion (50% discount, async)
- **Task instruction:** Embedded in the content (new model doesn't use `task_type` param). For ingestion: "Represent this community chat message for semantic search." For queries: "Represent this search query for retrieving relevant community chat messages."

**Cost estimate:** ~$0.25 for a full year of corpus embedding. Negligible.

---

## Security + Privacy

1. **Login-gated** — both member and admin endpoints require valid session
2. **Admin role** — admin endpoints gated by `ADMIN_EMAILS` env var check,
   headless ingest additionally supports `INGEST_API_KEY` via
   `timingSafeEqual`
3. **Identification opt-out honored at query time** — names stripped in both
   the Claude prompt AND the source cards returned to the frontend when
   `chat_identification_opted_out = true`
4. **Query logging opt-out** — when `chat_query_logging_opted_out = true`,
   the `events` row for a `chat_query` records only `{char_count, channel,
   limit}` under a `chat_query_redacted` event name. No question text, no
   answer text. Default is opted in (legible) so the feature can be
   improved from real usage data; the toggle is discoverable in Profile
   and disclosed on the chat page.
5. **Rate limiting** — per-member limit on `/api/chat/ask` (10/min,
   100/hr) prevents spam against Claude/Gemini and DDoS of the vector
   search
6. **No data to Google for training** — paid Gemini tier
7. **No public URLs** — no unauthenticated routes return chat content;
   `/reference/*.html` is mounted behind `requireAuth`
8. **Secrets in Render env vars only** — never in source. `.env*` files
   gitignored; `INGEST_API_KEY` only in Render + gitignored local
   `.env.ingest`

---

## Implementation Phasing

### Phase 1 — Ship it (this scope)
1. DB migrations (pgvector check, new tables, profile opt-out column)
2. Local ingestion script
3. Backend endpoints (ask, prompt-tiles, admin ingest, admin runs)
4. Author reconciliation (fuzzy match WhatsApp names to member profiles)
5. Frontend page + tabs + search + answer + source display
6. Profile opt-out toggle
7. Admin ingestion history page (read-only)
8. First ingestion run: Jan–Mar 2026 to bootstrap the corpus
9. Manual QA with test queries
10. Deploy to Render, smoke test on production

### Phase 2 — Quality layer
1. `chat_conversations` population (conversation clustering, LLM summaries, embed summaries)
2. Hybrid retrieval (conversations first, expand to messages on demand)
3. Per-channel prompt tiles (monthly regenerated based on trending topics)
4. `/cpo:monthly-update` skill that automates the full monthly ritual

### Phase 3 — Polish
1. Conversational follow-up questions
2. Personalized "my catch-up" view (since member's last visit)
3. Shareable answer links
4. Export answer as email

---

## Out of Scope

- Writing back to WhatsApp
- Real-time ingestion from WhatsApp Business API
- Image / audio / video ingestion (even though Gemini Embedding 2 supports multimodal — text-only for Phase 1)
- Cross-community federation
- Public / unauthenticated access
- Non-CPO Connect tenant isolation (this is a single-tenant app)

---

## Success Criteria

Phase 1 is done when:
- An ingestion run successfully populates `chat_messages` with 3 months of bootstrap data
- A logged-in member can ask "what did people say about Claude Code?" and get a coherent answer with 5+ cited sources
- The channel tabs actually filter the search
- A member can toggle opt-out in Profile and their name disappears from source cards
- The admin page shows the ingestion run history
- Query response time is under 3 seconds p95
- No regressions to the existing Directory, Profile, or Monthly Summaries pages

---

## Related Work

- **Monthly summary files** continue to live in `reference/chat-analysis-*.html` (per the consolidation done in PR #18)
- **`reference/general.html`** is unrelated to monthly summaries and stays untouched
- **Legacy repo** `ESchwaa919/cpo-connect-ai-chat` is archived and should not be modified
- **CLAUDE.md in repo root** documents the reference directory and deprecated repo
