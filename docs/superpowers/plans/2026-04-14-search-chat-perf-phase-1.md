# Search Chat perf phase 1 — implementation plan

**Goal:** Land both changes from `docs/superpowers/specs/2026-04-14-search-chat-perf-phase-1.md` in a single PR on `feat/search-chat-perf-phase-1`.

**Architecture:** Server-side SQL gets a new scalar param ($N) carrying the similarity cutoff; module-level env parse at load time. Claude synthesis gets an async-generator streaming variant; the existing non-streaming function stays for tests. askHandler switches to SSE on the happy path. Frontend `postAsk` becomes `streamAsk` with a small SSE parser; React Query keeps caching. AnswerBlock gains a `streaming` discriminant.

**Tech stack:** Express 5 `res.write` for SSE; Anthropic SDK's `messages.stream`; browser `ReadableStream` + `TextDecoder` for the client; no new dependencies.

---

## Phase A — Relevance cutoff (small, ship first)

### Task 1: env parse helper + default

**Files:**
- Modify: `server/routes/chat.ts` (new module-level const)

**Steps:**
1. Add at top of `chat.ts`:
   ```ts
   const CHAT_SEARCH_MIN_SIMILARITY: number = (() => {
     const raw = process.env.CHAT_SEARCH_MIN_SIMILARITY
     if (raw === undefined || raw === '') return 0.65
     const n = Number.parseFloat(raw)
     if (!Number.isFinite(n) || n < 0 || n > 1) {
       console.warn(
         `[chat/ask] invalid CHAT_SEARCH_MIN_SIMILARITY=${raw}, falling back to 0.65`,
       )
       return 0.65
     }
     return n
   })()
   ```
2. Run `npx tsc --noEmit` — expect clean.

### Task 2: SQL change

**Files:**
- Modify: `server/routes/chat.ts` askHandler SQL (add param $6)
- Modify: `src/test/chat-routes.test.ts` (any askHandler test that constructs very-low-similarity fixtures may now be filtered out — verify all pass)

**Steps:**
1. Extend the SQL:
   ```sql
   WHERE cm.embedding IS NOT NULL
     AND (1 - (cm.embedding <=> $1::vector)) > $6
     AND ($2::text[] IS NULL OR cm.channel = ANY($2::text[]))
     ...
   LIMIT $5
   ```
   Add `CHAT_SEARCH_MIN_SIMILARITY` as the 6th query parameter.
2. Re-run: `npx vitest run src/test/chat-routes.test.ts -t "askHandler"` — expect green. The existing WETA seed rows have identical vectors so cosine similarity is 1.0 with any constant query vector (above any cutoff).
3. Commit: `feat(chat/ask): filter low-similarity sources via CHAT_SEARCH_MIN_SIMILARITY`.

---

## Phase B — SSE streaming

### Task 3: `synthesizeAnswerStream` async generator

**Files:**
- Modify: `server/services/chatSynthesis.ts` (export a new streaming function)
- Create: `src/test/chatSynthesis.stream.test.ts`

**Steps:**
1. Add new exported type:
   ```ts
   export type SynthesisStreamEvent =
     | { kind: 'token'; text: string }
     | { kind: 'done'; model: string }
   ```
2. Add `synthesizeAnswerStream(input: SynthesisInput): AsyncGenerator<SynthesisStreamEvent>`:
   ```ts
   export async function* synthesizeAnswerStream(
     input: SynthesisInput,
   ): AsyncGenerator<SynthesisStreamEvent, void, unknown> {
     const c = getClient()
     const userMessage = `Question: ${input.query}\n\nSources:\n${formatSources(input.sources)}\n\nWrite a short synthesized answer with [N] citation markers.`
     let stream
     try {
       stream = c.messages.stream(
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

     try {
       for await (const event of stream) {
         if (
           event.type === 'content_block_delta' &&
           event.delta.type === 'text_delta'
         ) {
           yield { kind: 'token', text: event.delta.text }
         }
       }
       const final = await stream.finalMessage()
       if (final.stop_reason !== 'end_turn') {
         throw new SynthesisUnavailableError(
           `Claude returned non-success stop_reason: ${final.stop_reason}`,
         )
       }
       yield { kind: 'done', model: final.model }
     } catch (err) {
       if (err instanceof SynthesisUnavailableError) throw err
       throw new SynthesisUnavailableError((err as Error).message)
     }
   }
   ```
3. Tests cover: yields tokens in order, rejects on non-end_turn stop, rejects on SDK throw.
4. Run: `npx vitest run src/test/chatSynthesis.stream.test.ts` — expect green.

### Task 4: askHandler SSE on happy path

**Files:**
- Modify: `server/routes/chat.ts` askHandler
- Modify: `src/test/chat-routes.test.ts` (rewrite askHandler tests to parse SSE)

**Steps:**
1. Before entering the try block, don't set any content-type. On the success path (after DB query + non-zero rows), set SSE headers and flush:
   ```ts
   res.setHeader('Content-Type', 'text/event-stream')
   res.setHeader('Cache-Control', 'no-cache')
   res.setHeader('X-Accel-Buffering', 'no')
   res.flushHeaders()
   writeSSE(res, 'sources', { sources })
   try {
     for await (const event of synthesizeAnswerStream({ query, sources })) {
       if (event.kind === 'token') writeSSE(res, 'token', { text: event.text })
       else if (event.kind === 'done') writeSSE(res, 'done', { model: event.model, queryMs: Date.now() - startedAt })
     }
   } catch (err) {
     if (err instanceof SynthesisUnavailableError) {
       writeSSE(res, 'error', { code: ChatErrorCode.SYNTHESIS_UNAVAILABLE })
     } else {
       writeSSE(res, 'error', { code: 'internal' })
     }
   }
   res.end()
   ```
