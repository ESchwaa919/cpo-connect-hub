import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyNotice } from '../components/members/whats-talked/PrivacyNotice'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PrivacyNotice', () => {
  it('shows the default disclosure with a profile link when opted in', () => {
    renderWithRouter(<PrivacyNotice optedOut={false} />)
    expect(screen.getByTestId('privacy-notice-default')).toBeInTheDocument()
    expect(
      screen.getByText(/We may log the text of your questions/i),
    ).toBeInTheDocument()
    const profileLink = screen.getByRole('link', { name: /profile/i })
    expect(profileLink).toHaveAttribute('href', '/members/profile#chat-search-privacy')
  })

  it('shows the opted-out confirmation (mutually exclusive) when optedOut=true', () => {
    renderWithRouter(<PrivacyNotice optedOut={true} />)
    expect(
      screen.getByTestId('privacy-notice-opted-out'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('privacy-notice-default'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/opted out of question logging/i),
    ).toBeInTheDocument()
    const profileLink = screen.getByRole('link', { name: /profile/i })
    expect(profileLink).toHaveAttribute('href', '/members/profile#chat-search-privacy')
  })
})
