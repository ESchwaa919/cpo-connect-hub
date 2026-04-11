import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAdminEmail } from '../../server/middleware/requireAdmin'

const ORIGINAL = process.env.ADMIN_EMAILS

describe('isAdminEmail', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@example.com,erik@theaiexpert.ai'
  })

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.ADMIN_EMAILS
    } else {
      process.env.ADMIN_EMAILS = ORIGINAL
    }
  })

  it('returns true when the email is in ADMIN_EMAILS', () => {
    expect(isAdminEmail('erik@theaiexpert.ai')).toBe(true)
    expect(isAdminEmail('admin@example.com')).toBe(true)
  })

  it('returns false when the email is not in ADMIN_EMAILS', () => {
    expect(isAdminEmail('joe@example.com')).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(isAdminEmail('Erik@TheAiExpert.AI')).toBe(true)
  })

  it('trims whitespace on both sides (env list + input)', () => {
    process.env.ADMIN_EMAILS = '  admin@example.com  '
    expect(isAdminEmail(' admin@example.com ')).toBe(true)
  })

  it('returns false when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('erik@theaiexpert.ai')).toBe(false)
  })

  it('returns false for an empty / whitespace-only email', () => {
    expect(isAdminEmail('')).toBe(false)
    expect(isAdminEmail('   ')).toBe(false)
  })
})
