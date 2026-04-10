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
- `src/pages/members/Profile.tsx` — add `chat_identification_opted_out` toggle
- `src/components/members/MembersLayout.tsx` — add "What's Everyone Talking About" nav link, rename "Chat Insights" to "Monthly Summaries"
- `src/pages/members/ChatInsights.tsx` — repurposed as monthly archive index (links to `reference/chat-analysis-*.html`)
- `src/pages/App.tsx` (or router config) — default `/members` → `/members/whats-talked`

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

#### `chat_messages`

```sql
CREATE TABLE cpo_connect.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,                    -- 'ai' | 'general' | 'leadership_culture'
  author_name TEXT NOT NULL,                -- from WhatsApp export
  author_profile_id UUID,                   -- FK to member_profiles (nullable)
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  source_export TEXT NOT NULL,              -- e.g. 'whatsapp-chat-ai-2026-04.zip'
  content_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of channel+author+sent_at+text for dedup
  embedding vector(768),                    -- Gemini Embedding 2 Preview
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_sent_at ON cpo_connect.chat_messages (sent_at DESC);
CREATE INDEX idx_chat_messages_channel ON cpo_connect.chat_messages (channel);
CREATE INDEX idx_chat_messages_embedding ON cpo_connect.chat_messages
  USING hnsw (embedding vector_cosine_ops);
```

#### `chat_conversations` (created in Phase 1, populated in Phase 2)

```sql
CREATE TABLE cpo_connect.chat_conversations (
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

CREATE INDEX idx_chat_conversations_start ON cpo_connect.chat_conversations (start_at DESC);
CREATE INDEX idx_chat_conversations_embedding ON cpo_connect.chat_conversations
  USING hnsw (embedding vector_cosine_ops);
```

#### `chat_ingestion_runs`

```sql
CREATE TABLE cpo_connect.chat_ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  run_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_completed_at TIMESTAMPTZ,
  triggered_by_profile_id UUID REFERENCES cpo_connect.member_profiles(id),
  source_months TEXT[],                     -- e.g. ['2026-04']
  messages_ingested INT DEFAULT 0,
  messages_skipped INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',   -- 'running' | 'success' | 'failed'
  error_message TEXT
);

CREATE INDEX idx_chat_ingestion_runs_started ON cpo_connect.chat_ingestion_runs (run_started_at DESC);
```

#### `chat_prompt_tiles`

```sql
CREATE TABLE cpo_connect.chat_prompt_tiles (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,                      -- 'current' | 'evergreen'
  channel TEXT,                             -- null = all channels
  title TEXT NOT NULL,
  query TEXT NOT NULL,                      -- the pre-filled search query
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Extension on existing table

```sql
ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN chat_identification_opted_out BOOLEAN NOT NULL DEFAULT false;
```

---

## API Endpoints

All endpoints under `server/routes/chat.ts`, mounted at `/api/chat` and `/api/admin/chat`.

### `POST /api/chat/ask`
**Auth:** Member session required.

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

**Response:**
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

**Flow:**
1. Session middleware validates the member
2. Log to `events` table (fire-and-forget)
3. Embed query via `chatEmbedding.ts` (Gemini, 768 dims)
4. `SELECT ... FROM chat_messages WHERE (channel = $1 OR $1 IS NULL) AND (sent_at BETWEEN $2 AND $3 OR $2 IS NULL) ORDER BY embedding <=> $4 LIMIT $5`
5. Join against `member_profiles` for opt-out status, swap names to "A member" where applicable
6. Build Claude prompt: system message explains role (community knowledge synthesizer), context includes retrieved messages with `[id]` markers, user message is the original query
7. Call Claude Sonnet 4.5
8. Return answer + sources

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
**Auth:** Admin role required (see Admin Role section below).

**Request:**
```typescript
{
  month: string;                // 'YYYY-MM'
  sourceExports: string[];      // filenames for audit
  messages: Array<{
    channel: string;
    authorName: string;
    messageText: string;
    sentAt: string;             // ISO
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
1. Admin auth check
2. Create `chat_ingestion_runs` row with `status = 'running'`
3. For each message: compute `content_hash`, attempt insert with `ON CONFLICT (content_hash) DO NOTHING`, track ingested vs skipped counts
4. If `promptTiles` provided: `DELETE FROM chat_prompt_tiles WHERE scope = 'current'` then bulk insert
5. Update `chat_ingestion_runs` with final counts + `status = 'success'` (or `'failed'` on error)
6. Return summary

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

Phase 1 approach: hardcoded admin email list in Render env var.

```
ADMIN_EMAILS=erik@theaiexpert.ai,other@example.com
```

Middleware checks `req.session.email` against the list. Non-admins get 403 on `/api/admin/*` routes.

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
// src/constants/chatChannels.ts
export const CHAT_CHANNELS = [
  { id: null,                 label: 'All 3 channels',       isAll: true },
  { id: 'ai',                 label: 'AI'                                },
  { id: 'general',            label: 'General'                           },
  { id: 'leadership_culture', label: 'Leadership & Culture'              },
] as const;
```

The "All N channels" label computes N from the number of non-`isAll` entries, so adding a fourth channel = one line change.

### Profile page update

New section in `src/pages/members/Profile.tsx`:

```
┌────────────────────────────────────────────┐
│  Privacy                                   │
│  ────────────                              │
│  [ toggle ] Hide my name from chat         │
│             analysis results               │
│                                            │
│  When enabled, your messages are still     │
│  searchable but attributed as "A member    │
│  said..." instead of with your name.       │
└────────────────────────────────────────────┘
```

Wired to the existing profile update endpoint with the new `chat_identification_opted_out` field.

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
- `ADMIN_EMAILS` — comma-separated list of admin email addresses

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
2. **Admin role** — new endpoints gated by `ADMIN_EMAILS` env var check
3. **Opt-out honored at query time** — names stripped in both the Claude prompt AND the source cards returned to the frontend
4. **No data to Google for training** — paid Gemini tier
5. **No public URLs** — no unauthenticated routes return chat content
6. **Secrets in Render env vars only** — never in source

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
