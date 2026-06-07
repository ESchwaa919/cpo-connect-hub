// Integration test for the admin analytics page. Stubs global fetch so the
// real React Query wiring is exercised without a server.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminAnalytics from '../pages/members/AdminAnalytics'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleOverview = {
  windowDays: 30,
  visits: {
    total: 142,
    anonymous: 17,
    perDay: [
      { day: '2026-06-01', count: 40 },
      { day: '2026-06-02', count: 102 },
    ],
  },
  users: { unique: 23, repeat: 9 },
  engagement: {
    topPaths: [
      { path: '/members/whats-talked', count: 88 },
      { path: '/members/directory', count: 30 },
    ],
    perUser: [
      {
        email: 'alice@example.com',
        events: 50,
        activeDays: 5,
        lastSeen: '2026-06-02T10:00:00.000Z',
      },
    ],
  },
  journeys: [
    {
      email: 'alice@example.com',
      steps: [
        { path: '/members/whats-talked', at: '2026-06-02T09:00:00.000Z' },
        { path: '/members/directory', at: '2026-06-02T09:05:00.000Z' },
      ],
    },
  ],
}

function stubOverview(responder: () => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api/admin/analytics/overview')) {
      return responder()
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

describe('AdminAnalytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders headline metrics and table data from the overview endpoint', async () => {
    vi.stubGlobal('fetch', stubOverview(() => jsonResponse(sampleOverview)))
    renderPage()

    // Headline counters
    expect(await screen.findByText('142')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()

    // Top path + per-user + journey content
    expect(
      screen.getAllByText('/members/whats-talked').length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0)
  })

  it('shows an error card when the endpoint fails', async () => {
    vi.stubGlobal('fetch', stubOverview(() => jsonResponse({}, 500)))
    renderPage()

    await waitFor(() =>
      expect(screen.getByText("Couldn't load analytics")).toBeInTheDocument(),
    )
  })
})
