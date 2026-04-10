import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5'
const CLAUDE_TIMEOUT_MS = 20_000
const ERROR_CODE = 'synthesis_unavailable' as const

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

export class SynthesisUnavailableError extends Error {
  readonly code = ERROR_CODE
  constructor(cause: string) {
    super(`${ERROR_CODE}: ${cause}`)
    this.name = 'SynthesisUnavailableError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
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

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') {
      return block.text
    }
  }
  return ''
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

  return { answer: extractText(response.content), model: response.model }
}
