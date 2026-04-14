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
  /** Server-assigned id for the chat_query_log row, used by the
   *  feedback (thumbs) UI to post a rating against the specific
   *  query. Null if the log insert failed server-side — in that
   *  case the feedback buttons render disabled. */
  queryLogId?: string | null
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
 *  `err.code` instead of re-parsing response bodies. */
export class ChatAskError extends Error {
  readonly code: ChatErrorCode
  readonly retryAfterSec?: number
  readonly status: number
  constructor(
    code: ChatErrorCode,
    status: number,
    retryAfterSec?: number,
  ) {
    super(code)
    this.name = 'ChatAskError'
    this.code = code
    this.status = status
    this.retryAfterSec = retryAfterSec
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
