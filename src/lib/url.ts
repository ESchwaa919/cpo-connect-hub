// LinkedIn URL normalizer — shared between the save path (PUT /profile) and
// the render path (MemberCard). Returns '' for anything we won't render as a
// LinkedIn link so the UI can conditionally hide the icon rather than emit a
// broken or misleading href.
//
// Two root causes motivate this:
//   1. Sheet1 / DB historically stored values without a protocol (e.g.
//      "www.linkedin.com/in/Handle"), which the browser treats as relative →
//      /members/www.linkedin.com/... 404.
//   2. The Profile form input has type="url", so an un-protocoled stored
//      value blocks HTML5 form validation and silently prevents save.

const LINKEDIN_HOST_REGEX = /^([a-z0-9-]+\.)?linkedin\.com$/i

export function normalizeLinkedinUrl(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, 'https://')
    : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    return ''
  }

  if (!LINKEDIN_HOST_REGEX.test(parsed.hostname)) return ''

  parsed.protocol = 'https:'
  parsed.hostname = parsed.hostname.toLowerCase()
  return parsed.toString().replace(/\/$/, '')
}
