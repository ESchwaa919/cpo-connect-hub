import { normalizePhone, looksLikeRawPhone } from './phone.ts'
import {
  getMemberByPhone,
  getMemberByEmail,
  getMemberByNameCaseInsensitive,
} from '../services/members.ts'

export interface ResolvedAuthor {
  senderPhone: string | null
  senderDisplayName: string | null
}

/** Apply the identity resolution chain to a raw WhatsApp author
 *  string. Used at ingest time AND by the backfill script so both
 *  paths share identical semantics.
 *
 *  Phone path (author looks like a number):
 *    → normalize to E.164, look up members by phone.
 *    → senderPhone is always the E.164 form (even when not found).
 *    → senderDisplayName is the directory name if found, otherwise
 *      null (display layer will sanitize via sanitizePhone).
 *
 *  Name path (author is a plain name string):
 *    → try case-insensitive directory name match, then email fallback
 *      if email is provided. If neither succeeds, keep the raw name
 *      as the best-effort display name (pre-existing behavior).
 *
 *  Empty input → null/null. */
export function resolveAuthor(
  rawAuthor: string,
  authorEmail: string | null,
): ResolvedAuthor {
  const trimmed = (rawAuthor ?? '').trim()
  if (!trimmed) return { senderPhone: null, senderDisplayName: null }

  if (looksLikeRawPhone(trimmed)) {
    const phone = normalizePhone(trimmed)
    if (!phone) {
      // Tilde-prefixed or digit-heavy string that couldn't be parsed —
      // pass it through as the best-effort display name.
      return { senderPhone: null, senderDisplayName: trimmed }
    }
    const member = getMemberByPhone(phone)
    return {
      senderPhone: phone,
      senderDisplayName: member?.displayName ?? null,
    }
  }

  const byName = getMemberByNameCaseInsensitive(trimmed)
  if (byName) {
    return { senderPhone: null, senderDisplayName: byName.displayName }
  }

  if (authorEmail) {
    const byEmail = getMemberByEmail(authorEmail)
    if (byEmail) {
      return { senderPhone: null, senderDisplayName: byEmail.displayName }
    }
  }

  return { senderPhone: null, senderDisplayName: trimmed }
}
