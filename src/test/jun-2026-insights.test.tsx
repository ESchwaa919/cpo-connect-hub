import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import June2026 from '../data/insights/jun-2026'

/**
 * Smoke + phone-safety coverage for the June 2026 monthly Chat Insights page.
 * The members surface is auth-gated, so this drives the component directly:
 * it must mount, switch across all four channels via the scope picker, and —
 * the non-negotiable standing rule — never render a raw phone number.
 */

// A run of 7+ consecutive digits is a phone-shaped leak (years, counts like
// "1,067" and "78,000" are comma-broken and won't match).
const PHONE_DIGITS = /\d{7,}/
const PHONE_PREFIX = /\+\d{1,3}[\s\d]{6,}/ // e.g. "+44 7809 606007"

function expectNoRawPhone() {
  const text = document.body.textContent ?? ''
  expect(text).not.toMatch(PHONE_DIGITS)
  expect(text).not.toMatch(PHONE_PREFIX)
}

describe('June 2026 Chat Insights page', () => {
  it('mounts and shows the aggregate stats + default AI channel', () => {
    render(<June2026 />)
    expect(screen.getByText('Total Messages')).toBeInTheDocument()
    expect(screen.getByText('1067')).toBeInTheDocument()
    // Default scope is the AI channel — its headline trend should be present.
    expect(screen.getByText(/Fable 5 Lands/i)).toBeInTheDocument()
    expectNoRawPhone()
  })

  it('renders each channel without leaking a raw phone number', () => {
    const channels: { radio: RegExp; marker: RegExp }[] = [
      { radio: /^general$/i, marker: /The Karaoke Insurrection/i },
      { radio: /^jobs$/i, marker: /RTO on Trial/i },
      {
        radio: /^leadership & culture$/i,
        marker: /Codifying Decision Rights/i,
      },
    ]

    // Fresh render per channel: the scope picker is a Radix menu that jsdom
    // won't reliably re-open with fireEvent within a single mounted tree, so
    // each channel gets a clean first-open rather than chaining selections.
    for (const { radio, marker } of channels) {
      render(<June2026 />)
      fireEvent.click(screen.getByRole('button', { name: /only$/i }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: radio }))
      expect(screen.getByText(marker)).toBeInTheDocument()
      expectNoRawPhone()
      cleanup()
    }
  })
})
