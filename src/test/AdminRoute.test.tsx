// Security-sensitive route guard — cover all four branches:
// 1. auth-check loading → spinner
// 2. unauthenticated → redirect to "/"
// 3. authenticated non-admin → 403 card
// 4. authenticated admin → renders children
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminRoute } from '../components/AdminRoute'
import { AuthProvider } from '../contexts/AuthContext'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface MeStub {
  status?: number
  body?: unknown
}

/** Stub /api/auth/me + ensure document.cookie looks like there's a
 *  session so AuthProvider actually calls checkAuth(). */
function setupAuth(me: MeStub) {
  // ProtectedRoute only calls checkAuth if hasChecked is false, and
  // AuthProvider's mount effect only calls it if the hint cookie is
  // present. Seed it so the effect fires.
  document.cookie = 'cpo_has_session=1; path=/'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/auth/me') {
        return jsonResponse(me.body ?? {}, me.status ?? 200)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

function renderWithRoute(
  initialPath = '/members/admin/ingestion-history',
) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div data-testid="landing">Landing</div>} />
          <Route
            path="/members/admin/ingestion-history"
            element={
              <AdminRoute>
                <div data-testid="protected-child">Secret admin content</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = 'cpo_has_session=; path=/; max-age=0'
  })

  it('renders a loading spinner while the auth check is in flight', async () => {
    // Return a fetch that never resolves so the provider sits in isLoading.
    document.cookie = 'cpo_has_session=1; path=/'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      ),
    )
    const { container } = renderWithRoute()
    // Lucide's Loader2 renders an <svg> with class name containing "animate-spin"
    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).not.toBeNull()
    })
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-denied')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to the landing page', async () => {
    setupAuth({ status: 401, body: { error: 'not_authenticated' } })
    renderWithRoute()
    expect(await screen.findByTestId('landing')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-denied')).not.toBeInTheDocument()
  })

  it('renders the 403 card for authenticated non-admins', async () => {
    setupAuth({
      body: {
        name: 'Jo Member',
        email: 'jo@example.com',
        jobRole: 'PM',
        isAdmin: false,
      },
    })
    renderWithRoute()
    expect(await screen.findByTestId('admin-denied')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /Admin access required/i }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument()
  })

  it('renders children for authenticated admins', async () => {
    setupAuth({
      body: {
        name: 'Erik Admin',
        email: 'erik@theaiexpert.ai',
        jobRole: 'Eng',
        isAdmin: true,
      },
    })
    renderWithRoute()
    expect(
      await screen.findByTestId('protected-child'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('admin-denied')).not.toBeInTheDocument()
  })

  it('fails closed when /api/auth/me omits isAdmin (defaults to non-admin)', async () => {
    setupAuth({
      body: { name: 'Legacy', email: 'legacy@example.com', jobRole: 'X' },
    })
    renderWithRoute()
    expect(await screen.findByTestId('admin-denied')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument()
  })
})
