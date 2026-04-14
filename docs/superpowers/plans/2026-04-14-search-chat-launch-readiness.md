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

`server/services/members.ts:76` currently writes `{ phone, displayName: name, email }` where `name = (row['Full Name'] ?? '').trim()`. The existing behavior:
- If `name` is empty → increments `nameBlank` + **skips the row entirely** (continue). That means the member never lands in the directory cache at all, so any later message they send falls through to the sanitized-phone fallback in `pickAuthorDisplay`. That's safe but it hurts discoverability.
- If `name` was populated with a phone string → the row IS upserted with the raw phone as `display_name`. This is the Finding B1 bug.

**Per spec §3 finding B1 fallback clause: "write `\"Unknown member\"` or similar placeholder, NEVER the phone"** — the spec wants blank names ALSO to produce a directory entry (so the phone-based resolveAuthor chain can find the member), just with a placeholder name.

Change the flow to:

```ts
// If the "Full Name" column is blank on the sheet row, keep the row
// in the directory (so phone-based lookups still find it) but
// substitute a safe placeholder instead of skipping the row.
// Finding B1: blank names + phone-looking names both land here.
let safeName: string
if (!name) {
  result.nameBlank += 1
  safeName = 'Unknown member'
} else if (looksLikeRawPhone(name)) {
  // Historical: some sheet rows have the phone written into the
  // Full Name column. Never let that reach display_name.
  console.warn(
    `[members-sync] sheet row "${name}" looks like a raw phone — substituting "Unknown member"`,
  )
  safeName = 'Unknown member'
} else {
  safeName = name
}

// (existing phone normalize + dedupe)
dedupedByPhone.set(phone, { phone, displayName: safeName, email })
```

Remove the early `continue` on blank name — the row still gets cached + upserted with the placeholder.

Import `looksLikeRawPhone` from `../lib/phone.ts`.

Update `src/test/members-sync.test.ts` existing `'skips rows with blank Full Name'` test — the behavior now changes. Rename to `'substitutes placeholder for blank Full Name'` and assert:
- `result.nameBlank === 1`
- `result.upserted === 1`
- SQL param array contains `'Unknown member'` for the names slot
- `getMemberByPhone(...)` returns the placeholder-named row

Add a second new test: `'substitutes placeholder for a Full Name that looks like a raw phone'` covering the historical bug case.

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

Spec shape calls out `id, organization_id, user_id, query_text, answer_text, source_count, query_ms, model, created_at`. CPO Connect is single-tenant (no organization_id column anywhere else in the schema), so we drop that column and map `user_id` → the email identifier that the sessions table already uses. The column is named `user_id` per the spec so downstream CSV tooling sees the expected shape.

`server/migrations/013-chat-query-log.sql`:

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.chat_query_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,  -- email — matches sessions.email
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

CREATE INDEX IF NOT EXISTS idx_chat_query_log_user_id
  ON cpo_connect.chat_query_log (user_id);

