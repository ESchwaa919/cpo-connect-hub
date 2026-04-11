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
      return jsonResponse(next)
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
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
