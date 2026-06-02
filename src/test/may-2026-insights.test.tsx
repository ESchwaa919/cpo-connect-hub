import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import May2026 from '../data/insights/may-2026'

/**
 * Smoke + phone-safety coverage for the May 2026 monthly Chat Insights page.
 * The members surface is auth-gated, so this drives the component directly:
 * it must mount, switch across all four channels via the scope picker, and —
 * the non-negotiable standing rule — never render a raw phone number.
 */

// A run of 7+ consecutive digits is a phone-shaped leak (years, salaries like
// "£110k", "1,000" are all shorter / comma-broken and won't match).
const PHONE_DIGITS = /\d{7,}/
const PHONE_PREFIX = /\+\d{1,3}[\s\d]{6,}/ // e.g. "+44 7809 606007"

function expectNoRawPhone() {
  const text = document.body.textContent ?? ''
  expect(text).not.toMatch(PHONE_DIGITS)
  expect(text).not.toMatch(PHONE_PREFIX)
  expect(text).not.toContain('606007')
}

describe('May 2026 Chat Insights page', () => {
  it('mounts and shows the aggregate stats + default AI channel', () => {
    render(<May2026 />)
    expect(screen.getByText('Total Messages')).toBeInTheDocument()
    expect(screen.getByText('783')).toBeInTheDocument()
    // Default scope is the AI channel — its headline trend should be present.
    expect(
      screen.getByText(/The Token-Burn Reckoning/i),
    ).toBeInTheDocument()
    expectNoRawPhone()
  })

  it('renders each channel without leaking a raw phone number', () => {
    render(<May2026 />)

    const channels: { radio: RegExp; marker: RegExp }[] = [
      { radio: /^general$/i, marker: /The Great No-Show Debate/i },
      { radio: /^jobs$/i, marker: /IC vs Leadership/i },
      {
        radio: /^leadership & culture$/i,
        marker: /PM Competency Framework v2/i,
      },
      { radio: /^ai$/i, marker: /The Token-Burn Reckoning/i },
    ]

    for (const { radio, marker } of channels) {
      // Open the (single-select) scope picker and switch channel.
      fireEvent.click(screen.getByRole('button', { name: /only$/i }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: radio }))
      expect(screen.getByText(marker)).toBeInTheDocument()
      expectNoRawPhone()
    }
  })
})
