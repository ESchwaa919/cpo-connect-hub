import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  sanitizePhone,
  looksLikeRawPhone,
  sanitizeRawAuthorString,
} from '../../server/lib/phone'

describe('normalizePhone', () => {
  it('normalizes a UK number with spaces to E.164', () => {
    expect(normalizePhone('07911 123456')).toBe('+447911123456')
  })
  it('normalizes a UK number with country code and dashes', () => {
    expect(normalizePhone('+44-7911-123456')).toBe('+447911123456')
  })
  it('normalizes a US number when the country is supplied', () => {
    expect(normalizePhone('(415) 555-2671', 'US')).toBe('+14155552671')
  })
  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull()
  })
  it('returns null for obviously invalid input', () => {
    expect(normalizePhone('not-a-phone')).toBeNull()
  })
  it('returns null for a tilde-prefixed raw string with no digits', () => {
    expect(normalizePhone('~Unknown')).toBeNull()
  })
  it('strips a leading `~` (WhatsApp unknown-contact prefix)', () => {
    expect(normalizePhone('~+44 7911 123456')).toBe('+447911123456')
  })
})

// Regression suite for the 38 phone-failed Joined rows surfaced by the
// 2026-04-26 sync investigation (.reports/2026-04-25-cpo-sync-members-actionable.md).
// All 38 rows are international numbers that were stored without a leading
// `+`, so the GB-default parser rejected them. The prepend-+ heuristic in
// normalizePhone should now recover 37 of 38; the 38th (Joana Belo Pereira,
// row 250) is a sheet-data typo whose national-number portion is not a
// valid UK mobile.
describe('normalizePhone — international without +', () => {
  // [rawPhone, expectedE164] from Output 1 of the actionable report.
  const recoverable: Array<[string, string]> = [
    ['918826955500', '+918826955500'],     // row 47  Anuj Gupta (IN)
    ['31616329073', '+31616329073'],       // row 49  Jay Selvaraj (NL)
    ['37127811999', '+37127811999'],       // row 64  Edgars Berzins (LV)
    ['351920330191', '+351920330191'],     // row 111 Moatasem Marzouk (PT)
    ['46707664658', '+46707664658'],       // row 145 Francesca Smedberg (SE)
    ['994552120454', '+994552120454'],     // row 148 Musa Jumayev (AZ)
    ['919962321009', '+919962321009'],     // row 158 Thobith Abraham (IN)
    ['918149217376', '+918149217376'],     // row 162 Amit godbole (IN)
    ['4916098232670', '+4916098232670'],   // row 169 Felix Sellmann (DE)
    ['37495988776', '+37495988776'],       // row 177 Artur Muradyan (AM)
    ['31625252349', '+31625252349'],       // row 180 Martijn Versteeg (NL)
    ['46704301740', '+46704301740'],       // row 189 Edward Denes (SE)
    ['14342600240', '+14342600240'],       // row 207 Juhi Ranjan (US)
    ['919766078479', '+919766078479'],     // row 216 LoveKshitij Suryavanshi (IN)
    ['16465439858', '+16465439858'],       // row 223 Steve Paule (US)
    ['37129522115', '+37129522115'],       // row 224 Niks Evalds (LV)
    ['33749875818', '+33749875818'],       // row 227 Olivier Thirion de Briel (FR)
    ['4917670022050', '+4917670022050'],   // row 249 Sascha Brossmann (DE)
    ['46733294454', '+46733294454'],       // row 270 Therese Alburg (SE)
    ['33632419022', '+33632419022'],       // row 272 Fabien Moreno (FR)
    ['33614238566', '+33614238566'],       // row 284 Alexandra Lung (FR)
    ['393381096635', '+393381096635'],     // row 287 Roberta Anna Certini (IT)
    ['919717514593', '+919717514593'],     // row 291 Varun Pandey (IN)
    ['353 85 706 3944', '+353857063944'],  // row 292 John Herbert (IE) — whitespace
    ['27726266037', '+27726266037'],       // row 297 Matt Robertshaw (ZA)
    ['4915222824108', '+4915222824108'],   // row 318 Srikant Vemuri (DE)
    ['33613013837', '+33613013837'],       // row 325 Philippe Billard (FR)
    ['33 6 41 57 8018', '+33641578018'],   // row 342 Irina Zakharova (FR) — whitespace
    ['35679293583', '+35679293583'],       // row 348 Chris Azzopardi (MT)
    ['33767144178', '+33767144178'],       // row 374 Krish Jhaveri (FR)
    ['61410220110', '+61410220110'],       // row 387 James Fitzgerald (AU)
    ['16462518529', '+16462518529'],       // row 388 David Christopher-Morris (US)
    ['17162203351', '+17162203351'],       // row 416 Melissa Donohue (US)
    ['972528929249', '+972528929249'],     // row 437 David Habusha (IL)
    ['31610737003', '+31610737003'],       // row 439 Dimitra Retsina (NL)
    ['358505989153', '+358505989153'],     // row 440 ArttuHuhtiniemi (FI)
    ['919810161323', '+919810161323'],     // row 442 Ankur Goel (IN)
  ]

  it.each(recoverable)('recovers %s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected)
  })

  it('returns null for the 1 unrecoverable typo (row 250 Joana Belo Pereira "4494850316")', () => {
    // Parses as +44 with 8-digit national "94850316"; UK mobiles need a
    // 10-digit national starting with 7. Heuristic correctly refuses.
    expect(normalizePhone('4494850316')).toBeNull()
  })

  it('does NOT mis-recover a UK trunk-prefix number (the heuristic must skip leading-0)', () => {
    // 07911 123456 → noWs=07911123456 → starts with 0 → heuristic skips,
    // falls through to GB default-country path which DOES recognise it.
    expect(normalizePhone('07911 123456')).toBe('+447911123456')
  })

  it('does NOT mis-recover a UK landline written without trunk-0 (codex PR #39 regression)', () => {
    // 2034567890 is a London landline without the leading 0 — i.e. the
    // raw national number for +44 20 3456 7890. Pre-fix, the heuristic
    // ran first and coerced it to +2034567890 (Egypt). The default-
    // country parse must run FIRST so this resolves to UK.
    expect(normalizePhone('2034567890')).toBe('+442034567890')
  })

  it('does NOT mis-recover a short non-international digit string', () => {
    // 12345 → 5 digits → fails the length-≥10 guard → heuristic skips →
    // GB fallback also fails → null.
    expect(normalizePhone('12345')).toBeNull()
  })
})

