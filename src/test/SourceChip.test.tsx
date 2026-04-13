import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SourceChip } from '../components/members/whats-talked/SourceChip'
import type { AskSource } from '../components/members/whats-talked/types'

function source(overrides: Partial<AskSource> = {}): AskSource {
  return {
    id: '1',
    channel: 'ai',
    authorDisplayName: 'Sarah Jenkins',
    authorOptedOut: false,
    sentAt: '2026-03-12T10:00:00.000Z',
    messageText: 'This is the excerpt of the message.',
    similarity: 0.85,
    ...overrides,
  }
}

describe('SourceChip', () => {
  it('renders the author name, channel label, and date year in the trigger', () => {
    render(<SourceChip source={source()} />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveTextContent(/Sarah Jenkins/)
    expect(trigger).toHaveTextContent(/AI/)
    expect(trigger).toHaveTextContent(/2026/)
  })

  it('renders "A member" when the author opted out', () => {
    render(<SourceChip source={source({ authorOptedOut: true })} />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveTextContent(/A member/)
    expect(trigger).not.toHaveTextContent(/Sarah Jenkins/)
  })

  it('preserves a sanitized phone fallback verbatim in the display name slot', () => {
    render(
      <SourceChip
        source={source({
          authorDisplayName: '+44 ···· ···999',
          authorOptedOut: false,
        })}
      />,
    )
    expect(screen.getByRole('button')).toHaveTextContent(/\+44 ···· ···999/)
  })

  it('is keyboard-focusable', () => {
    render(<SourceChip source={source()} />)
    const trigger = screen.getByRole('button')
    // Native <button> is tab-focusable by default — no explicit tabindex needed.
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger).not.toHaveAttribute('disabled')
  })

  it('opens the popover on click and shows the excerpt', () => {
    render(<SourceChip source={source()} />)
    // Popover not visible initially.
    expect(
      screen.queryByText(/excerpt of the message/),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/excerpt of the message/)).toBeInTheDocument()
  })

  it('truncates a long excerpt with an ellipsis', () => {
    const longText =
      'Long message body that repeats itself. '.repeat(20).trim()
    render(<SourceChip source={source({ messageText: longText })} />)
    fireEvent.click(screen.getByRole('button'))
    const popoverBody = screen.getByTestId('source-chip-popover-body')
    expect(popoverBody.textContent ?? '').toContain('…')
    expect((popoverBody.textContent ?? '').length).toBeLessThan(longText.length)
  })

  it('maps known channel ids to human labels (leadership → L&C)', () => {
    render(<SourceChip source={source({ channel: 'leadership' })} />)
    expect(screen.getByRole('button')).toHaveTextContent(/L&C/)
  })
})
