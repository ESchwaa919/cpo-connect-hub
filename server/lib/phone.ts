import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/** Normalize a raw phone string to E.164 format (e.g. `+447700900123`).
 *  Returns null when the input is empty, invalid, or unparseable.
 *  Strips a leading `~` (WhatsApp unknown-contact prefix) before parsing. */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'GB',
): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/^~\s*/, '').trim()
  if (!cleaned) return null

  // International-without-`+` recovery. Sheet1 historically stores foreign
  // numbers as bare digit strings (e.g. "918826955500" for an Indian
  // mobile). With defaultCountry=GB, libphonenumber treats those as UK
  // national numbers and rejects them. Try prepending '+' first; if it
  // parses to a valid international number, use that. Skip when the
  // string starts with '0' (UK trunk prefix) so UK mobiles continue to
  // flow through the GB default-country path unchanged. See
  // .reports/2026-04-25-cpo-sync-members-actionable.md for the 38-row
  // analysis behind this heuristic.
  const noWs = cleaned.replace(/\s/g, '')
  if (/^\d{10,}$/.test(noWs) && !noWs.startsWith('0')) {
    const intl = parsePhoneNumberFromString('+' + noWs)
    if (intl?.isValid()) return intl.format('E.164')
  }

  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry)
  if (!parsed || !parsed.isValid()) return null
  return parsed.format('E.164')
}

/** Sanitize an E.164 number to country code + last-three-digit form.
 *  E.g. `+447700900123` → `+44 ···· ···123`.
 *  E.g. `+14155552671`  → `+1 ···· ···671`. */
export function sanitizePhone(e164: string): string {
  if (!e164.startsWith('+')) return '···'
  const digits = e164.slice(1)
  // E.164 country codes are 1–3 digits. Without the full metadata we
  // approximate: NANPA (`+1`) and Russia/Kazakhstan (`+7`) use one
  // digit, most others use two. Good enough for display sanitization.
  const countryLen = digits[0] === '1' || digits[0] === '7' ? 1 : 2
  const country = digits.slice(0, countryLen)
  const last3 = digits.slice(-3)
  return `+${country} ···· ···${last3}`
}

/** True if the string looks like a raw phone number — E.164,
 *  tilde-prefixed, or "+/digits/spaces/separators only". Used as a
 *  belt-and-braces guard when falling back to legacy author_name
 *  fields so raw numbers can never leak to the UI. */
export function looksLikeRawPhone(s: string): boolean {
  if (!s) return false
  const cleaned = s.replace(/^~\s*/, '').trim()
  if (!cleaned) return false
  return /^\+?[\d\s\-().]+$/.test(cleaned) && /\d{6,}/.test(cleaned)
}

/** If the raw author string looks like a phone number, sanitize it.
 *  Otherwise pass the name through unchanged. Empty input → generic
 *  placeholder `"A member"` so the UI never renders an empty field. */
export function sanitizeRawAuthorString(raw: string): string {
  if (!raw) return 'A member'
  if (!looksLikeRawPhone(raw)) return raw
  const normalized = normalizePhone(raw)
  if (!normalized) return 'A member'
  return sanitizePhone(normalized)
}
