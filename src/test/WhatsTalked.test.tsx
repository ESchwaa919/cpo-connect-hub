// Page-level integration test for WhatsTalked. Stubs global fetch so
// the real React Query + useSearchParams wiring is exercised without
// hitting a real server.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WhatsTalked from '../pages/members/WhatsTalked'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/members/whats-talked']}>
        <WhatsTalked />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface AskStub {
  status?: number
  body: unknown
  headers?: Record<string, string>
}

function askReply(stub: unknown): Response {
  // Accept either a raw success body (becomes 200) or an AskStub with
  // explicit status/headers for error cases.
  if (
    stub !== null &&
    typeof stub === 'object' &&
    'body' in (stub as Record<string, unknown>)
  ) {
    const s = stub as AskStub
    return new Response(JSON.stringify(s.body), {
      status: s.status ?? 200,
      headers: {
        'Content-Type': 'application/json',
        ...(s.headers ?? {}),
      },
    })
  }
  return jsonResponse(stub)
}

interface StubRoutes {
  profile?: { chat_query_logging_opted_out?: boolean } | Error
  promptTiles?: {
    current: Array<{ id: string; title: string; query: string }>
    evergreen: Array<{ id: string; title: string; query: string }>
  }
  askResponses?: unknown[]
}

function stubFetch(routes: StubRoutes): ReturnType<typeof vi.fn> {
  const askResponses = [...(routes.askResponses ?? [])]
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api/members/profile')) {
      if (routes.profile instanceof Error) throw routes.profile
      return jsonResponse(routes.profile ?? {})
    }
    if (url.startsWith('/api/chat/prompt-tiles')) {
      return jsonResponse(routes.promptTiles ?? { current: [], evergreen: [] })
    }
    if (url.startsWith('/api/chat/ask')) {
      const next = askResponses.shift()
      if (next === undefined) {
        throw new Error(`Ran out of stubbed ask responses for ${url}`)
      }
      return askReply(next)
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

async function submitQuery(query: string): Promise<void> {
  const textarea = screen.getByRole('textbox')
  const submit = screen.getByRole('button', { name: /Ask/i })
  fireEvent.change(textarea, { target: { value: query } })
  fireEvent.click(submit)
}

describe('WhatsTalked page — privacy disclosure', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the default disclosure with a profile link when the profile reports opted-in', async () => {
    vi.stubGlobal('fetch', stubFetch({ profile: { chat_query_logging_opted_out: false } }))
    renderPage()

    expect(
      await screen.findByTestId('privacy-notice-default'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('privacy-notice-opted-out'),
    ).not.toBeInTheDocument()

    // Both the default disclosure and the error-fallback share a "profile"
    // link target; assert the notice itself contains the link.
    const notice = screen.getByTestId('privacy-notice-default')
    const link = notice.querySelector('a[href="/members/profile#chat-search-privacy"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toMatch(/profile/i)
  })

  it('renders the opted-out confirmation when the profile reports opted-out', async () => {
    vi.stubGlobal('fetch', stubFetch({ profile: { chat_query_logging_opted_out: true } }))
    renderPage()

    expect(
      await screen.findByTestId('privacy-notice-opted-out'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('privacy-notice-default'),
    ).not.toBeInTheDocument()

    const notice = screen.getByTestId('privacy-notice-opted-out')
    const link = notice.querySelector('a[href="/members/profile#chat-search-privacy"]')
    expect(link).not.toBeNull()
  })

  it('falls back to the default disclosure when the profile fetch fails', async () => {
    vi.stubGlobal('fetch', stubFetch({ profile: new Error('boom') }))
    renderPage()

    // A profile lookup failure must not hide the required disclosure.
    await waitFor(() => {
      expect(
        screen.getByTestId('privacy-notice-default'),
      ).toBeInTheDocument()
    })
  })

  it('refetches a fresh answer when the same question is re-submitted', async () => {
    const fetchMock = stubFetch({
      profile: {},
      askResponses: [
        {
          answer: 'First answer from cache',
          sources: [],
          queryMs: 10,
          model: 'claude-sonnet-4-5',
        },
        {
          answer: 'Second answer after re-submit',
          sources: [],
          queryMs: 11,
          model: 'claude-sonnet-4-5',
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage()

    // Wait for the privacy notice to confirm the page mounted.
    await screen.findByTestId('privacy-notice-default')

    const textarea = screen.getByRole('textbox')
    const submit = screen.getByRole('button', { name: /Ask/i })

    fireEvent.change(textarea, { target: { value: 'what is new?' } })
    fireEvent.click(submit)

    expect(
      await screen.findByText('First answer from cache'),
    ).toBeInTheDocument()

    // Count the number of /api/chat/ask calls so far.
    const askCallsAfterFirst = fetchMock.mock.calls.filter((c) => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0])
      return url.startsWith('/api/chat/ask')
    }).length
    expect(askCallsAfterFirst).toBe(1)

    // Re-submit the exact same query. The 5-minute staleTime would
    // normally serve from cache, but the explicit submit must refetch.
    fireEvent.change(textarea, { target: { value: 'what is new?' } })
    fireEvent.click(submit)

    expect(
      await screen.findByText('Second answer after re-submit'),
    ).toBeInTheDocument()

    const askCallsAfterSecond = fetchMock.mock.calls.filter((c) => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0])
      return url.startsWith('/api/chat/ask')
    }).length
    expect(askCallsAfterSecond).toBe(2)
  })

  it('renders the page heading and suggested-prompts section', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        promptTiles: {
          current: [{ id: '1', title: 'Current tile', query: 'Current query' }],
          evergreen: [],
        },
      }),
    )
    renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /What's Everyone Talking About/i,
      }),
    ).toBeInTheDocument()

    expect(await screen.findByText('Current tile')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Error-state coverage — one test per backend failure mode + zero-match +
// focus-on-resubmit. Each test stubs /api/chat/ask with a different shape
// and asserts the user-visible UI.
// ---------------------------------------------------------------------------

describe('WhatsTalked error handling', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the rate-limit error + disables AskForm during the countdown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          {
            status: 429,
            body: { error: 'rate_limited', retryAfterSec: 3 },
            headers: { 'Retry-After': '3' },
          },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    await submitQuery('hi')

    expect(await screen.findByText(/Rate limit reached/i)).toBeInTheDocument()
    // Countdown label is shared between the inline ErrorCard retry
    // button and the AskForm submit button; both should show it and
    // both should be disabled while the countdown is running.
    await waitFor(() => {
      const countdownButtons = screen.getAllByRole('button', {
        name: /Retry in \d+s/i,
      })
      expect(countdownButtons.length).toBeGreaterThanOrEqual(2)
      for (const btn of countdownButtons) {
        expect(btn).toBeDisabled()
      }
    })
  })

  it('renders the embedding-unavailable error (has retryAfterSec)', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          {
            status: 503,
            body: { error: 'embedding_unavailable', retryAfterSec: 30 },
          },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    await submitQuery('why?')

    expect(
      await screen.findByText(/Search temporarily unavailable/i),
    ).toBeInTheDocument()
    await waitFor(() => {
      const countdownButtons = screen.getAllByRole('button', {
        name: /Retry in \d+s/i,
      })
      expect(countdownButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders the synthesis-unavailable error with an immediate Try again button', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          { status: 503, body: { error: 'synthesis_unavailable' } },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    await submitQuery('why?')

    expect(
      await screen.findByText(/Answer service temporarily unavailable/i),
    ).toBeInTheDocument()
    // No countdown label — a plain "Try again" button.
    expect(
      await screen.findByRole('button', { name: /Try again/i }),
    ).toBeInTheDocument()
    // AskForm remains enabled (no retryAfterSec → no page-level lock).
    expect(screen.getByRole('button', { name: /^Ask$/i })).not.toBeDisabled()
  })

  it('renders the bad_query error without a retry button', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          { status: 400, body: { error: 'bad_query' } },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    await submitQuery('something')

    expect(
      await screen.findByText(/couldn't be processed/i),
    ).toBeInTheDocument()
    // bad_query is user error — no retry control.
    expect(
      screen.queryByRole('button', { name: /Try again/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Retry in \d+s/i }),
    ).not.toBeInTheDocument()
  })

  it('renders a generic error card with retry for 500 internal', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          { status: 500, body: { error: 'internal' } },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    await submitQuery('something')

    expect(
      await screen.findByText(/Something went wrong/i),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Try again/i }),
    ).toBeInTheDocument()
  })

  it('renders the zero-match card when the backend returns answer: null', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          {
            answer: null,
            sources: [],
            queryMs: 40,
            model: null,
            message: 'No relevant chat history found for this question',
          },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    await submitQuery('does this exist?')

    expect(
      await screen.findByText(/No relevant history found/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No relevant chat history found for this question/i),
    ).toBeInTheDocument()
  })

  it('moves focus to the answer heading on every submission (including same-query resubmit)', async () => {
    vi.stubGlobal(
      'fetch',
      stubFetch({
        profile: {},
        askResponses: [
          { answer: 'first', sources: [], queryMs: 1, model: 'x' },
          { answer: 'second', sources: [], queryMs: 2, model: 'x' },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId('privacy-notice-default')

    // First submission → focus should land on the answer heading.
    await submitQuery('same question')
    const firstHeading = await screen.findByRole('heading', {
      level: 3,
      name: /^Answer$/,
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(firstHeading)
    })

    // Move focus elsewhere so we can prove the second submit moves it back.
    screen.getByRole('textbox').focus()
    expect(document.activeElement).toBe(screen.getByRole('textbox'))

    // Same query, re-submitted — the submission counter in focusKey
    // should trigger the focus effect again.
    await submitQuery('same question')
    await screen.findByText('second')
    const secondHeading = await screen.findByRole('heading', {
      level: 3,
      name: /^Answer$/,
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(secondHeading)
    })
  })
})
