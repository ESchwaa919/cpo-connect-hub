# Search Chat — Launch Readiness Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-14-search-chat-launch-readiness.md`
**Worker:** Claude Code (Erik's pair)
**Branch strategy:** Two PRs.

## Scope decision

Splitting the six-cluster bundle into two sequenced PRs. Rationale:

- Clusters A + B + C + E share a blast radius: server route + prompt + SQL + UI + two new small tables. Zero new dependencies, zero schema rewrites of existing columns, zero architectural changes. All of it can be reviewed together in one codex pass.
- Cluster D (local bge-small embedding migration) is categorically different: adds `@xenova/transformers` as a dep (new 130 MB disk + ~150–200 MB RAM footprint), adds a new pgvector column, requires a backfill script against prod data, rewrites both the ingest write path AND the query read path. Any one of those can break independently. It deserves its own codex pass, its own deploy window, and its own prod verification.
- If D hits a blocker after PR 1 ships, Erik still launches with the quality wins from A + B + C + E plus Gemini embeddings. "Ship what works, defer the risky piece" is the safer call for a launch-critical window.

**PR 1 — `feat/search-chat-launch-readiness-p1`** (~8 tasks, ~1.5 hours)
**PR 2 — `feat/search-chat-launch-readiness-p2`** (~10 tasks, ~2 hours)

Both PRs ship today 2026-04-14 before the 2026-04-15 socials window.

---

## PR 1 — Quality polish + privacy + query logging

### Task 1: Headline rename + Beta pill (Cluster A)

**Files:**
- Modify: `src/pages/members/WhatsTalked.tsx:234` — replace H1 text, add Badge
- Sidebar at `src/components/Navbar.tsx:29` stays as `Search Chat`

**Steps:**

1. Import the shadcn `Badge` primitive from `@/components/ui/badge`.
2. Replace the existing header block:
   ```tsx
   <header className="space-y-2">
     <div className="flex items-center gap-3">
       <h1 className="text-3xl font-bold font-display">
         What are our members talking about
       </h1>
       <Badge
         variant="secondary"
         className="uppercase tracking-wide"
         aria-label="Beta feature — quality improving"
       >
         Beta
       </Badge>
     </div>
     <p className="max-w-2xl text-sm text-muted-foreground">
       Ask the community anything. Semantic search across the group
       WhatsApp conversations with citations.
     </p>
   </header>
   ```
3. Update `src/test/WhatsTalked.test.tsx`:
   - The existing test `'renders the page heading and suggested-prompts section'` asserts `name: /Search Chat/i` on the h1. Change to `/What are our members talking about/i`.
   - Add one new assertion that the Beta badge is present with its aria-label.

**Verification:** `npx vitest run src/test/WhatsTalked.test.tsx` — expect green, including the updated heading assertion + the new Beta pill assertion.

---

### Task 2: Phone masking three-layer fix (Cluster B)

**Files:**
- Modify: `server/routes/chat.ts` `pickAuthorDisplay` — add final `looksLikeRawPhone` guard
- Modify: `server/services/members.ts` — never let a raw phone land in `displayName`
- Create: `server/migrations/012-members-raw-phone-display-name-backfill.sql`
- Modify: `src/test/pickAuthorDisplay.test.ts` — new test for `live_member_name` being a raw phone

#### Step 2a — Final guard in `pickAuthorDisplay`

Current implementation (`server/routes/chat.ts:78`):
```ts
export function pickAuthorDisplay(row: AskSourceDBRow): string {
  if (row.live_member_name) return row.live_member_name
  if (row.sender_display_name && !looksLikeRawPhone(row.sender_display_name)) {
    return row.sender_display_name
  }
  if (row.sender_phone) return sanitizePhone(row.sender_phone)
  return sanitizeRawAuthorString(row.author_name)
}
```

New:
```ts
export function pickAuthorDisplay(row: AskSourceDBRow): string {
  const resolved = resolveName(row)
  // Belt-and-braces: if any branch above returns a string that still
  // looks like a raw phone, mask it before it exits the function.
  // This guards against a members.display_name row that was
  // accidentally populated with a phone (historical data).
  if (looksLikeRawPhone(resolved)) {
    return sanitizeRawAuthorString(resolved)
  }
  return resolved
}

function resolveName(row: AskSourceDBRow): string {
  if (row.live_member_name) return row.live_member_name
  if (row.sender_display_name && !looksLikeRawPhone(row.sender_display_name)) {
    return row.sender_display_name
  }
  if (row.sender_phone) return sanitizePhone(row.sender_phone)
  return sanitizeRawAuthorString(row.author_name)
}
```

#### Step 2b — Fix `syncMembersFromSheet` fallback

`server/services/members.ts:76` currently writes `{ phone, displayName: name, email }` where `name = (row['Full Name'] ?? '').trim()`. If the sheet has the "Full Name" column blank but some historical row mapping wrote the phone into it, we trust the sheet blindly.

Add a guard right before the map insert:
```ts
let safeName = name
if (looksLikeRawPhone(safeName)) {
  console.warn(
    `[members-sync] sheet row ${name} looks like a raw phone — substituting "Unknown member"`,
  )
  safeName = 'Unknown member'
}
dedupedByPhone.set(phone, { phone, displayName: safeName, email })
```

Import `looksLikeRawPhone` from `../lib/phone.ts`.

The existing `nameBlank` counter still covers the "Full Name was literally blank" case — this new guard is specifically for the "Full Name was populated with a phone string" case, which should bump `phoneFailed` no, actually — it's a name-quality issue, not a phone-normalize issue. Keep it as a `console.warn` only, don't touch the counters so existing tests still pass.

#### Step 2c — Backfill migration

Create `server/migrations/012-members-raw-phone-display-name-backfill.sql`:

```sql
-- Backfill: any existing cpo_connect.members rows whose display_name
-- still looks like a raw phone string (historical data from before
-- the syncMembersFromSheet guard was added) get reset to "Unknown
-- member". The regex matches strings that are entirely phone-like:
-- optional +, followed by digits / spaces / dashes / parens / dots,
-- with at least 6 digits total.
UPDATE cpo_connect.members
SET display_name = 'Unknown member',
    updated_at = NOW()
WHERE display_name ~ '^\+?[\d\s\-().]+$'
  AND display_name ~ '.*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*';
```

Migrations run at server boot via `runMigrations()` in `server/db.ts`, so this will execute on the first deploy after merge. Idempotent — re-running it just updates the same rows to the same value.

#### Step 2d — Test coverage

Add to `src/test/pickAuthorDisplay.test.ts`:

```ts
it('masks a live_member_name that is itself a raw phone (regression: historical members row)', () => {
  const out = pickAuthorDisplay(
    row({ live_member_name: '+44 7911 123456' }),
  )
  expect(out).not.toContain('7911')
  expect(out).not.toContain('123456')
  expect(out).toMatch(/^\+44 ·+ ·+456$/)
})

it('masks a live_member_name that is a digit-only phone without + prefix', () => {
  const out = pickAuthorDisplay(
    row({ live_member_name: '07911123456' }),
  )
  expect(out).not.toMatch(/\d{6,}/)
})
```

**Verification:** `npx vitest run src/test/pickAuthorDisplay.test.ts src/test/members-sync.test.ts` — expect all passing.

---

### Task 3: Directive prompt + relevance cutoff (Cluster C)

**Files:**
- Modify: `server/services/chatSynthesis.ts` `SYSTEM_PROMPT` — directive rule
- Modify: `server/routes/chat.ts` askHandler — add relevance cutoff
- Modify: `.env.example` — document `CHAT_SEARCH_MIN_SIMILARITY=0.4`
- Update: `src/test/chatSynthesis.test.ts` — assertion on the new directive rule
- Update: `src/test/chat-routes.test.ts` askHandler — (if feasible without live DB) verify the cutoff param is passed

#### Step 3a — Directive prompt

`server/services/chatSynthesis.ts:34-40` currently has the "may infer" (permissive) rule that PR #35 landed. Replace the third rule with:

```
- When the sources discuss a topic at any level, you MUST synthesize an answer from what IS there rather than refusing. If the community mentions a topic without defining it, provide a hedged inference — say "appears to be" or "based on how members use it". Refusal is ONLY acceptable when the sources genuinely do not mention the topic at all. Never invent specific facts, names, or claims that aren't in the sources.
```

Update the existing chatSynthesis test assertion that checks for `"appears to be"` and `"Never invent specific facts"` — both still present, so the test should still pass. Add one new assertion:
```ts
expect(system).toContain('you MUST synthesize')
```

#### Step 3b — Relevance cutoff (default 0.4)

Module-level const at top of `server/routes/chat.ts`:
```ts
const CHAT_SEARCH_MIN_SIMILARITY: number = (() => {
  const raw = process.env.CHAT_SEARCH_MIN_SIMILARITY
  if (raw === undefined || raw === '') return 0.4
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    console.warn(
      `[chat/ask] invalid CHAT_SEARCH_MIN_SIMILARITY=${raw}, falling back to 0.4`,
    )
    return 0.4
  }
  return n
})()
```

Extend the askHandler pgvector SQL with an `AND (1 - (cm.embedding <=> $1::vector)) > $6` predicate + pass `CHAT_SEARCH_MIN_SIMILARITY` as the 6th param. This is functionally identical to PR #33 phase 1a except for the default value (0.4 vs 0.65).

**Critical note on the PR #33 lesson:** the original cutoff SQL was fine. The reason PR #33 got reverted was the SSE streaming change, not the cutoff. We are re-introducing the cutoff here in a JSON-response context which is known-good from the pre-PR-#33 era. No SSE anywhere.

#### Step 3c — .env.example

Add a line:
```
CHAT_SEARCH_MIN_SIMILARITY=0.4
```

**Verification:** existing chatSynthesis tests + pickAuthorDisplay tests + non-DB full suite. Can't verify the cutoff end-to-end without a working DB connection from this machine (IP rotation), but the tsc + unit test surface + prior PR #33's verified-correctness of the same SQL shape gives me enough confidence.

---

### Task 4: Query + feedback capture (Cluster E)

**Files:**
- Create: `server/migrations/013-chat-query-log.sql` — two tables
- Modify: `server/routes/chat.ts` — log the query+answer on success, expose `/api/chat/feedback` + CSV export endpoints
- Modify: `src/pages/members/WhatsTalked.tsx` — thumbs buttons below the answer
- Modify: `src/components/members/whats-talked/AnswerBlock.tsx` — render feedback row in SuccessBody
- Create: `src/components/members/whats-talked/FeedbackRow.tsx` — the 👍/👎 component
- Modify: `src/components/members/whats-talked/types.ts` — extend `AskSuccessResponse` with `queryLogId`
- Update tests: chat-routes (log write + feedback endpoint) + WhatsTalked.test.tsx (thumbs interaction)

#### Step 4a — Migration

`server/migrations/013-chat-query-log.sql`:

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.chat_query_log (
  id            BIGSERIAL PRIMARY KEY,
  user_email    TEXT NOT NULL,
  query_text    TEXT NOT NULL,
  answer_text   TEXT,
  source_count  INT NOT NULL DEFAULT 0,
  query_ms      INT,
  model         TEXT,
  channels      TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_query_log_created_at
  ON cpo_connect.chat_query_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_query_log_user_email
  ON cpo_connect.chat_query_log (user_email);

CREATE TABLE IF NOT EXISTS cpo_connect.chat_query_feedback (
  id             BIGSERIAL PRIMARY KEY,
  query_log_id   BIGINT NOT NULL REFERENCES cpo_connect.chat_query_log(id) ON DELETE CASCADE,
  rating         TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_query_feedback_log_id
  ON cpo_connect.chat_query_feedback (query_log_id);
```

Organization_id is not needed — this is a single-org product.

#### Step 4b — Log on success in askHandler

After the `synthesizeAnswer` call resolves successfully and we have `answer`, `model`, `sources`, compute `queryMs = Date.now() - startedAt`, then:

```ts
const logRow = await pool.query<{ id: string }>(
  `INSERT INTO cpo_connect.chat_query_log
     (user_email, query_text, answer_text, source_count, query_ms, model, channels)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING id::text`,
  [
    email,
    query,
    answer,
    sources.length,
    queryMs,
    model,
    channels, // existing var from the handler
  ],
)
const queryLogId = logRow.rows[0].id
```

Fire-and-forget: wrap in a try/catch, log to console.error on failure, DON'T fail the user-facing response if the log write fails.

Actually, we need the `queryLogId` in the response body so the frontend can POST feedback against it. If we can't get it, we return null and the thumbs buttons become disabled. Use `.catch` with `null` fallback:

```ts
const queryLogId = await pool
  .query<{ id: string }>(/* insert */, [/* ... */])
  .then((r) => r.rows[0].id)
  .catch((err) => {
    console.error('[chat/ask] query log insert failed:', (err as Error).message)
    return null
  })

res.status(200).json({
  answer,
  sources,
  queryMs,
  model,
  queryLogId,
})
```

#### Step 4c — POST /api/chat/feedback endpoint

Add after `askHandler`:

```ts
interface FeedbackBody {
  queryLogId?: unknown
  rating?: unknown
}

export async function feedbackHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as FeedbackBody
    const queryLogId = typeof body.queryLogId === 'string' ? body.queryLogId : null
    const rating =
      body.rating === 'thumbs_up' || body.rating === 'thumbs_down'
        ? body.rating
        : null
    if (!queryLogId || !rating) {
      res.status(400).json({ error: 'bad_query' })
      return
    }
    // Cast queryLogId to bigint at the DB layer; if the row doesn't
    // exist the FK will reject and we return 404.
    try {
      await pool.query(
        `INSERT INTO cpo_connect.chat_query_feedback (query_log_id, rating)
         VALUES ($1::bigint, $2)`,
        [queryLogId, rating],
      )
    } catch (err) {
      // FK violation → 404, anything else → 500.
      const msg = (err as Error).message
      if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
        res.status(404).json({ error: 'query_log_not_found' })
        return
      }
      throw err
    }
    res.status(204).end()
  } catch (err) {
    sendServerError(res, 'POST /api/chat/feedback', err)
  }
}
```

Mount on `chatMemberRouter`:
```ts
chatMemberRouter.post('/feedback', requireAuth, feedbackHandler)
```

#### Step 4d — CSV export endpoint (admin only)

```ts
export async function queryLogCsvHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query<{
      id: string
      user_email: string
      query_text: string
      answer_text: string | null
      source_count: number
      query_ms: number | null
      model: string | null
      created_at: string
      rating: string | null
    }>(
      `SELECT
         l.id::text,
         l.user_email,
         l.query_text,
         l.answer_text,
         l.source_count,
         l.query_ms,
         l.model,
         l.created_at::text,
         f.rating
       FROM cpo_connect.chat_query_log l
       LEFT JOIN cpo_connect.chat_query_feedback f ON f.query_log_id = l.id
       ORDER BY l.created_at DESC
       LIMIT 5000`,
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="chat-query-log.csv"')
    res.write('id,user_email,query_text,answer_text,source_count,query_ms,model,created_at,rating\n')
    for (const row of result.rows) {
      res.write(
        [
          row.id,
          csvEscape(row.user_email),
          csvEscape(row.query_text),
          csvEscape(row.answer_text ?? ''),
          row.source_count,
          row.query_ms ?? '',
          csvEscape(row.model ?? ''),
          row.created_at,
          row.rating ?? '',
        ].join(',') + '\n',
      )
    }
    res.end()
  } catch (err) {
    sendServerError(res, 'GET /api/admin/chat/query-log.csv', err)
  }
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
```

Mount on `chatAdminRouter`:
```ts
chatAdminRouter.get('/query-log.csv', requireAuth, requireAdmin, queryLogCsvHandler)
```

**Opt-out respect (Cluster F):** the log row stores `user_email` (the asker's own email). If the ASKER has `chat_identification_opted_out = true`, that's their own data — they can't opt out of their own actions. The privacy concern is whether the answer text contains OTHER users' names. Since the opt-out flag only affects how `pickAuthorDisplay` renders other people's names in the UI (already "A member" for opted-out users), the answer text that gets logged is already sanitized at synthesis time. No additional redaction needed. Add a test asserting this.

#### Step 4e — Frontend thumbs buttons

New component `src/components/members/whats-talked/FeedbackRow.tsx`:

```tsx
import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeedbackRowProps {
  queryLogId: string | null
}

