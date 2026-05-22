// Smoke test: the public landing page must NOT render the Luma events
// section. EventsSection was relocated to /members/whats-talked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockUseAuth, mockUseTheme, mockUseInstallPrompt } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    hasChecked: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  })),
  mockUseTheme: vi.fn(() => ({ theme: 'light', toggleTheme: vi.fn() })),
  mockUseInstallPrompt: vi.fn(() => ({ canInstall: false, promptInstall: vi.fn() })),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: mockUseTheme,
}))
vi.mock('../hooks/useInstallPrompt', () => ({
  useInstallPrompt: mockUseInstallPrompt,
}))
vi.mock('../components/LoginModal', () => ({
  LoginModal: () => null,
}))

import Index from '../pages/Index'

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Index />
    </MemoryRouter>,
  )
}

describe('Landing page — events relocation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does NOT render the "Meet in person" events heading', () => {
    renderIndex()
    expect(
      screen.queryByRole('heading', { level: 2, name: /Meet in person/i }),
    ).not.toBeInTheDocument()
  })

  it('does NOT render an Events nav link on the landing page', () => {
    renderIndex()
    expect(
      screen.queryByRole('link', { name: /^Events$/i }),
    ).not.toBeInTheDocument()
  })
})