describe('sanitizePhone', () => {
  it('sanitizes a UK E.164 number to country-plus-last-three form', () => {
    expect(sanitizePhone('+447911123456')).toBe('+44 ···· ···456')
  })
  it('sanitizes a US E.164 number', () => {
    expect(sanitizePhone('+14155552671')).toBe('+1 ···· ···671')
  })
  it('returns a literal fallback when the input does not start with +', () => {
    expect(sanitizePhone('07700900123')).toBe('···')
  })
})

describe('looksLikeRawPhone', () => {
  it('returns true for E.164', () => {
    expect(looksLikeRawPhone('+447911123456')).toBe(true)
  })
  it('returns true for a WhatsApp-style tilde-prefixed number', () => {
    expect(looksLikeRawPhone('~+44 7700 900123')).toBe(true)
  })
  it('returns false for a plain name string', () => {
    expect(looksLikeRawPhone('Sarah Jenkins')).toBe(false)
  })
  it('returns false for empty input', () => {
    expect(looksLikeRawPhone('')).toBe(false)
  })
})

describe('sanitizeRawAuthorString', () => {
  it('sanitizes a WhatsApp tilde-prefixed number', () => {
    expect(sanitizeRawAuthorString('~+44 7911 123456')).toBe(
      '+44 ···· ···456',
    )
  })
  it('passes through a plain name unchanged', () => {
    expect(sanitizeRawAuthorString('Sarah Jenkins')).toBe('Sarah Jenkins')
  })
  it('returns a generic placeholder for empty input', () => {
    expect(sanitizeRawAuthorString('')).toBe('A member')
  })
})