2. Add a tiny `writeSSE` helper at the top of the file:
   ```ts
   function writeSSE(res: Response, event: string, data: unknown): void {
     res.write(`event: ${event}\n`)
     res.write(`data: ${JSON.stringify(data)}\n\n`)
   }
   ```
3. Zero-row path: write `event: empty` with the message, then `res.end()`. Skip the Claude call entirely.
4. Error paths before streaming starts (bad_query, embedding_unavailable) keep their existing JSON responses.
5. Tests: capture all `res.write` calls via a mock, parse into events, assert the sequence. Rewrite the existing askHandler integration tests.
6. Run: `npx vitest run src/test/chat-routes.test.ts -t "askHandler"` — expect green.

### Task 5: Frontend SSE parser + streaming hook

**Files:**
- Create: `src/lib/sse-parser.ts` (tiny parser for `event:`/`data:` lines)
- Modify: `src/pages/members/WhatsTalked.tsx` (replace `postAsk` with `streamAsk`)
- Modify: `src/components/members/whats-talked/AnswerBlock.tsx` (add `streaming` state)
- Modify: `src/test/WhatsTalked.test.tsx` (stub SSE response bodies)

**Steps:**
1. `src/lib/sse-parser.ts`: pure function `async function* readSSE(reader, decoder): AsyncGenerator<{event: string, data: any}>`. Reads chunks, buffers, splits on `\n\n`, parses `event:` + `data:` lines.
2. Tests for the parser: partial chunks, multi-event chunks, malformed lines.
3. In `WhatsTalked.tsx`, replace `postAsk` with:
   ```ts
   interface StreamCallbacks {
     onSources(s: AskSource[]): void
     onToken(text: string): void
   }
   async function streamAsk(query, scope, signal, cbs): Promise<AskSuccessResponse> {
     const res = await fetch('/api/chat/ask', {...})
     if (!res.ok) { /* parse JSON error, throw ChatAskError */ }
     if (!res.body) throw new ChatAskError('internal', res.status)
     const reader = res.body.getReader()
     const decoder = new TextDecoder()
     let accumulated = ''
     let sources: AskSource[] = []
     let done: { model: string, queryMs: number } | null = null
     for await (const event of readSSE(reader, decoder)) {
       if (event.event === 'sources') {
         sources = event.data.sources
         cbs.onSources(sources)
       } else if (event.event === 'token') {
         accumulated += event.data.text
         cbs.onToken(event.data.text)
       } else if (event.event === 'done') {
         done = event.data
       } else if (event.event === 'empty') {
         return { answer: null, sources: [], queryMs: 0, model: null, message: event.data.message }
       } else if (event.event === 'error') {
         throw new ChatAskError(event.data.code, 200, event.data.retryAfterSec)
       }
     }
     if (!done) throw new ChatAskError('internal', 200)
     return { answer: accumulated, sources, queryMs: done.queryMs, model: done.model }
   }
   ```
4. Add two refs/state in WhatsTalked:
   - `partialAnswer` (useState, string)
   - `streamingSources` (useState, AskSource[] | null)
   Clear both at the start of each `queryFn` run.
5. Extend `answerState` derivation:
   ```ts
   const isStreaming = askQuery.isFetching && streamingSources !== null
   const answerState: AnswerBlockState =
     ... (existing cases) ...
     : isStreaming
       ? { kind: 'streaming', partialAnswer, sources: streamingSources }
       : askQuery.isFetching
         ? { kind: 'loading' }
         : ...
   ```
6. `AnswerBlock.tsx`: add a new case that renders `partialAnswer` with a pulse/caret, reuses the `SourceChip` row. Focus handling stays on the final `success` transition.
7. Update `WhatsTalked.test.tsx` to mock SSE bodies. `stubFetch` needs a helper that returns `new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(sseText)); controller.close()}}))`.
8. Run: `npx vitest run src/test/WhatsTalked.test.tsx` + `src/test/sse-parser.test.ts` — expect green.
9. Commit: `feat(chat/ask): SSE streaming from Claude synthesis`.

### Task 6: Verify end-to-end

**Steps:**
1. `npx tsc --noEmit` — clean
2. `npx vitest run` — full suite green
3. `npm run build` — clean
4. `/simplify` pass (inline, no agent dispatch for small PR)
5. Commit any simplify fixes
6. Push branch

### Task 7: Open PR + codex loop

**Steps:**
1. `gh pr create` — title `feat: Search Chat perf phase 1 — relevance cutoff + SSE streaming`
2. Body: describes both changes, acceptance criteria, before/after latency estimates
3. `codex exec --sandbox read-only` — full review
4. Fix any FAILs, loop until PASS
5. Merge with squash + delete branch
6. Verify Render deploy
7. Ping Erik in this pane

---

## Risks

- **SSE + React Query**: React Query doesn't natively understand streaming, so the queryFn resolves only at `done`. During streaming the UI must read from a separate state channel (the `partialAnswer` state). Keep this tightly scoped.
- **Buffering proxies**: `X-Accel-Buffering: no` handles nginx; Render's proxy may still buffer short responses. Add a flush after each event via `res.flush?.()` if available.
- **Test rewrite**: The existing askHandler tests assume JSON responses. Rewriting them to SSE is non-trivial but mechanical.
- **Backwards compat with curl / bash scripts**: Any scripted consumer of `/api/chat/ask` will break. There is only one caller (the frontend), so this is acceptable.
