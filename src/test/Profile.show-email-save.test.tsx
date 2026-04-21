// Regression test for Tania Shedley Bug 3:
// Checking "Show email on my directory card" → Save Changes failed silently
// because the linkedin_url input was type="url" and the stored value
// was missing the https:// protocol → HTML5 constraint validation blocked
// form submission.
//
// Fix: linkedin_url input uses type="text" (normalizer handles scheme on
// save) AND the PUT payload's linkedin_url is normalized before sending.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Profile from '../pages/members/Profile'

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
    email: 'tania_shedley@hotmail.co.uk',
    name: 'Tania Shedley',
    role: 'Product Director',
    current_org: 'LSEG',
    sector: 'Finance',
    location: 'London',
    focus_areas: '',
    areas_of_interest: '',
    linkedin_url: 'www.linkedin.com/in/Tania-Shedley',
    bio: '',
    skills: '',
    phone: '+447587158128',
    photo_url: '',
    gravatar_url: '',
    show_email: false,
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

describe('Profile — Tania triple-bug regression', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('linkedin_url input is not type="url" (so a legacy unprotocoled value does not block save)', async () => {
    const profile = baseProfile()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(profile)),
    )
    renderProfile()
    const input = (await screen.findByLabelText('LinkedIn URL')) as HTMLInputElement
    expect(input.type).not.toBe('url')
  })

  it('saves show_email=true with a normalized linkedin_url in the PUT body', async () => {
    const profile = baseProfile()
    let savedBody: Record<string, unknown> | null = null
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url === '/api/members/profile' && (!init || init.method === undefined)) {
          return jsonResponse(profile)
        }
        if (url === '/api/members/profile' && init?.method === 'PUT') {
          savedBody = JSON.parse(init.body as string)
          return jsonResponse({
            ...profile,
            show_email: true,
            linkedin_url: 'https://www.linkedin.com/in/Tania-Shedley',
          })
        }
        throw new Error(`Unexpected: ${url} ${init?.method ?? 'GET'}`)
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderProfile()

    // Wait for profile to load
    await screen.findByLabelText('LinkedIn URL')

    // Tick "Show on my directory card" next to Email
    const checkbox = screen.getAllByRole('checkbox', {
      name: /Show on my directory card/i,
    })[0] as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => {
      expect(savedBody).not.toBeNull()
    })
    expect(savedBody!.show_email).toBe(true)
    expect(savedBody!.linkedin_url).toBe(
      'https://www.linkedin.com/in/Tania-Shedley',
    )
  })
})
