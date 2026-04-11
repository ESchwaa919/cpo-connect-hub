// Integration test for the admin ingestion history page. Stubs global
// fetch so the real React Query wiring is exercised without a server.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminIngestionHistory from '../pages/members/AdminIngestionHistory'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminIngestionHistory />
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

interface RunRow {
  id: number
  runStartedAt: string
  runCompletedAt: string | null
  triggeredBy: string
  sourceMonths: string[]
  messagesIngested: number
  messagesSkipped: number
  status: 'running' | 'success' | 'failed'
  errorMessage: string | null
}

function successBody(runs: RunRow[]) {
  return {
    runs,
    totalMessages: runs.reduce((n, r) => n + r.messagesIngested, 0),
    latestMessageAt: runs[0]?.runStartedAt ?? '',
  }
}

function stubIngestionRuns(responder: () => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api/admin/chat/ingestion-runs')) {
      return responder()
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

const sampleRun: RunRow = {
  id: 42,
  runStartedAt: '2026-03-15T10:30:45.000Z',
  runCompletedAt: '2026-03-15T10:31:00.000Z',
  triggeredBy: 'Erik Schwaa',
  sourceMonths: ['2026-03'],
  messagesIngested: 128,
  messagesSkipped: 3,
  status: 'success',
  errorMessage: null,
}

describe('AdminIngestionHistory', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a loading state before the runs query resolves', () => {
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      ),
    )
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders the page title, corpus aggregates, and a row per run on success', async () => {
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(() =>
        jsonResponse({
          runs: [
            sampleRun,
            {
              ...sampleRun,
              id: 41,
              triggeredBy: 'Ingestion Script',
              status: 'failed' as const,
              messagesIngested: 0,
              messagesSkipped: 17,
              errorMessage: 'Gemini 500',
              runCompletedAt: null,
            },
          ],
          totalMessages: 9876,
          latestMessageAt: '2026-03-16T08:00:00.000Z',
        }),
      ),
    )
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: /Ingestion History/i }),
    ).toBeInTheDocument()

    // Corpus aggregates (async — rendered after the query resolves).
    expect(await screen.findByText('9,876')).toBeInTheDocument()
    expect(screen.getByText(/Total messages/i)).toBeInTheDocument()
    expect(screen.getByText(/Latest message/i)).toBeInTheDocument()

    // Per-run table cells.
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Erik Schwaa')).toBeInTheDocument()
    expect(screen.getByText('128')).toBeInTheDocument()

    expect(screen.getByText('41')).toBeInTheDocument()
    expect(screen.getByText('Ingestion Script')).toBeInTheDocument()
    expect(screen.getByText(/Gemini 500/)).toBeInTheDocument()

    // Both success and failed status badges.
    const statusCells = screen.getAllByText(/success|failed/i)
    expect(statusCells.length).toBeGreaterThanOrEqual(2)
  })

  it('renders an empty-state when runs is an empty array', async () => {
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(() => jsonResponse(successBody([]))),
    )
    renderPage()

    expect(
      await screen.findByText(/No ingestion runs recorded yet/i),
    ).toBeInTheDocument()
  })

  it('renders an error-state when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(() =>
        jsonResponse({ error: 'internal' }, 500),
      ),
    )
    renderPage()

    expect(
      await screen.findByText(/Couldn't load ingestion history/i),
    ).toBeInTheDocument()
  })

  it('wraps the Latest message aggregate timestamp in <time dateTime={iso}>', async () => {
    const latestIso = '2026-04-11T10:30:00.000Z'
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(() =>
        jsonResponse({
          runs: [],
          totalMessages: 0,
          latestMessageAt: latestIso,
        }),
      ),
    )
    renderPage()

    // The Latest message card must render the raw ISO string on a
    // <time dateTime=…> element so screen readers / copy-paste can
    // pick up the machine-readable value.
    await waitFor(() => {
      const timeEl = document.querySelector<HTMLTimeElement>(
        `time[datetime="${latestIso}"]`,
      )
      expect(timeEl).not.toBeNull()
      expect(timeEl?.textContent?.length).toBeGreaterThan(0)
    })
  })

  it("wraps each run's Started cell in <time dateTime={iso}>", async () => {
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(() =>
        jsonResponse(successBody([sampleRun])),
      ),
    )
    renderPage()

    await screen.findByText('Erik Schwaa')
    const timeEl = document.querySelector<HTMLTimeElement>(
      `time[datetime="${sampleRun.runStartedAt}"]`,
    )
    expect(timeEl).not.toBeNull()
    expect(timeEl?.textContent?.length).toBeGreaterThan(0)
  })

  it('does NOT render a <time> wrapper when latestMessageAt is an empty string', async () => {
    vi.stubGlobal(
      'fetch',
      stubIngestionRuns(() =>
        jsonResponse({
          runs: [],
          totalMessages: 0,
          latestMessageAt: '',
        }),
      ),
    )
    renderPage()

    // Wait for the page to fully render the aggregates (empty runs
    // branch renders the empty-state card alongside them).
    await screen.findByText(/No ingestion runs recorded yet/i)
    // An empty latestMessageAt must fall through to the em-dash without
    // producing a bogus <time dateTime=""> element.
    const bogusTime = document.querySelector('time[datetime=""]')
    expect(bogusTime).toBeNull()
    // Verify the em-dash fallback renders inside the Latest message card.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('uses the correct endpoint URL (/api/admin/chat/ingestion-runs)', async () => {
    const fetchMock = stubIngestionRuns(() =>
      jsonResponse(successBody([sampleRun])),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderPage()

    await screen.findByText('Erik Schwaa')
    const called = fetchMock.mock.calls.find((c) => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0])
      return url === '/api/admin/chat/ingestion-runs'
    })
    expect(called).toBeDefined()
  })
})
