// Wire-format types for POST /api/chat/ask and GET /api/chat/prompt-tiles.
// Must stay in sync with server/routes/chat.ts (ask + prompt-tiles handlers)
// and server/services/chat-rate-limit.ts (which emits 'rate_limited').

export interface AskSource {
  id: string
  channel: string
  authorDisplayName: string
  authorOptedOut: boolean
  sentAt: string
  messageText: string
  similarity: number
}

export interface AskSuccessResponse {
  answer: string | null
  sources: AskSource[]
  queryMs: number
  model: string | null
  message?: string
}

export type ChatErrorCode =
  | 'bad_query'
  | 'embedding_unavailable'
  | 'synthesis_unavailable'
  | 'rate_limited'
  | 'internal'

export interface ChatErrorResponse {
  error: ChatErrorCode
  retryAfterSec?: number
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

/** Carries the stable error code so UI branches can discriminate on
 *  `err.code` instead of re-parsing response bodies. Optional
 *  `partialAnswer` + `partialSources` preserve the text that streamed
 *  before the SSE `error` event arrived so the UI can surface what
 *  the user already saw instead of flashing blank. */
export class ChatAskError extends Error {
  readonly code: ChatErrorCode
  readonly retryAfterSec?: number
  readonly status: number
  readonly partialAnswer?: string
  readonly partialSources?: AskSource[]
  constructor(
    code: ChatErrorCode,
    status: number,
    retryAfterSec?: number,
    partial?: { answer: string; sources: AskSource[] },
  ) {
    super(code)
    this.name = 'ChatAskError'
    this.code = code
    this.status = status
    this.retryAfterSec = retryAfterSec
    if (partial && partial.answer.length > 0) {
      this.partialAnswer = partial.answer
      this.partialSources = partial.sources
    }
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
