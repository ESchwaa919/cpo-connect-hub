// Page-level integration test for WhatsTalked. Stubs global fetch so
// the real React Query + useSearchParams wiring is exercised without
// hitting a real server.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
}

function stubFetch(routes: StubRoutes): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api/members/profile')) {
      if (routes.profile instanceof Error) throw routes.profile
      return jsonResponse(routes.profile ?? {})
    }
    if (url.startsWith('/api/chat/prompt-tiles')) {
      return jsonResponse(routes.promptTiles ?? { current: [], evergreen: [] })
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
    const link = notice.querySelector('a[href="/members/profile"]')
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
    const link = notice.querySelector('a[href="/members/profile"]')
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
