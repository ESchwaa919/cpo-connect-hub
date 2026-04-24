import { describe, it, expect } from 'vitest'
import { normalizeLinkedinUrl } from '../lib/url'

describe('normalizeLinkedinUrl', () => {
  it('prepends https:// when protocol is missing', () => {
    expect(normalizeLinkedinUrl('www.linkedin.com/in/Tania-Shedley')).toBe(
      'https://www.linkedin.com/in/Tania-Shedley',
    )
  })

  it('preserves handle casing (LinkedIn handles are case-preserving in practice)', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/Tania-Shedley')).toBe(
      'https://www.linkedin.com/in/Tania-Shedley',
    )
  })

  it('upgrades http:// to https://', () => {
    expect(normalizeLinkedinUrl('http://www.linkedin.com/in/foo')).toBe(
      'https://www.linkedin.com/in/foo',
    )
  })

  it('leaves a properly-formed https LinkedIn URL unchanged', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/foo')).toBe(
      'https://www.linkedin.com/in/foo',
    )
  })

  it('accepts linkedin.com (no www subdomain) and prepends protocol', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/foo')).toBe(
      'https://linkedin.com/in/foo',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeLinkedinUrl('  www.linkedin.com/in/foo  ')).toBe(
      'https://www.linkedin.com/in/foo',
    )
  })

  it('returns empty string for empty or whitespace-only input', () => {
    expect(normalizeLinkedinUrl('')).toBe('')
    expect(normalizeLinkedinUrl('   ')).toBe('')
  })

  it('returns empty string for null/undefined', () => {
    expect(normalizeLinkedinUrl(null as unknown as string)).toBe('')
    expect(normalizeLinkedinUrl(undefined as unknown as string)).toBe('')
  })

  it('returns empty string when host is not linkedin.com', () => {
    // Defensive: we only want to render LinkedIn URLs as LinkedIn links.
    // Non-linkedin.com values are treated as unset rather than rendered as
    // a broken or misleading link.
    expect(normalizeLinkedinUrl('https://example.com/in/foo')).toBe('')
    expect(normalizeLinkedinUrl('evil.com/linkedin.com/in/foo')).toBe('')
  })

  it('accepts uk.linkedin.com (country subdomains)', () => {
    expect(normalizeLinkedinUrl('uk.linkedin.com/in/foo')).toBe(
      'https://uk.linkedin.com/in/foo',
    )
  })
})
