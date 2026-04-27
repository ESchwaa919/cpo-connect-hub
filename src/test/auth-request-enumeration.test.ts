// Enumeration-resistance regression for POST /api/auth/request.
//
// Threat: an attacker with a candidate email list submits each address
// and reads the JSON response. Pre-fix the response carried
// `memberStatus: 'sent' | 'not_found'`, which the frontend used to show
// "Check your inbox" vs "We don't recognise that email". That branching
// gives the attacker a vetted CPO-member target list for spear-phishing.
//
// Fix: server returns identical `{ code: 'check_email' }` regardless of
// lookup result; email content (magic link vs apply-to-join invite)
// branches inside the handler. See dispatch
// dispatch_cpo_magic_link_enumeration_fix_20260427.md.
import './_requireIngestAuth-setup'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, RequestHandler } from 'express'
import { makeRes, bodyOf } from './_express-mocks'

const {
  mockQuery,
  mockLookupMember,
  mockSendMagicLink,
  mockSendApplyInvite,
  ipAllow,
  emailAllow,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLookupMember: vi.fn(),
  mockSendMagicLink: vi.fn(),
  mockSendApplyInvite: vi.fn(),
  // Mutable allow flags read by the rate-limiter mock below. The IP
  // limiter is created with max=10 in auth.ts; the email limiter with
  // max=3 — we discriminate on `max` so each test toggles either
  // independently.
  ipAllow: { value: true },
  emailAllow: { value: true },
}))

vi.mock('../../server/db.ts', () => ({
  default: { query: mockQuery },
}))

vi.mock('../../server/services/sheets.ts', () => ({
  lookupMember: mockLookupMember,
}))

vi.mock('../../server/services/email.ts', () => ({
  sendMagicLink: mockSendMagicLink,
  sendApplyInvite: mockSendApplyInvite,
}))

vi.mock('../../server/services/rate-limit.ts', () => ({
  createRateLimiter: ({ max }: { windowMs: number; max: number }) => ({
    check: () => {
      const allow = max === 10 ? ipAllow.value : emailAllow.value
      return { allowed: allow, remaining: allow ? max - 1 : 0, resetTime: Date.now() + 60000 }
    },
    reset: () => undefined,
  }),
}))

// Disable the equal-time delay for tests — we assert on response shape,
// not wall-clock timing.
process.env.REQUEST_EQUAL_TIME_FLOOR_MS = '0'

const { default: authRouter } = await import('../../server/routes/auth')

interface RouteLayer {
  route?: {
    path: string
    methods: { post?: boolean; get?: boolean }
    stack: Array<{ handle: RequestHandler }>
  }
}

function findRequestHandler(): RequestHandler {
  const stack = (authRouter as unknown as { stack: RouteLayer[] }).stack
  const layer = stack.find(
    (l) => l.route?.path === '/request' && l.route.methods.post,
  )
  if (!layer?.route) throw new Error('POST /request handler not found')
  return layer.route.stack[0]!.handle
}

function makeReqWithEmail(email: string | undefined): Request {
  return {
    body: email === undefined ? {} : { email },
    headers: { 'x-forwarded-for': '203.0.113.1' },
    ip: '203.0.113.1',
    header: () => undefined,
  } as unknown as Request
}

