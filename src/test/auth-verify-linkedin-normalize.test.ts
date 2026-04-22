// Regression for the Codex Medium finding on PR #38:
// server/routes/auth.ts first-login profile INSERT was persisting
// member.linkedinUrl raw from Sheet1, bypassing normalizeLinkedinUrl().
// A new member joining via magic-link before any Sheet1 normalization
// would land with `www.linkedin.com/in/foo` in member_profiles.linkedin_url
// and hit Tania's Bug 2 (relative href → /members/... 404) on their very
// first profile view.
import './_requireIngestAuth-setup'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { makeRes } from './_express-mocks'

const { mockQuery, mockLookupMember } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLookupMember: vi.fn(),
}))

// auth.ts imports with explicit `.ts` extensions, so the mock specifier
// must match the same module ID for vi.mock to intercept.
vi.mock('../../server/db.ts', () => ({
  default: { query: mockQuery },
}))

vi.mock('../../server/services/sheets.ts', () => ({
  lookupMember: mockLookupMember,
}))

// email.ts is imported transitively by auth.ts — stub sendMagicLink so
// the real Resend SDK construction path isn't exercised. /verify itself
// does not call sendMagicLink, but the stub keeps the module graph clean.
vi.mock('../../server/services/email.ts', () => ({
  sendMagicLink: vi.fn(),
}))

// Set SESSION_SECRET before the router module loads so res.cookie sign
// step doesn't early-return the handler.
process.env.SESSION_SECRET = 'test-secret-for-auth-verify'

const { default: authRouter } = await import('../../server/routes/auth')

interface RouteLayer {
  route?: {
    path: string
    stack: Array<{ handle: RequestHandler }>
  }
}

function findVerifyHandler(): RequestHandler {
  const stack = (authRouter as unknown as { stack: RouteLayer[] }).stack
  const layer = stack.find((l) => l.route?.path === '/verify')
  if (!layer?.route) throw new Error('GET /verify handler not found on auth router')
  return layer.route.stack[0]!.handle
}

describe('GET /verify — first-login LinkedIn URL normalization (Codex #38 follow-up)', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockLookupMember.mockReset()
  })

  it('stores https://www.linkedin.com/in/foo when Sheet1 has the un-protocoled value', async () => {
    const tokenRow = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'newbie@example.com',
    }

    mockQuery
      // 1. SELECT magic_link_tokens WHERE token = $1
      .mockResolvedValueOnce({ rows: [tokenRow] })
      // 2. UPDATE magic_link_tokens SET used = TRUE WHERE id = $1
      .mockResolvedValueOnce({ rows: [] })
      // 3. INSERT sessions ... RETURNING id
      .mockResolvedValueOnce({
        rows: [{ id: '22222222-2222-2222-2222-222222222222' }],
      })
      // 4. SELECT member_profiles WHERE email = $1 (profile does not exist yet)
      .mockResolvedValueOnce({ rows: [] })
      // 5. INSERT member_profiles (..., linkedin_url, phone)
      .mockResolvedValueOnce({ rows: [] })

    mockLookupMember.mockResolvedValueOnce({
      email: 'newbie@example.com',
      name: 'New Member',
      status: 'Joined',
      jobRole: 'PM',
      linkedinUrl: 'www.linkedin.com/in/New-Member',
      location: 'London',
      currentOrg: 'Acme',
      industry: 'Fintech',
      focusAreas: '',
      areasOfInterest: '',
      phone: '+447000000000',
    })

    const req = {
      query: { token: 'valid-token' },
      originalUrl: '/api/auth/verify?token=valid-token',
    } as unknown as Request
    const res = makeRes() as Response & {
      cookie: (typeof makeRes extends () => infer R ? R : never)
      redirect: (status: number, path: string) => void
    }
    Object.assign(res, {
      cookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    })
    const next: NextFunction = vi.fn()

    const handler = findVerifyHandler()
    await handler(req, res, next)

    // Locate the member_profiles INSERT by SQL rather than by position —
    // the handler's query order (tokens/sessions/profile) could change
    // and the test should still be asserting the right call.
    const insertCall = (mockQuery.mock.calls as Array<[string, unknown[]]>).find(
      ([sql]) => sql.includes('INSERT INTO cpo_connect.member_profiles'),
    )
    expect(insertCall).toBeDefined()
    const [, values] = insertCall!
    expect(values[8]).toBe('https://www.linkedin.com/in/New-Member')
  })

  it('leaves an already-normalized LinkedIn URL unchanged', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: '1', email: 'already-normalized@example.com' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    mockLookupMember.mockResolvedValueOnce({
      email: 'already-normalized@example.com',
      name: 'Already Normalized',
      status: 'Joined',
      jobRole: '',
      linkedinUrl: 'https://www.linkedin.com/in/already',
      location: '',
      currentOrg: '',
      industry: '',
      focusAreas: '',
      areasOfInterest: '',
      phone: '+447000000001',
    })

    const req = {
      query: { token: 'valid' },
      originalUrl: '/api/auth/verify?token=valid',
    } as unknown as Request
    const res = makeRes() as Response
    Object.assign(res, {
      cookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    })
    await findVerifyHandler()(req, res, vi.fn())

    const insertCall = (mockQuery.mock.calls as Array<[string, unknown[]]>).find(
      ([sql]) => sql.includes('INSERT INTO cpo_connect.member_profiles'),
    )
    expect(insertCall).toBeDefined()
    const [, values] = insertCall!
    expect(values[8]).toBe('https://www.linkedin.com/in/already')
  })
})