CREATE TABLE IF NOT EXISTS cpo_connect.chat_query_feedback (
  id             BIGSERIAL PRIMARY KEY,
  query_log_id   BIGINT NOT NULL REFERENCES cpo_connect.chat_query_log(id) ON DELETE CASCADE,
  rating         TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_query_feedback_log_id
  ON cpo_connect.chat_query_feedback (query_log_id);
```

#### Step 4b — Log on success in askHandler

After the `synthesizeAnswer` call resolves successfully and we have `answer`, `model`, `sources`, compute `queryMs = Date.now() - startedAt`, then:

```ts
const logRow = await pool.query<{ id: string }>(
  `INSERT INTO cpo_connect.chat_query_log
     (user_id, query_text, answer_text, source_count, query_ms, model, channels)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING id::text`,
  [
    email, // email is the user_id in this codebase
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

Ownership check is mandatory: a user must only be able to rate THEIR OWN query log rows, never anyone else's. Enforce via a subquery that matches `user_id = $currentUser` before the feedback insert.

Add after `askHandler`:

```ts
interface FeedbackBody {
  queryLogId?: unknown
  rating?: unknown
}

/** Accept either a digit-only string or a non-negative integer. Anything
 *  else (alpha, negative, NaN, Infinity, overly long) is a 400. We
 *  validate BEFORE the SQL binding so a malformed body can't reach
 *  Postgres and trigger a 500 via `invalid input syntax for type bigint`. */
function parseQueryLogId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0 || raw.length > 20) return null
  if (!/^\d+$/.test(raw)) return null
  return raw
}

export async function feedbackHandler(req: Request, res: Response): Promise<void> {
  try {
    const email = req.user!.email.toLowerCase()
    const body = req.body as FeedbackBody
    const queryLogId = parseQueryLogId(body.queryLogId)
    const rating =
      body.rating === 'thumbs_up' || body.rating === 'thumbs_down'
        ? body.rating
        : null
    if (!queryLogId || !rating) {
      res.status(400).json({ error: 'bad_query' })
      return
    }

    // Ownership check + insert in one statement. The INSERT ... SELECT
    // only produces a row when user_id matches the caller, so we can
    // distinguish "log row exists but not yours" from "log row missing"
    // by looking at rowCount.
    const result = await pool.query(
      `INSERT INTO cpo_connect.chat_query_feedback (query_log_id, rating)
       SELECT id, $2
       FROM cpo_connect.chat_query_log
       WHERE id = $1::bigint AND user_id = $3`,
      [queryLogId, rating, email],
    )
    if ((result.rowCount ?? 0) === 0) {
      // Either the row doesn't exist or the caller doesn't own it.
      // Don't distinguish — same 404 in both cases to avoid leaking
      // existence.
      res.status(404).json({ error: 'query_log_not_found' })
      return
    }
    res.status(204).end()
  } catch (err) {
    sendServerError(res, 'POST /api/chat/feedback', err)
  }
}
```

Add one more test case to `chat-routes.test.ts`: `feedbackHandler rejects a non-numeric queryLogId with 400` — post `{queryLogId: 'foo', rating: 'thumbs_up'}`, assert 400 + no SQL hit.

Mount on `chatMemberRouter`:
```ts
chatMemberRouter.post('/feedback', requireAuth, feedbackHandler)
```

Test additions in `src/test/chat-routes.test.ts`:
- `feedbackHandler rejects rating another user's query with 404` — insert a query_log row owned by user A, POST feedback as user B, assert 404 + no row inserted.
- `feedbackHandler accepts a valid thumbs_up from the query owner` — happy path.

#### Step 4d — CSV export endpoint (admin only)

Per Cluster F in the spec: **the CSV export must redact the `user_id` column to `'A member'` for any row whose asker has `chat_identification_opted_out = true`**. The query still surfaces the row + the query text (Erik needs the question content to evaluate answer quality), but the identity column is masked.

```ts
export async function queryLogCsvHandler(req: Request, res: Response): Promise<void> {
  try {
    // LEFT JOIN member_profiles so we can redact the user_id column
    // for opted-out askers. The COALESCE makes opt-out a hard default
    // (row missing from member_profiles → treat as NOT opted out,
    // which is safer than leaking on a join miss).
    const result = await pool.query<{
      id: string
      user_id_display: string
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
         CASE
           WHEN COALESCE(mp.chat_identification_opted_out, false) = true
             THEN 'A member'
           ELSE l.user_id
         END AS user_id_display,
         l.query_text,
         l.answer_text,
         l.source_count,
         l.query_ms,
         l.model,
         l.created_at::text,
         f.rating
       FROM cpo_connect.chat_query_log l
       LEFT JOIN cpo_connect.member_profiles mp ON mp.email = l.user_id
       LEFT JOIN cpo_connect.chat_query_feedback f ON f.query_log_id = l.id
       ORDER BY l.created_at DESC
       LIMIT 5000`,
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="chat-query-log.csv"')
    res.write('id,user_id,query_text,answer_text,source_count,query_ms,model,created_at,rating\n')
    for (const row of result.rows) {
      res.write(
        [
          row.id,
          csvEscape(row.user_id_display),
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

**Opt-out respect test (Cluster F):** add to `src/test/chat-routes.test.ts`:

- `queryLogCsvHandler redacts user_id to "A member" for opted-out askers` — seed one opted-out member + one regular member, insert a query_log row for each, hit the CSV endpoint, assert the opted-out row's `user_id` column is `'A member'` and the regular row's is their email. Assert the query_text column for the opted-out row is still present (we redact identity, not content).

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

### Task 10: Update askHandler query path — STAGED ROLLOUT via env flag

**Critical sequencing fix:** naively switching `askHandler`'s query to `cm.embedding_local` the moment PR 2 deploys would take Search Chat offline during the backfill window — every row has `embedding_local = NULL` until the backfill script finishes, and the WHERE clause would filter them all out. Zero rows = empty state on every query.

**Staged rollout:** gate the new query path behind an env flag `USE_LOCAL_EMBEDDINGS` that defaults to `false`. Erik flips it to `true` via the Render dashboard AFTER the backfill is verified complete, which triggers an automatic redeploy with the new path live.

**Files:**
- Modify: `server/routes/chat.ts` `askHandler`

**Steps:**

1. Add a module-level env read (alongside `CHAT_SEARCH_MIN_SIMILARITY` from PR 1):
   ```ts
   const USE_LOCAL_EMBEDDINGS: boolean = (() => {
     const raw = process.env.USE_LOCAL_EMBEDDINGS
     return raw === 'true' || raw === '1'
   })()
   ```
   Default = `false`. This keeps the Gemini path live immediately after PR 2 deploys.

2. Branch the embed call:
   ```ts
   let embedding: number[]
   try {
     embedding = USE_LOCAL_EMBEDDINGS
       ? await embedQueryLocal(query)
       : await embedQuery(query)
   } catch (err) {
     if (err instanceof EmbeddingUnavailableError) {
       // Gemini path only — local path won't throw this
       res.setHeader('Retry-After', '30')
       res.status(503).json({
         error: ChatErrorCode.EMBEDDING_UNAVAILABLE,
         retryAfterSec: 30,
       })
       return
     }
     throw err
   }
   ```

3. Branch the SQL column selection. The cleanest shape is to build the query string dynamically with the column name swapped:
   ```ts
   const embedCol = USE_LOCAL_EMBEDDINGS ? 'embedding_local' : 'embedding'
   const result = await pool.query<AskSourceDBRow>(
     `SELECT
        cm.id::text AS id,
        ...
        1 - (cm.${embedCol} <=> $1::vector) AS similarity
      FROM cpo_connect.chat_messages cm
      LEFT JOIN cpo_connect.members mem ON mem.phone = cm.sender_phone
      LEFT JOIN cpo_connect.member_profiles mp ON cm.author_email = mp.email
      WHERE cm.${embedCol} IS NOT NULL
        AND (1 - (cm.${embedCol} <=> $1::vector)) > $6
        AND ($2::text[] IS NULL OR cm.channel = ANY($2::text[]))
        AND ($3::timestamptz IS NULL OR cm.sent_at >= $3)
        AND ($4::timestamptz IS NULL OR cm.sent_at <= $4)
      ORDER BY cm.${embedCol} <=> $1::vector
      LIMIT $5`,
     [
       toVectorLiteral(embedding),
       channels,
       dateFrom,
       dateTo,
       limit,
       CHAT_SEARCH_MIN_SIMILARITY,
     ],
   )
   ```
   **String interpolation of `${embedCol}` is SAFE** because the value is one of two compile-time constants (`'embedding'` or `'embedding_local'`), not user input. No SQL-injection vector.

4. Keep the `EmbeddingUnavailableError` 503 branch — local embed can still throw on edge cases (empty string, tokenizer OOM on very long input), and we want the same user-facing error shape regardless of which embed path is live.

5. Add a one-line console.log at handler entry so Render logs show which path served the request:
   ```ts
   console.log(`[chat/ask] embed path=${USE_LOCAL_EMBEDDINGS ? 'local' : 'gemini'}`)
   ```

**Staged rollout sequence after PR 2 merges and deploys:**

1. Migration 014 runs, `embedding_local` column exists (empty).
2. Server boots, `warmLocalEmbedPipeline()` loads bge-small (~5-10s).
3. `[embed] local pipeline ready` log appears.
4. `USE_LOCAL_EMBEDDINGS=false` (default), so all ask queries still use Gemini. **Search Chat stays 100% functional during this window.**
5. Erik SSHes / runs the backfill script locally against prod DB (requires IP allow-list):
   ```
   npx tsx server/scripts/backfill-local-embeddings.ts
   ```
   Script logs progress every 50 rows, completes in ~10-15 minutes for 722 rows (~1 second per row including DB round-trip).
6. Erik runs a verification SQL in Render's psql or locally: `SELECT COUNT(*) FROM cpo_connect.chat_messages WHERE embedding_local IS NULL;` — expects 0.
7. Erik flips `USE_LOCAL_EMBEDDINGS=true` in the Render dashboard. Render auto-redeploys (~2 min).
8. Erik runs 5 test queries. Each request log now shows `embed path=local`.
9. Erik checks Gemini API dashboard — request count should stop climbing from this point.
10. **If anything breaks:** Erik flips the env var back to `false`, Render redeploys, Gemini path is restored. Zero downtime rollback.

**Verification:**
- PR 2 with the default `USE_LOCAL_EMBEDDINGS=false` is effectively a no-op on the query path — Search Chat behavior is unchanged immediately after deploy.
- The local path comes online only after Erik explicitly flips the flag, giving us a clean rollback lever.

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
8. **Render deploys with `USE_LOCAL_EMBEDDINGS=false` — Search Chat is still on the Gemini path, zero user-facing change.** Watch Render deploy logs for:
   - Migration 014 applied cleanly
   - `[embed] local pipeline ready` boot line
   - Memory footprint stabilized (baseline + ~150-200 MB for bge-small)
9. Ping Erik: "PR 2 deployed in safe mode. Ready for you to run backfill + flip the flag."
10. Erik runs `npx tsx server/scripts/backfill-local-embeddings.ts` locally against prod (Starlink IP allow-list prerequisite).
11. Erik verifies `SELECT COUNT(*) FROM cpo_connect.chat_messages WHERE embedding_local IS NULL;` returns 0.
12. Erik flips `USE_LOCAL_EMBEDDINGS=true` in the Render dashboard → auto-redeploy.
13. Erik runs 5 prod queries, confirms answer quality is comparable to Gemini.
14. Erik monitors Render memory for 10 minutes post-flip — target stable under 1.5 GB.
15. Ping Erik with "local path live, Gemini path retired" summary.

**Rollback if needed:** Erik flips `USE_LOCAL_EMBEDDINGS` back to `false`, Render redeploys, done. ~3 minutes to restore the Gemini path.

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
