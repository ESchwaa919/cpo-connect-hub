// Parser for WhatsApp iOS `_chat.txt` exports.
//
// Format:  [DD/MM/YYYY, HH:MM:SS] Sender Name: message text
// iOS prefixes every timestamp line with U+200E (left-to-right mark) and
// renders unknown contacts as `~Phone Name`. System events (joins, media
// placeholders, deleted-message markers) are filtered out — the ingest
// pipeline only cares about human-authored text.

export interface ParsedMessage {
  author: string
  text: string
  /** ISO-8601 UTC timestamp (Z-suffixed). */
  sentAt: string
}

const LINE_RE =
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\]\s+([^:]+?):\s?(.*)$/

const MEDIA_OMITTED_RE =
  /^(image|video|audio|gif|sticker|document|contact card) omitted$/i
const DELETED_RE = /^This message was deleted\.?$/i
const ENCRYPTION_NOTICE_RE = /^Messages and calls are end-to-end encrypted/i

// Most WhatsApp system events ("Alice added Bob", "Bob left") have no colon,
// so LINE_RE never matches them and they're dropped for free. But a handful
// carry a "Name:" (or group-name) author prefix — so LINE_RE DOES match and
// they'd otherwise land as real messages, polluting the search index and the
// monthly counts. These filter that class explicitly. Some are author-
// independent (matched on text alone); the membership/group ones need the
// author because WhatsApp repeats the actor's name in the body.
const SECURITY_CODE_RE = /^Your security code with .+ changed\.?$/i
const CREATED_GROUP_RE = /^You created the group\b/i
const NOW_ADMIN_RE = /^You're now an admin$/i
const ADVANCED_PRIVACY_RE = /turned (on|off) advanced chat privacy\b/i
const PHONE_CHANGED_RE = /changed their phone number to a new number/i

/** Membership / group-management notices that carry the actor's name as the
 *  message author. Two shapes occur:
 *   - actor-authored: "<actor> was added|left|joined|removed …",
 *     "<actor> changed the/this group…/the subject…"
 *   - addee-authored: "<adder> added <addee>" is attributed to <addee>, so the
 *     body ends with the author's own name (optionally "~ "-prefixed). */
function isMembershipEvent(author: string, text: string): boolean {
  const stripped = text.replace(/^~\s*/, '')
  if (stripped.startsWith(author + ' ')) {
    const rest = stripped.slice(author.length + 1)
    if (rest === 'was added' || rest === 'left' || rest === 'joined') return true
    if (/^joined using this group/i.test(rest)) return true
    if (/^removed /i.test(rest)) return true
    if (/^changed (the|this) group/i.test(rest)) return true
    if (/^changed the subject/i.test(rest)) return true
  }
  const added = /^.+ added (?:~\s*)?(.+)$/.exec(stripped)
  if (added && added[1].trim() === author) return true
  return false
}

function isSystemText(author: string, text: string): boolean {
  const t = text.trim()
  // An empty/whitespace-only body means the line was `Alice:` with no
  // message content — treat as a placeholder and drop it so it doesn't
  // pollute chat_messages or burn an embedding call.
  if (t.length === 0) return true
  if (MEDIA_OMITTED_RE.test(t)) return true
  if (DELETED_RE.test(t)) return true
  if (ENCRYPTION_NOTICE_RE.test(t)) return true
  if (SECURITY_CODE_RE.test(t)) return true
  if (CREATED_GROUP_RE.test(t)) return true
  if (NOW_ADMIN_RE.test(t)) return true
  if (ADVANCED_PRIVACY_RE.test(t)) return true
  if (PHONE_CHANGED_RE.test(t)) return true
  if (isMembershipEvent(author, t)) return true
  return false
}

/** Convert a wall-clock date/time that was written in the given IANA
 *  timezone to the corresponding UTC instant (as an ISO-8601 string).
 *  WhatsApp iOS exports timestamps in the device's local time with no
 *  offset marker, so callers must know the capture timezone. Uses
 *  Intl.DateTimeFormat, which is DST-aware and handles transitions. */
function wallClockToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): string {
  // Treat the input as naive UTC, then ask the target tz what its
  // wall-clock equivalent of that moment looks like. The delta between
  // the input wall-clock and the tz's wall-clock IS the tz offset at
  // that moment — subtract it from the naive UTC to land on the real UTC.
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(naiveUtc))
  const get = (t: string): number =>
    Number(parts.find((p) => p.type === t)!.value)
  // Intl returns "24" for midnight under some locales — normalize to 0.
  const tzHour = get('hour') % 24
  const tzUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    tzHour,
    get('minute'),
    get('second'),
  )
  const offset = tzUtc - naiveUtc
  return new Date(naiveUtc - offset).toISOString()
}

function cleanAuthor(raw: string): string {
  return raw.replace(/^~\s*/, '').trim()
}

interface InProgress {
  author: string
  sentAt: string
  lines: string[]
}

function commit(messages: ParsedMessage[], ip: InProgress | null): void {
  if (!ip) return
  const text = ip.lines.join('\n')
  if (isSystemText(ip.author, text)) return
  messages.push({ author: ip.author, text, sentAt: ip.sentAt })
}

export interface ParseOptions {
  /** IANA timezone that the export's wall-clock timestamps were captured
   *  in (e.g. 'Europe/London'). Defaults to 'UTC', which matches prior
   *  behavior and is correct only when the exporting device was in UTC. */
  timeZone?: string
}

export function parseWhatsappChat(
  raw: string,
  opts: ParseOptions = {},
): ParsedMessage[] {
  if (!raw) return []
  const timeZone = opts.timeZone ?? 'UTC'
  const messages: ParsedMessage[] = []
  let current: InProgress | null = null

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\u200E/g, '')
    const m = LINE_RE.exec(line)
    if (m) {
      commit(messages, current)
      const [, day, month, year, hour, minute, second, author, text] = m
      current = {
        author: cleanAuthor(author),
        sentAt: wallClockToUtcIso(
          Number(year),
          Number(month),
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
          timeZone,
        ),
        lines: [text],
      }
    } else if (current) {
      current.lines.push(line)
    }
  }
  commit(messages, current)

  return messages
}

/** Keep only messages whose `sentAt` falls within the given YYYY-MM month
 *  (UTC). Throws on malformed month strings. */
export function filterMonth(
  messages: ParsedMessage[],
  month: string,
): ParsedMessage[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) {
    throw new Error(`filterMonth: invalid month "${month}" (expected YYYY-MM)`)
  }
  const year = Number(m[1])
  const monthIdx = Number(m[2]) - 1
  if (monthIdx < 0 || monthIdx > 11) {
    throw new Error(`filterMonth: invalid month "${month}" (month out of range)`)
  }
  const start = Date.UTC(year, monthIdx, 1)
  const end = Date.UTC(year, monthIdx + 1, 1)

  return messages.filter((msg) => {
    const t = new Date(msg.sentAt).getTime()
    return t >= start && t < end
  })
}
