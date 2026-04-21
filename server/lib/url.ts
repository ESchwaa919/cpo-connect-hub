// Server copy of src/lib/url.ts. Kept in sync by hand — the logic is tiny
// (25 lines) and mirroring it avoids cross-tree imports that the
// tsconfig.node.json include list doesn't allow.
//
// See src/lib/url.ts for the context behind this normalizer. If you edit
// one file, edit both and keep src/test/url.test.ts covering the shared
// behavior.

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
