// Hermetic unit tests for pickAuthorDisplay — the display-time resolution
// chain that guarantees no raw phone number ever surfaces in a source chip.
// These cover every branch of the chain without touching the DB.
import { describe, it, expect } from 'vitest'
import { pickAuthorDisplay, type AskSourceDBRow } from '../../server/routes/chat'

function row(overrides: Partial<AskSourceDBRow> = {}): AskSourceDBRow {
  return {
    id: '1',
    channel: 'ai',
    author_name: 'Unknown',
    author_email: null,
    message_text: 'msg',
    sent_at: new Date().toISOString(),
    sender_phone: null,
    sender_display_name: null,
    live_member_name: null,
    opted_out: null,
    similarity: 0.9,
    ...overrides,
  }
}

describe('pickAuthorDisplay — resolution chain', () => {
  it('prefers the live members.display_name when available', () => {
    expect(
      pickAuthorDisplay(
        row({
          live_member_name: 'Live Directory Name',
          sender_display_name: 'Stale Snapshot',
          sender_phone: '+447911123456',
          author_name: '+44 7911 123456',
        }),
      ),
    ).toBe('Live Directory Name')
  })

  it('falls back to the frozen sender_display_name when no live match', () => {
    expect(
      pickAuthorDisplay(
        row({
          live_member_name: null,
          sender_display_name: 'Frozen Snapshot',
          sender_phone: '+447911123456',
        }),
      ),
    ).toBe('Frozen Snapshot')
  })

  it('rejects a frozen sender_display_name that still looks like a raw phone', () => {
    // Frozen value is a phone string (regression: a past ingest wrote the
    // phone into the display name). We should skip it and drop to the
    // sanitized phone.
    expect(
      pickAuthorDisplay(
        row({
          live_member_name: null,
          sender_display_name: '+44 7911 123456',
          sender_phone: '+447911123456',
        }),
      ),
    ).toBe('+44 ···· ···456')
  })

  it('sanitizes the sender_phone when no display names are available', () => {
    const out = pickAuthorDisplay(
      row({ sender_phone: '+447911123456' }),
    )
    expect(out).not.toContain('7911')
    expect(out).not.toContain('123456')
    expect(out).toMatch(/^\+44 ·+ ·+456$/)
  })

  it('sanitizes a legacy author_name that is itself a raw phone', () => {
    const out = pickAuthorDisplay(
      row({ author_name: '+44 7911 123456' }),
    )
    expect(out).not.toContain('7911')
    expect(out).not.toContain('123456')
    expect(out).toMatch(/^\+44 ·+ ·+456$/)
  })

  it('returns the legacy author_name verbatim when it is a plain name', () => {
    expect(
      pickAuthorDisplay(row({ author_name: 'Sarah Jenkins' })),
    ).toBe('Sarah Jenkins')
  })

  it('never surfaces a raw phone across ALL combinations of null/phone fields', () => {
    // Exhaustive sweep: every resolvable combination must either yield
    // a human name or a sanitized (masked) phone — NEVER raw digits.
    const phone = '+447911123456'
    const rawAuthor = '+44 7911 123456'
    const permutations: Array<Partial<AskSourceDBRow>> = [
      { live_member_name: 'Live Name' },
      { sender_display_name: 'Frozen Name' },
      { sender_phone: phone },
      { author_name: rawAuthor },
      { sender_display_name: 'Frozen Name', sender_phone: phone },
      { sender_phone: phone, author_name: rawAuthor },
      { live_member_name: 'Live Name', sender_phone: phone, author_name: rawAuthor },
    ]
    for (const p of permutations) {
      const out = pickAuthorDisplay(row(p))
      expect(out).not.toMatch(/7911/)
      expect(out).not.toMatch(/123456/)
    }
  })
})