describe('POST /request — enumeration-resistant response shape', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockLookupMember.mockReset()
    mockSendMagicLink.mockReset()
    mockSendApplyInvite.mockReset()
    ipAllow.value = true
    emailAllow.value = true
  })

  it('returns { code: "check_email" } and sends magic link when caller is a joined member', async () => {
    mockLookupMember.mockResolvedValueOnce({
      email: 'member@example.com',
      name: 'Real Member',
      status: 'Joined',
    })
    mockQuery.mockResolvedValue({
      rows: [{ id: '11111111-1111-1111-1111-111111111111', expires_at: 'x' }],
    })
    mockSendMagicLink.mockResolvedValueOnce(undefined)

    const req = makeReqWithEmail('member@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(200)
    expect(bodyOf(res)).toEqual({ code: 'check_email' })
    expect(mockSendMagicLink).toHaveBeenCalledTimes(1)
    expect(mockSendApplyInvite).not.toHaveBeenCalled()
  })

  it('returns { code: "check_email" } and sends apply-invite when caller is NOT a member', async () => {
    mockLookupMember.mockResolvedValueOnce(null)
    mockSendApplyInvite.mockResolvedValueOnce(undefined)

    const req = makeReqWithEmail('stranger@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(200)
    expect(bodyOf(res)).toEqual({ code: 'check_email' })
    expect(mockSendApplyInvite).toHaveBeenCalledTimes(1)
    expect(mockSendApplyInvite).toHaveBeenCalledWith('stranger@example.com')
    expect(mockSendMagicLink).not.toHaveBeenCalled()
  })

  it('returns { code: "check_email" } and sends apply-invite when status is NOT "joined"', async () => {
    mockLookupMember.mockResolvedValueOnce({
      email: 'pending@example.com',
      name: 'Pending Member',
      status: 'Pending',
    })
    mockSendApplyInvite.mockResolvedValueOnce(undefined)

    const req = makeReqWithEmail('pending@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(bodyOf(res)).toEqual({ code: 'check_email' })
    expect(mockSendApplyInvite).toHaveBeenCalledTimes(1)
    expect(mockSendMagicLink).not.toHaveBeenCalled()
  })

  it('returns { code: "check_email" } and sends NO email when the body has no email', async () => {
    const req = makeReqWithEmail(undefined)
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(bodyOf(res)).toEqual({ code: 'check_email' })
    expect(mockSendMagicLink).not.toHaveBeenCalled()
    expect(mockSendApplyInvite).not.toHaveBeenCalled()
  })

  it('returns { code: "check_email" } when sendMagicLink throws (no error-shape leak)', async () => {
    mockLookupMember.mockResolvedValueOnce({
      email: 'member@example.com',
      name: 'Real Member',
      status: 'Joined',
    })
    mockQuery.mockResolvedValue({
      rows: [{ id: '22222222-2222-2222-2222-222222222222', expires_at: 'x' }],
    })
    mockSendMagicLink.mockRejectedValueOnce(new Error('resend down'))

    const req = makeReqWithEmail('member@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(200)
    expect(bodyOf(res)).toEqual({ code: 'check_email' })
  })

  it('does NOT include memberStatus in the response (the leak-vector being closed)', async () => {
    mockLookupMember.mockResolvedValueOnce(null)
    mockSendApplyInvite.mockResolvedValueOnce(undefined)

    const req = makeReqWithEmail('any@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    const body = bodyOf(res) as Record<string, unknown>
    expect(body).not.toHaveProperty('memberStatus')
    expect(Object.keys(body)).toEqual(['code'])
  })

  it('returns { code: "check_email" } and sends NO email when the IP rate-limit fires', async () => {
    ipAllow.value = false
    const req = makeReqWithEmail('member@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(200)
    expect(bodyOf(res)).toEqual({ code: 'check_email' })
    expect(mockSendMagicLink).not.toHaveBeenCalled()
    expect(mockSendApplyInvite).not.toHaveBeenCalled()
    expect(mockLookupMember).not.toHaveBeenCalled()
  })

  it('returns { code: "check_email" } and sends NO email when the per-email rate-limit fires', async () => {
    emailAllow.value = false
    const req = makeReqWithEmail('member@example.com')
    const res = makeRes()
    await findRequestHandler()(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(200)
    expect(bodyOf(res)).toEqual({ code: 'check_email' })
    expect(mockSendMagicLink).not.toHaveBeenCalled()
    expect(mockSendApplyInvite).not.toHaveBeenCalled()
    expect(mockLookupMember).not.toHaveBeenCalled()
  })

  it('returns { code: "check_email" } when sendApplyInvite rejects (no error-shape leak, no unhandled rejection)', async () => {
    // Capture unhandled rejections during this test. The handler's
    // `.catch` on sendApplyInvite must absorb the rejection.
    const unhandled: unknown[] = []
    const onRejection = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onRejection)

    try {
      mockLookupMember.mockResolvedValueOnce(null)
      mockSendApplyInvite.mockRejectedValueOnce(new Error('resend down (apply)'))

      const req = makeReqWithEmail('stranger@example.com')
      const res = makeRes()
      await findRequestHandler()(req, res, vi.fn())

      // Let microtasks settle so the .catch on the fire-and-forget
      // promise has a chance to run.
      await new Promise((resolve) => setImmediate(resolve))

      expect(res.status).toHaveBeenCalledWith(200)
      expect(bodyOf(res)).toEqual({ code: 'check_email' })
      expect(unhandled).toHaveLength(0)
    } finally {
      process.off('unhandledRejection', onRejection)
    }
  })
})
