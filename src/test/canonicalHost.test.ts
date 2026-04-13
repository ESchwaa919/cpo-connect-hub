// Side-effect import: seeds RESEND_API_KEY dummy so email.ts's eager
// `new Resend(...)` construction doesn't throw when createApp() is
// imported in the integration block below.
import './_requireIngestAuth-setup'

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { canonicalHostRedirect } from '../../server/middleware/canonicalHost'
import { createApp } from '../../server/app'

function makeRes() {
  const res = {
    redirect: vi.fn(),
  } as unknown as Response
  return res
}

function makeReq(overrides: Partial<Request>): Request {
  return {
    hostname: 'cpoconnect.club',
    path: '/',
    originalUrl: '/',
    ...overrides,
  } as Request
}

describe('canonicalHostRedirect', () => {
  it('301-redirects from cpo-connect-hub.onrender.com to cpoconnect.club', () => {
    const req = makeReq({
      hostname: 'cpo-connect-hub.onrender.com',
      path: '/members/chat-insights',
      originalUrl: '/members/chat-insights',
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      'https://cpoconnect.club/members/chat-insights',
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('preserves the query string in the redirect target', () => {
    const req = makeReq({
      hostname: 'cpo-connect-hub.onrender.com',
      path: '/members/whats-talked',
      originalUrl: '/members/whats-talked?q=hello&channel=ai',
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      'https://cpoconnect.club/members/whats-talked?q=hello&channel=ai',
    )
  })

  it('does NOT redirect when already on the canonical host', () => {
    const req = makeReq({
      hostname: 'cpoconnect.club',
      path: '/members/chat-insights',
      originalUrl: '/members/chat-insights',
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('does NOT redirect requests on localhost / 127.0.0.1 (dev)', () => {
    const req = makeReq({ hostname: 'localhost' })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('does NOT redirect /api/auth/verify even from the non-canonical host', () => {
    // The magic-link verify endpoint must complete on whichever host
    // the email link was generated for, otherwise the token lookup
    // fails. Critical exemption.
    const req = makeReq({
      hostname: 'cpo-connect-hub.onrender.com',
      path: '/api/auth/verify',
      originalUrl: '/api/auth/verify?token=abc123',
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('does NOT redirect /health (Render polls it on the onrender hostname)', () => {
    const req = makeReq({
      hostname: 'cpo-connect-hub.onrender.com',
      path: '/health',
      originalUrl: '/health',
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('does redirect API routes other than /api/auth/verify', () => {
    const req = makeReq({
      hostname: 'cpo-connect-hub.onrender.com',
      path: '/api/chat/ask',
      originalUrl: '/api/chat/ask',
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    canonicalHostRedirect(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(
      301,
      'https://cpoconnect.club/api/chat/ask',
    )
    expect(next).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Integration — proves the middleware is mounted via createApp() AND that
// `app.set('trust proxy', 1)` correctly resolves req.hostname from the
// X-Forwarded-Host header (the way Render delivers traffic). Without
// `trust proxy`, req.hostname would reflect the loopback host and the
// redirect would silently no-op in production.
// ---------------------------------------------------------------------------

describe('canonical host redirect — wired through createApp', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    const app = createApp({ serveStatic: false })
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  it('301-redirects via X-Forwarded-Host (trust proxy + middleware wired)', async () => {
    const res = await fetch(`${baseUrl}/members/chat-insights`, {
      headers: { 'X-Forwarded-Host': 'cpo-connect-hub.onrender.com' },
      redirect: 'manual',
    })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(
      'https://cpoconnect.club/members/chat-insights',
    )
  })

  it('does NOT redirect /health even via the non-canonical X-Forwarded-Host', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Forwarded-Host': 'cpo-connect-hub.onrender.com' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('does NOT redirect /api/auth/verify even via the non-canonical X-Forwarded-Host', async () => {
    // The verify endpoint redirects to /?verify=expired without a
    // valid token, so we stop the fetch from following it. The point
    // of this test is just to prove the canonical-host middleware
    // didn't preempt the verify handler with a 301 to cpoconnect.club.
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { 'X-Forwarded-Host': 'cpo-connect-hub.onrender.com' },
      redirect: 'manual',
    })
    // The verify handler issues its own 302 to /?verify=expired —
    // critically, NOT a 301 to cpoconnect.club.
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).not.toMatch(/cpoconnect\.club/)
  })
})
