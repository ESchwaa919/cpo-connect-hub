// Enumeration-resistance regression for LoginModal.
//
// Pre-fix the modal branched between "Check your inbox" (member) and
// "We don't recognise that email" (non-member). Post-fix it shows one
// neutral confirmation regardless of API response. See dispatch
// dispatch_cpo_magic_link_enumeration_fix_20260427.md.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginModal } from '../components/LoginModal'
import { AuthProvider } from '../contexts/AuthContext'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderModal() {
  return render(
    <AuthProvider>
      <LoginModal open onOpenChange={() => undefined} />
    </AuthProvider>,
  )
}

describe('LoginModal — enumeration-resistant single confirmation state', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(loginResponse: unknown): void {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/auth/me') {
        return jsonResponse({ error: 'not_authenticated' }, 401)
      }
      if (url === '/api/auth/request') {
        return jsonResponse(loginResponse)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  it('initial render shows the email entry form (no Apply button, no rejection copy)', async () => {
    stubFetch({ code: 'check_email' })
    renderModal()
    expect(
      await screen.findByRole('button', { name: /Send Magic Link/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Apply to Join/i })).toBeNull()
    expect(screen.queryByText(/We don't recognise/i)).toBeNull()
  })

  it('shows the unified neutral confirmation after submitting a member email', async () => {
    stubFetch({ code: 'check_email' })
    renderModal()

    const input = await screen.findByPlaceholderText(/you@company\.com/i)
    fireEvent.change(input, { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Link/i }))

    expect(await screen.findByText(/Check your email/i)).toBeInTheDocument()
    expect(
      screen.getByText(/associated with a CPO Connect member account/i),
    ).toBeInTheDocument()
    // Crucially: no rejection copy, no Apply CTA, no "magic link" wording
    // that distinguishes member from non-member.
    expect(screen.queryByText(/We don't recognise/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /Apply to Join/i })).toBeNull()
  })

  it('shows the SAME neutral confirmation after submitting a non-member email', async () => {
    // Server response is identical (the enumeration fix); just verify
    // the modal does not branch on its own.
    stubFetch({ code: 'check_email' })
    renderModal()

    const input = await screen.findByPlaceholderText(/you@company\.com/i)
    fireEvent.change(input, { target: { value: 'stranger@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Link/i }))

    expect(await screen.findByText(/Check your email/i)).toBeInTheDocument()
    expect(screen.queryByText(/We don't recognise/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /Apply to Join/i })).toBeNull()
  })

  it('"Try a different email" returns to the email entry form', async () => {
    stubFetch({ code: 'check_email' })
    renderModal()

    const input = await screen.findByPlaceholderText(/you@company\.com/i)
    fireEvent.change(input, { target: { value: 'someone@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Link/i }))

    await screen.findByText(/Check your email/i)
    fireEvent.click(screen.getByRole('button', { name: /Try a different email/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Send Magic Link/i }),
      ).toBeInTheDocument()
    })
  })
})
