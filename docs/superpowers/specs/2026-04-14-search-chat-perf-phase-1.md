# Search Chat perf phase 1 — relevance cutoff + SSE streaming

**Date:** 2026-04-14
**Author:** Erik Schwartz (brainstorm) → Claude (spec writer)
**Status:** Approved for implementation
**Branch:** `feat/search-chat-perf-phase-1`

## Context

Per `.reports/2026-04-14-search-chat-context.md`, a typical Search Chat request on `/members/whats-talked` lands at ~5100 ms end-to-end. ~88% of that (~4500 ms) is Claude Sonnet 4.5 synthesis — output tokens stream sequentially and the server currently awaits the full response before sending a single byte. Additionally, the pgvector search returns 12 rows regardless of quality; some of those rows have cosine similarity well below the "actually relevant" threshold and waste Claude's input context + time.

Two paired wins land in this PR. Bigger perf work (local embeddings, hybrid search, prompt shrinking, top-N tuning) is deferred to phase 2.

## Goals

1. **Relevance cutoff** — drop sources whose cosine similarity is below a configurable threshold. Fewer low-quality sources → shorter Claude input → faster synthesis + better answer.
2. **SSE streaming** — stream Claude tokens to the browser as they're generated. Dramatically improves perceived latency (TTFB to first visible token drops from ~5100 ms to ~800–1200 ms) without changing total wall-clock latency.

## Non-goals (phase 2)

- Local bge-small embedding migration (kills the Gemini network RTT)
- Hybrid BM25 + vector search
- System prompt shrinkage
- Top-N tuning / learning-to-rank
- Query caching

## Requirement 1 — relevance cutoff

**Config:** Read `process.env.CHAT_SEARCH_MIN_SIMILARITY` at module load. Default `0.65`. Parse as float; fall back to the default on any parse error. Clamp to `[0, 1]`.

**Server change** (`server/routes/chat.ts` askHandler SQL):

```sql
WHERE cm.embedding IS NOT NULL
  AND (1 - (cm.embedding <=> $1::vector)) > $N   -- new
  AND ($2::text[] IS NULL OR cm.channel = ANY($2::text[]))
  AND ...
```

Pass the cutoff as a query parameter, not string-interpolated. Zero rows → existing empty-state path. No frontend control yet — env-driven only. Default `0.65` matches Erik's gut calibration for Gemini-embedding-2-preview on the current corpus.

**Observability:** Log the cutoff value + number of rows dropped at debug-level when a request matches fewer rows than `limit`.

## Requirement 2 — SSE streaming

**Contract — SSE event stream on `POST /api/chat/ask` when the request would have previously returned 200:**

```
event: sources
data: {"sources":[...]}

event: token
data: {"text":"People"}

event: token
data: {"text":" say"}

...

event: done
data: {"model":"claude-sonnet-4-5","queryMs":5123}
```

Terminal states:

- `event: done` — successful completion
- `event: empty` — DB returned zero rows post-cutoff; `data: {"message":"..."}`
- `event: error` — same error codes the old JSON handler returned; `data: {"code":"...", "retryAfterSec":?}`

4xx responses (bad_query, auth) stay as plain JSON — they short-circuit before any streaming begins.

**Headers** on stream open: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no` (belt-and-braces against buffering proxies).

**Server change** (`server/services/chatSynthesis.ts`): add `synthesizeAnswerStream(input)` as an async generator yielding `{kind:'token', text}` or `{kind:'done', model}`. Existing `synthesizeAnswer` stays for the backfill tests that don't need streaming.

**Server change** (`server/routes/chat.ts` askHandler): on the happy path, set SSE headers, write the `sources` event (derived from the DB query), then iterate the Claude stream and write one `token` event per chunk, then `done`. On error inside the stream, write `error` and end the response. On embedding/DB failure before the stream starts, fall through to the existing JSON error path (no partial stream).

**Frontend change** (`src/pages/members/WhatsTalked.tsx`): replace `postAsk` with `streamAsk` that reads the SSE body via `ReadableStream`, parses events, and invokes callbacks `onSources(sources)`, `onToken(text)`, `onDone(model, queryMs)`, `onError(err)`. The React Query `queryFn` accumulates into local `useState` buffers and resolves the query when `done` fires. Error events throw a `ChatAskError` so the existing error-state branches keep working.

**Frontend change** (`src/components/members/whats-talked/AnswerBlock.tsx`): add a new `streaming` discriminant to `AnswerBlockState` carrying `{partialAnswer, sources}`. Render partial answer text with a blinking caret, keep the existing success-state code path for the final answer.

## Backwards compatibility

- Same endpoint, different response content-type on the 200 path. Callers that don't read SSE (curl, tests) must be updated.
- Rate limit unchanged (`chatAskRateLimit`).
- `queryMs` semantics changed: now reported in the `done` event, measured from handler entry to stream close. Frontend still records this in React Query's data.

## Acceptance criteria

1. `CHAT_SEARCH_MIN_SIMILARITY=0.8 curl -v POST /api/chat/ask ...` produces fewer sources than with `0.65`.
2. Browser network tab shows the first `token` event <1200 ms after submit on a typical query.
3. Streaming text appears word-by-word in the Answer card.
4. Error paths (rate limit, embedding_unavailable, synthesis_unavailable, bad_query) still surface their specific error messages in the existing error card.
5. `npx tsc --noEmit` clean, `npm run build` clean, full vitest suite green.
6. Cached re-submission (same query, `staleTime` window) still returns instantly from React Query cache without re-streaming.
7. Default env unset → `0.65` applied. Invalid env value → `0.65` applied + warning logged.
