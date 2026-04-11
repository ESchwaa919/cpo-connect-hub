import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceCard } from '../components/members/whats-talked/SourceCard'
import type { AskSource } from '../components/members/whats-talked/types'

function makeSource(overrides: Partial<AskSource> = {}): AskSource {
  return {
    id: '1',
    channel: 'ai',
    authorDisplayName: 'Alice Smith',
    authorOptedOut: false,
    sentAt: '2026-03-15T14:23:11.000Z',
    messageText: 'hello from the chat',
    similarity: 0.87,
    ...overrides,
  }
}

describe('SourceCard', () => {
  it('renders the author name when authorOptedOut is false', () => {
    render(<SourceCard source={makeSource()} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('A member')).not.toBeInTheDocument()
  })

  it("renders 'A member' when authorOptedOut is true, even if authorDisplayName still carries a real name", () => {
    render(
      <SourceCard
        source={makeSource({
          authorDisplayName: 'Real Leaked Name',
          authorOptedOut: true,
        })}
      />,
    )
    expect(screen.getByText('A member')).toBeInTheDocument()
    expect(screen.queryByText('Real Leaked Name')).not.toBeInTheDocument()
  })

  it('renders the message text and channel label', () => {
    render(<SourceCard source={makeSource({ channel: 'leadership_culture' })} />)
    expect(screen.getByText('hello from the chat')).toBeInTheDocument()
    expect(screen.getByText('Leadership & Culture')).toBeInTheDocument()
  })

  it('is keyboard-focusable as an article landmark with a summary aria-label', () => {
    render(
      <SourceCard
        source={makeSource({
          id: '3',
          channel: 'ai',
          authorDisplayName: 'Dana',
          authorOptedOut: false,
        })}
      />,
    )
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('tabindex', '0')
    const label = article.getAttribute('aria-label') ?? ''
    expect(label).toMatch(/Source 3/)
    expect(label).toMatch(/Dana/)
    expect(label).toMatch(/AI/)
  })
})
