import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockUseAuth, mockUseTheme, mockUseInstallPrompt } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
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

import { Navbar } from '../components/Navbar'

function authedAs(user: { email: string; name: string; isAdmin: boolean } | null) {
  mockUseAuth.mockReturnValue({
    user,
    isAuthenticated: user !== null,
    hasChecked: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  })
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/members/whats-talked']}>
      <Navbar />
    </MemoryRouter>,
  )
}

describe('Navbar — members area redesign', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('renders Search Chat as the first member link', () => {
    authedAs({ email: 'm@example.com', name: 'Test', isAdmin: false })
    renderNav()
    const searchChat = screen.getByRole('link', { name: 'Search Chat' })
    expect(searchChat).toHaveAttribute('href', '/members/whats-talked')

    const memberLinks = document.querySelectorAll('nav a[href^="/members/"]')
    // First member link in the top nav should be Search Chat
    expect(memberLinks[0]?.getAttribute('href')).toBe('/members/whats-talked')
  })

  it('does NOT render Profile as a top-nav link', () => {
    authedAs({ email: 'm@example.com', name: 'Test', isAdmin: false })
    renderNav()
    const topNav = document.querySelector('nav')
    // The avatar dropdown is portalled to document.body and not rendered
    // until opened, so the top-nav should contain zero /members/profile
    // anchors in its initial tree.
    expect(
      topNav?.querySelectorAll('a[href="/members/profile"]').length,
    ).toBe(0)
  })

  it('does NOT render Admin · Ingestion as a top-nav link', () => {
    authedAs({ email: 'admin@example.com', name: 'Admin', isAdmin: true })
    renderNav()
    const topNav = document.querySelector('nav')
    expect(
      topNav?.querySelectorAll('a[href="/members/admin/ingestion-history"]')
        .length,
    ).toBe(0)
  })

  it('landing-page "Members Area" CTA points at /members/whats-talked', () => {
    authedAs({ email: 'm@example.com', name: 'Test', isAdmin: false })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    )
    const cta = screen.getByRole('link', { name: /members area/i })
    expect(cta).toHaveAttribute('href', '/members/whats-talked')
  })
})
