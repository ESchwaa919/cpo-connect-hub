// Verifies the RouteTracker fires a fire-and-forget page-view POST on each
// client-side navigation, sends only the pathname (never the query string),
// and threads the previous path as `ref`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { RouteTracker } from '../components/RouteTracker'

function Nav({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to)
  }, [navigate, to])
  return null
}

function bodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith('/api/events/page-view'))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

describe('RouteTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the pathname on initial render', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/members/directory']}>
        <RouteTracker />
      </MemoryRouter>,
    )

    await waitFor(() => expect(bodies(fetchMock).length).toBe(1))
    expect(bodies(fetchMock)[0]).toEqual({ path: '/members/directory' })
  })

  it('sends the previous path as ref on the next navigation and strips the query string', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/members/whats-talked']}>
        <RouteTracker />
        <Routes>
          <Route
            path="/members/whats-talked"
            element={<Nav to="/members/profile?tab=links" />}
          />
          <Route path="/members/profile" element={null} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(bodies(fetchMock).length).toBe(2))
    expect(bodies(fetchMock)[1]).toEqual({
      path: '/members/profile',
      ref: '/members/whats-talked',
    })
  })
})