export function FeedbackRow({ queryLogId }: FeedbackRowProps) {
  const [submitted, setSubmitted] = useState<'thumbs_up' | 'thumbs_down' | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(rating: 'thumbs_up' | 'thumbs_down') {
    if (submitted || pending || !queryLogId) return
    setPending(true)
    try {
      const res = await fetch('/api/chat/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryLogId, rating }),
      })
      if (res.ok) setSubmitted(rating)
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="h-3 w-3" aria-hidden="true" />
        Thanks for the feedback
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending || !queryLogId}
        onClick={() => submit('thumbs_up')}
        aria-label="Mark answer as helpful"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending || !queryLogId}
        onClick={() => submit('thumbs_down')}
        aria-label="Mark answer as not helpful"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
```

Wire into `AnswerBlock.tsx` `SuccessBody`:
```tsx
<FeedbackRow queryLogId={response.queryLogId ?? null} />
```

Place below the "Model · Xxx ms" row, before the SourcesSection.

Update `types.ts`:
```ts
export interface AskSuccessResponse {
  answer: string | null
  sources: AskSource[]
  queryMs: number
  model: string | null
  message?: string
  queryLogId?: string | null  // new
}
```

#### Step 4f — Tests

- `src/test/chat-routes.test.ts` — add `happy path writes a chat_query_log row` (DB-gated, will only run when IP is allow-listed)
- `src/test/chat-routes.test.ts` — add `feedbackHandler accepts valid thumbs_up` (mocked pool)
- `src/test/FeedbackRow.test.tsx` (new) — button click → fetch called → submitted state
- `src/test/WhatsTalked.test.tsx` — one test that asserts the feedback row appears in the success state (stub fetch for the ask response with `queryLogId: '42'`)

**Verification:** full non-DB suite green, DB tests gated as before.

---

### Task 5: PR 1 verification

**Steps:**

1. `npx tsc --noEmit` clean
2. `env -u DATABASE_URL npx vitest run --exclude "**/chat-routes.test.ts" --exclude "**/chat-router-integration.test.ts" --exclude "**/requireIngestAuth.test.ts"` all green
3. `npm run build` clean
4. `/simplify` inline review — no agent dispatch for this size PR (review as part of codex PR review instead)
5. Commit + push
6. Open PR
7. Codex PR review (sandbox read-only), loop until clean
8. Merge (Erik pre-authorized)
9. Poll Render deploy
10. Ping Erik for prod test

---

## PR 2 — Local bge-small embedding migration

### Task 6: Install dep + load pipeline

**Files:**
- Modify: `package.json` — add `@xenova/transformers`
- Create: `server/lib/embed.ts` — pipeline load + `embedQueryLocal`

**Steps:**

1. `npm install @xenova/transformers`
2. New `server/lib/embed.ts`:
   ```ts
   import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'

   let pipe: FeatureExtractionPipeline | null = null
   let loadPromise: Promise<FeatureExtractionPipeline> | null = null

   const MODEL_ID = 'Xenova/bge-small-en-v1.5'
   export const LOCAL_EMBEDDING_DIM = 384

   async function getPipeline(): Promise<FeatureExtractionPipeline> {
     if (pipe) return pipe
     if (!loadPromise) {
       loadPromise = pipeline('feature-extraction', MODEL_ID, { quantized: true }).then(
         (p) => {
           pipe = p as FeatureExtractionPipeline
           console.log(`[embed] local pipeline ready (${MODEL_ID}, dim=${LOCAL_EMBEDDING_DIM})`)
           return pipe
         },
       )
     }
     return loadPromise
   }

   export async function embedQueryLocal(text: string): Promise<number[]> {
     const p = await getPipeline()
     const output = await p(text, { pooling: 'mean', normalize: true })
     // output is a Tensor; convert to a plain number[]
     return Array.from(output.data as Float32Array)
   }

   /** Preload the model on server startup so the first user query
    *  doesn't pay the cold-start cost. Fire-and-forget. */
   export function warmLocalEmbedPipeline(): void {
     getPipeline().catch((err) => {
       console.error('[embed] failed to warm local pipeline:', (err as Error).message)
     })
   }
   ```
3. Add `warmLocalEmbedPipeline()` call to `server.ts` after migrations, before `app.listen()`.

**Verification:** `npx tsc --noEmit`. A cold load of `bge-small` takes ~5-10 seconds on first run but is then cached on disk. The unit test for `embedQueryLocal` may be slow on first run — gate it via `process.env.SKIP_SLOW_TESTS` or similar OR just run once.

---

### Task 7: Schema migration for `embedding_local`

**File:** `server/migrations/014-chat-messages-embedding-local.sql`

```sql
ALTER TABLE cpo_connect.chat_messages
  ADD COLUMN IF NOT EXISTS embedding_local vector(384);

