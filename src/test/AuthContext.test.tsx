// Regression test for THE-551 — AuthContext mount effect.
//
// Previously, `AuthProvider` only called `/api/auth/me` on mount if the
// non-HttpOnly `cpo_has_session` hint cookie was present; otherwise it
// silently flipped `hasChecked=true` and treated the user as signed
// out. That broke the "new browser window" scenario: if the hint
// cookie was missing for any reason (browser privacy mode, extension
// interference, 3rd-party blocker) but the real `cpo_session`
// HttpOnly cookie was still valid, the user was redirected to the
// magic-link flow even though the server would happily authenticate
// them.
//
// The fix: always call `/me` on mount. This test renders the provider
// with ZERO cookies in `document.cookie` and asserts the user still
// gets loaded when `/me` returns a valid body.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface ProbeProps {
  onState?: (state: ReturnType<typeof useAuth>) => void
}

function AuthProbe({ onState }: ProbeProps) {
  const state = useAuth()
  onState?.(state)
  return (
    <div data-testid="probe">
      {state.hasChecked ? (state.isAuthenticated ? 'yes' : 'no') : 'pending'}
    </div>
  )
}

describe('AuthProvider mount effect (THE-551)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    // Clear any leftover cookies from prior tests so we can assert on
    // the "no hint cookie" branch.
    document.cookie
      .split(';')
      .map((c) => c.split('=')[0].trim())
      .filter(Boolean)
      .forEach((name) => {
        document.cookie = `${name}=; path=/; max-age=0`
      })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls /api/auth/me on mount even when cpo_has_session hint cookie is absent', async () => {
    expect(document.cookie).not.toMatch(/cpo_has_session/)

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/auth/me') {
        return jsonResponse({
          name: 'Real Member',
          email: 'real@example.com',
          jobRole: 'Head of Product',
          isAdmin: false,
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    let latestState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthProbe onState={(s) => (latestState = s)} />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(latestState?.hasChecked).toBe(true)
      expect(latestState?.isAuthenticated).toBe(true)
      expect(latestState?.user?.email).toBe('real@example.com')
    })

    // The /me endpoint must actually have been called — that's the
    // whole point of the fix.
    const meCalls = fetchMock.mock.calls.filter((c) => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0])
      return url === '/api/auth/me'
    })
    expect(meCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('marks the user as unauthenticated when /me returns 401 (no stale-cookie loop)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/auth/me') {
        return jsonResponse({ error: 'not_authenticated' }, 401)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    let latestState: ReturnType<typeof useAuth> | null = null
    render(
      <AuthProvider>
        <AuthProbe onState={(s) => (latestState = s)} />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(latestState?.hasChecked).toBe(true)
      expect(latestState?.isAuthenticated).toBe(false)
      expect(latestState?.user).toBeNull()
    })
  })
})
