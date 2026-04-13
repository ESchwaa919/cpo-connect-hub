import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetByPhone, mockGetByEmail, mockGetByName } = vi.hoisted(() => ({
  mockGetByPhone: vi.fn(),
  mockGetByEmail: vi.fn(),
  mockGetByName: vi.fn(),
}))

vi.mock('../../server/services/members', () => ({
  getMemberByPhone: mockGetByPhone,
  getMemberByEmail: mockGetByEmail,
  getMemberByNameCaseInsensitive: mockGetByName,
}))

import { resolveAuthor } from '../../server/lib/resolveAuthor'

describe('resolveAuthor', () => {
  beforeEach(() => {
    mockGetByPhone.mockReset()
    mockGetByEmail.mockReset()
    mockGetByName.mockReset()
  })

  it('resolves a WhatsApp tilde-prefixed phone to E.164 + directory display name', () => {
    mockGetByPhone.mockReturnValue({
      phone: '+447911123456',
      displayName: 'Sarah Jenkins',
      email: null,
    })
    expect(resolveAuthor('~+44 7911 123456', null)).toEqual({
      senderPhone: '+447911123456',
      senderDisplayName: 'Sarah Jenkins',
    })
  })

  it('returns E.164 + null display name when the phone is not in the directory', () => {
    mockGetByPhone.mockReturnValue(null)
    expect(resolveAuthor('~+44 7911 123456', null)).toEqual({
      senderPhone: '+447911123456',
      senderDisplayName: null,
    })
  })

  it('returns null/null when the phone is unparseable', () => {
    // "~+44 abcde" — has the tilde prefix but the body does not
    // normalise to a valid number. Neither looksLikeRawPhone nor
    // normalizePhone can produce an E.164 value, so we keep the raw
    // string as a best-effort display name.
    expect(resolveAuthor('~Unknown', null)).toEqual({
      senderPhone: null,
      senderDisplayName: '~Unknown',
    })
  })

  it('resolves a plain name via case-insensitive directory match', () => {
    mockGetByPhone.mockReturnValue(null)
    mockGetByName.mockReturnValue({
      phone: '+447911123456',
      displayName: 'Sarah Jenkins',
      email: null,
    })
    expect(resolveAuthor('sarah jenkins', null)).toEqual({
      senderPhone: null,
      senderDisplayName: 'Sarah Jenkins',
    })
  })

  it('falls back to email lookup when name match fails and email is present', () => {
    mockGetByName.mockReturnValue(null)
    mockGetByEmail.mockReturnValue({
      phone: '+447911123456',
      displayName: 'Sarah Jenkins',
      email: 'sarah@example.com',
    })
    expect(resolveAuthor('Sarah J.', 'sarah@example.com')).toEqual({
      senderPhone: null,
      senderDisplayName: 'Sarah Jenkins',
    })
  })

  it('preserves the raw name when no resolution path succeeds', () => {
    mockGetByName.mockReturnValue(null)
    mockGetByEmail.mockReturnValue(null)
    expect(resolveAuthor('Anonymous Participant', null)).toEqual({
      senderPhone: null,
      senderDisplayName: 'Anonymous Participant',
    })
  })

  it('returns null/null for an empty author string', () => {
    expect(resolveAuthor('', null)).toEqual({
      senderPhone: null,
      senderDisplayName: null,
    })
  })
})
