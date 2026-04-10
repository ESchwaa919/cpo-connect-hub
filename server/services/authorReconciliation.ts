export interface ProfileMatchCandidate {
  email: string
  name: string
}

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu
const PHONE_PREFIX_REGEX = /^\+\d/

export function normalizeName(raw: string): string {
  return raw
    .replace(/^~\s*/, '')
    .replace(EMOJI_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isPhoneNumber(normalized: string): boolean {
  return PHONE_PREFIX_REGEX.test(normalized)
}

/** Resolve a WhatsApp author name to a profile email, or null if no
 *  unambiguous match exists. Phone-number authors always return null. */
export function matchAuthor(
  rawAuthor: string,
  profiles: ProfileMatchCandidate[],
): string | null {
  const normalized = normalizeName(rawAuthor)
  if (!normalized || isPhoneNumber(normalized)) {
    return null
  }

  // Single linear pass: track exact matches and single-token first-name
  // matches simultaneously, short-circuit on exact ambiguity.
  let exactEmail: string | null = null
  let exactCount = 0
  let firstNameEmail: string | null = null
  let firstNameCount = 0
  const isSingleToken = !normalized.includes(' ')

  for (const p of profiles) {
    const profileNorm = normalizeName(p.name)
    if (profileNorm === normalized) {
      exactCount++
      if (exactCount === 1) exactEmail = p.email
      if (exactCount > 1) return null
      continue
    }
    if (isSingleToken && profileNorm.split(' ', 1)[0] === normalized) {
      firstNameCount++
      if (firstNameCount === 1) firstNameEmail = p.email
    }
  }

  if (exactCount === 1) return exactEmail
  if (firstNameCount === 1) return firstNameEmail
  return null
}