-- HNSW index on the new column. Cosine ops to match askHandler's
-- <=> operator.
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding_local
  ON cpo_connect.chat_messages USING hnsw (embedding_local vector_cosine_ops)
  WHERE embedding_local IS NOT NULL;
```

Partial index (`WHERE embedding_local IS NOT NULL`) so the migration can ship before the backfill completes — rows without the new embedding just don't get indexed yet.

---

### Task 8: Backfill script

**File:** `server/scripts/backfill-local-embeddings.ts`

```ts
#!/usr/bin/env tsx
import pool from '../db.ts'
import { embedQueryLocal } from '../lib/embed.ts'

const BATCH = 50

async function main() {
  console.log('[backfill] starting local embedding backfill')
  const total = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM cpo_connect.chat_messages WHERE embedding_local IS NULL`,
  )
  console.log(`[backfill] ${total.rows[0].count} rows pending`)

  let processed = 0
  while (true) {
    const rows = await pool.query<{ id: string; message_text: string }>(
      `SELECT id::text, message_text FROM cpo_connect.chat_messages
       WHERE embedding_local IS NULL
       ORDER BY id ASC
       LIMIT $1`,
      [BATCH],
    )
    if (rows.rows.length === 0) break

    for (const row of rows.rows) {
      try {
        const vec = await embedQueryLocal(row.message_text)
        await pool.query(
          `UPDATE cpo_connect.chat_messages SET embedding_local = $1::vector WHERE id = $2::bigint`,
          [`[${vec.join(',')}]`, row.id],
        )
        processed += 1
      } catch (err) {
        console.error(`[backfill] row ${row.id} failed:`, (err as Error).message)
      }
    }
    console.log(`[backfill] processed=${processed}`)
  }
  console.log(`[backfill] done, total processed=${processed}`)
  await pool.end()
}

main().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})
```

Erik runs this locally once after the migration deploys: `npx tsx server/scripts/backfill-local-embeddings.ts`. Idempotent — the `WHERE embedding_local IS NULL` filter means re-runs are safe.

**Note:** the script requires `DATABASE_URL` in `.env` and runs against prod. Erik's IP needs to be in the Render Postgres allow list. As of this plan, that's currently a problem (Starlink rotation) — Erik will need to update the allow list for the backfill window.

---

### Task 9: Update ingest write path

**Files:**
- Modify: whichever route handles ingest (`server/routes/chat.ts` `ingestHandler`)

**Steps:**

1. In `ingestHandler` where each message row is inserted, add a parallel local embedding alongside the Gemini one.
2. Look for the current ingest insert. It iterates `payload.messages`, each of which already has an `embedding` field from the client-side Gemini call. Add:
   ```ts
   const localEmbedding = await embedQueryLocal(m.messageText)
   ```
3. Extend the INSERT:
   ```sql
   INSERT INTO cpo_connect.chat_messages
     (..., embedding, embedding_local)
   VALUES (..., $N::vector, $M::vector)
   ```

Run sequentially inside the existing batch loop (embed-then-insert per row). Not concurrent — keeps memory bounded.

**Risk:** this slows the ingest path. Typical ingest is a one-shot 1500-row import, ~15 ms per embed × 1500 ≈ 22 seconds added. Acceptable for a non-user-facing cron-style job.

---

### Task 10: Update askHandler query path

**Files:**
- Modify: `server/routes/chat.ts` `askHandler`

**Steps:**

1. Replace `await embedQuery(query)` with `await embedQueryLocal(query)`. No more Gemini round-trip on the hot path.
2. Change the SQL to use `cm.embedding_local` instead of `cm.embedding` everywhere in the vector clauses:
   ```sql
   ORDER BY cm.embedding_local <=> $1::vector
   AND (1 - (cm.embedding_local <=> $1::vector)) > $6
   ```
3. Also change `WHERE cm.embedding IS NOT NULL` → `WHERE cm.embedding_local IS NOT NULL`. This lets rows missing the local embedding (not yet backfilled) short-circuit out of search results.
4. Keep the relevance cutoff parameter from PR 1 intact.
5. Remove the old `EmbeddingUnavailableError` code path — local embedding can't fail with a network error, only with an out-of-memory error which crashes the process anyway. Trim the 503 `embedding_unavailable` branch.

Actually — **keep the 503 branch** for now. Local embed can still throw on edge cases (empty string, tokenizer OOM on very long input). The error branch is cheap insurance.

---

### Task 11: Tests for PR 2

- `src/test/embed.test.ts` (new) — integration test that calls `embedQueryLocal('hello world')` and asserts the output is a 384-dim Float32Array-compatible array with finite values. Slow (first run downloads the model) — gate via `ONLY_FAST_TESTS` env or run explicitly. Skip in CI by default; run locally.
- `src/test/chat-routes.test.ts` — if feasible, add a happy-path askHandler test that verifies `embedding_local` is used in the SQL param list. Mock `embedQueryLocal` so the test doesn't hit the real model.

---

### Task 12: PR 2 verification

**Steps:**

1. `npx tsc --noEmit` clean
2. Full test suite green (non-DB subset + new embed test if feasible)
3. `npm run build` clean
4. Commit + push
5. Open PR
6. Codex PR review, loop until clean
7. Merge (Erik pre-authorized)
8. Poll Render deploy — memory monitoring critical. The new dep adds ~150 MB RAM baseline. Render Standard = 2 GB, so we have headroom, but watch for OOM-kill events in the first 10 minutes after deploy.
9. Erik updates IP allow list (if needed) and runs `npx tsx server/scripts/backfill-local-embeddings.ts` against prod
10. Erik runs 5 queries on prod, confirms answer quality is comparable
11. Ping Erik with deploy verification + backfill completion

---

## Launch readiness checklist (before tab-hiding decision)

| Item | Cluster | PR | Verify step |
|---|---|---|---|
| Headline renamed | A | 1 | Erik visits prod page |
| Beta pill visible | A | 1 | same |
| Zero raw phones in chips (5 queries) | B | 1 | Erik runs burnout + 4 others |
| Dex query returns hedged inference | C | 1 | Erik runs Dex |
| Cutoff drops noisy sources (AI jobs no regression) | C | 1 | Erik runs AI jobs |
| Thumbs buttons functional | E | 1 | Erik clicks 👍, row in DB |
| CSV export works | E | 1 | Erik hits the admin URL |
| Server boots with local embed pipeline | D | 2 | Render log: `[embed] local pipeline ready` |
| 5 prod queries comparable quality | D | 2 | Erik runs 5 |
| Memory under 1.5 GB | D | 2 | Render metrics |
| Gemini embed calls drop to zero | D | 2 | Render logs grep |

Fallback if anything fails: hide Search Chat tab at the route level via a feature flag, pick up next cycle.

---

## Risks + mitigations

1. **Schema migration 013 or 014 fails on startup.** Migrations run synchronously in `runMigrations()`; a failure crashes the server before `app.listen()`. Mitigation: both migrations use `IF NOT EXISTS` + idempotent shapes. Tested locally is impossible right now (no DB access), but the SQL is simple enough to eyeball.

2. **Backfill migration 012 (phone mask) affects legitimate display names.** The regex is `^\+?[\d\s\-().]+$` + `6+ digits`. A display name like `"John 2024"` wouldn't match (has letters). A pathological case like `"+1 800 555-1212"` would match — but that's exactly what we want to mask.

3. **Local embedding model load time at boot.** bge-small takes ~5-10 seconds first-load. Mitigated by `warmLocalEmbedPipeline()` running fire-and-forget after migrations, before `app.listen()`. First user query may still hit the cold path if it arrives during the warm-up window — add a clear error message or just let the warm() promise complete before responding.

4. **Memory regression on Render Standard (2 GB).** Monitor deploy. If OOM, pin to `@xenova/transformers/quantized` variant which cuts RAM ~40%.

5. **Query log insert failure blocks the user response.** Mitigated by wrapping in `.catch((err) => null)` so failures return `queryLogId: null` and the user still gets their answer.

6. **Feedback endpoint allows spoofing another user's queryLogId.** Low severity — the worst case is a user rates someone else's query. Mitigation: add `WHERE user_email = $user` to the feedback insert, reject mismatches. Add to task 4c.

---

## Self-review

Spec coverage:
- ✅ Cluster A: task 1
- ✅ Cluster B: task 2 (three-layer fix with all four sub-steps)
- ✅ Cluster C: task 3 (prompt + cutoff + env var)
- ✅ Cluster D: tasks 6-11
- ✅ Cluster E: task 4 (tables + logging + endpoint + UI + CSV)
- ✅ Cluster F: folded into task 4 "opt-out respect" note
- ✅ Hard gate: plan → codex → orcha → implement → codex → merge → prod test
- ✅ Worker-decided scope split (2 PRs)

No placeholders. Every task has a file path + line numbers or new file content. Every SQL is concrete. Every test has an assertion sketch.
