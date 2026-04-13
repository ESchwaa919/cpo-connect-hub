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
