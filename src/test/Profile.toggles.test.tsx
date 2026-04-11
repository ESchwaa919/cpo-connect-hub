// Batch 6 pull-forward: asserts the new "Chat Search Privacy" toggles
// in Profile.tsx wire correctly to the PUT /api/members/profile payload.
// Stubs global fetch with mutable state so we can inspect the body of
// the save request and then re-render with the updated profile.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Profile from '../pages/members/Profile'
import { Toaster } from 'sonner'

interface MockProfile {
  email: string
  name: string
  role: string
  current_org: string
  sector: string
  location: string
  focus_areas: string
  areas_of_interest: string
  linkedin_url: string
  bio: string | null
  skills: string
  phone: string
  photo_url: string
  gravatar_url: string
  show_email: boolean
  show_phone: boolean
  chat_identification_opted_out: boolean
  chat_query_logging_opted_out: boolean
  updated_at: string | null
}

function baseProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    email: 'test@example.com',
    name: 'Test Member',
    role: 'Head of Product',
    current_org: 'Acme',
    sector: 'Fintech',
    location: 'London',
    focus_areas: '',
    areas_of_interest: '',
    linkedin_url: '',
    bio: '',
    skills: '',
    phone: '',
    photo_url: '',
    gravatar_url: '',
    show_email: true,
    show_phone: false,
    chat_identification_opted_out: false,
    chat_query_logging_opted_out: false,
    updated_at: null,
    ...overrides,
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Profile />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Profile — Chat Search Privacy toggles', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders both toggles ON when both opt-out flags are false (default)', async () => {
    const profile = baseProfile()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/members/profile') return jsonResponse(profile)
        throw new Error(`Unexpected: ${url}`)
      }),
    )
    renderProfile()

    const idToggle = (await screen.findByTestId(
      'chat-identification-toggle',
    )) as HTMLInputElement
    const loggingToggle = screen.getByTestId(
      'chat-query-logging-toggle',
    ) as HTMLInputElement

    expect(idToggle.checked).toBe(true)
    expect(loggingToggle.checked).toBe(true)
  })

  it('renders the identification toggle OFF when chat_identification_opted_out is true', async () => {
    const profile = baseProfile({ chat_identification_opted_out: true })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/members/profile') return jsonResponse(profile)
        throw new Error(`Unexpected: ${url}`)
      }),
    )
    renderProfile()

    const idToggle = (await screen.findByTestId(
      'chat-identification-toggle',
    )) as HTMLInputElement
    expect(idToggle.checked).toBe(false)
  })

  it('PUTs chat_identification_opted_out=true when the user turns the identification toggle off', async () => {
    const profile = baseProfile()
    let savedBody: Record<string, unknown> | null = null
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/members/profile' && (!init || init.method === undefined)) {
        return jsonResponse(profile)
      }
      if (url === '/api/members/profile' && init?.method === 'PUT') {
        savedBody = JSON.parse(init.body as string)
        return jsonResponse({
          ...profile,
          chat_identification_opted_out: true,
        })
      }
      throw new Error(`Unexpected: ${url} ${init?.method ?? 'GET'}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()

    const idToggle = (await screen.findByTestId(
      'chat-identification-toggle',
    )) as HTMLInputElement
    expect(idToggle.checked).toBe(true)

    // User flips the toggle OFF — "Show my name" becomes unchecked,
    // which maps to chat_identification_opted_out: true.
    fireEvent.click(idToggle)
    expect(idToggle.checked).toBe(false)

    const saveButton = screen.getByRole('button', { name: /Save Changes/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(savedBody).not.toBeNull()
    })
    expect(savedBody!.chat_identification_opted_out).toBe(true)
  })

  it('PUTs chat_query_logging_opted_out=true when the user turns the logging toggle off', async () => {
    const profile = baseProfile()
    let savedBody: Record<string, unknown> | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/members/profile' && (!init || init.method === undefined)) {
          return jsonResponse(profile)
        }
        if (url === '/api/members/profile' && init?.method === 'PUT') {
          savedBody = JSON.parse(init.body as string)
          return jsonResponse({
            ...profile,
            chat_query_logging_opted_out: true,
          })
        }
        throw new Error(`Unexpected: ${url} ${init?.method ?? 'GET'}`)
      }),
    )
    renderProfile()

    const loggingToggle = (await screen.findByTestId(
      'chat-query-logging-toggle',
    )) as HTMLInputElement

    fireEvent.click(loggingToggle)
    expect(loggingToggle.checked).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => {
      expect(savedBody).not.toBeNull()
    })
    expect(savedBody!.chat_query_logging_opted_out).toBe(true)
    // Identification toggle untouched → stays false in payload.
    expect(savedBody!.chat_identification_opted_out).toBe(false)
  })

  it('exposes the chat-search-privacy section id for deep-link anchor', async () => {
    const profile = baseProfile()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/members/profile') return jsonResponse(profile)
        throw new Error(`Unexpected: ${url}`)
      }),
    )
    const { container } = renderProfile()

    await screen.findByTestId('chat-identification-toggle')
    const section = container.querySelector('#chat-search-privacy')
    expect(section).not.toBeNull()
  })
})
