import { describe, it, expect } from 'vitest'
import {
  parseWhatsappChat,
  filterMonth,
} from '../../scripts/lib/whatsapp-parser'

describe('parseWhatsappChat', () => {
  it('parses a single-line message with DD/MM/YYYY iOS timestamp', () => {
    const raw = '[05/03/2026, 14:23:11] Alice Smith: hello world'
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual({
      author: 'Alice Smith',
      text: 'hello world',
      sentAt: '2026-03-05T14:23:11.000Z',
    })
  })

  it('joins multi-line message continuations into a single text', () => {
    const raw = [
      '[05/03/2026, 14:23:11] Alice Smith: line one',
      'line two',
      'line three',
      '[05/03/2026, 14:24:00] Bob Jones: next message',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].text).toBe('line one\nline two\nline three')
    expect(parsed[1].author).toBe('Bob Jones')
    expect(parsed[1].text).toBe('next message')
  })

  it('strips the U+200E left-to-right mark that iOS inserts before timestamps', () => {
    const raw = '\u200E[05/03/2026, 14:23:11] Alice: hi'
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe('hi')
  })

  it('strips the ~ prefix from unknown contact senders', () => {
    const raw = '[05/03/2026, 14:23:11] ~Unknown Contact: hi'
    const parsed = parseWhatsappChat(raw)
    expect(parsed[0].author).toBe('Unknown Contact')
  })

  it('skips the "Messages and calls are end-to-end encrypted" system notice', () => {
    const raw = [
      '[05/03/2026, 14:00:00] Messages and calls are end-to-end encrypted. Tap to learn more.',
      '[05/03/2026, 14:23:11] Alice: hi',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Alice')
  })

  it('skips media-omitted placeholder lines', () => {
    const raw = [
      '[05/03/2026, 14:00:00] Alice: image omitted',
      '[05/03/2026, 14:01:00] Bob: video omitted',
      '[05/03/2026, 14:02:00] Alice: sticker omitted',
      '[05/03/2026, 14:03:00] Alice: real message',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe('real message')
  })

  it('skips deleted-message placeholders', () => {
    const raw = [
      '[05/03/2026, 14:00:00] Alice: This message was deleted.',
      '[05/03/2026, 14:01:00] Bob: real content',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Bob')
  })

  it('skips group membership system events (regex requires "Name: text")', () => {
    const raw = [
      '[05/03/2026, 14:00:00] Alice added Bob',
      '[05/03/2026, 14:01:00] Carol joined using this group\'s invite link',
      '[05/03/2026, 14:02:00] Bob left',
      '[05/03/2026, 14:03:00] Alice: real content',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe('real content')
  })

  it('treats single-digit day/month as valid (zero-pads internally)', () => {
    const raw = '[5/3/2026, 4:05:09] Alice: hi'
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].sentAt).toBe('2026-03-05T04:05:09.000Z')
  })

  it('returns an empty array for empty input', () => {
    expect(parseWhatsappChat('')).toEqual([])
  })

  it('converts local wall-clock to UTC when a timeZone is provided (BST)', () => {
    // 05 July 2026 15:30:00 Europe/London is BST (UTC+1) → 14:30:00 UTC.
    const raw = '[05/07/2026, 15:30:00] Alice: summer message'
    const parsed = parseWhatsappChat(raw, { timeZone: 'Europe/London' })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].sentAt).toBe('2026-07-05T14:30:00.000Z')
  })

  it('converts local wall-clock to UTC across month boundaries (BST)', () => {
    // 01 May 2026 00:30:00 Europe/London (BST) is 30 April 2026 23:30:00 UTC.
    const raw = '[1/5/2026, 00:30:00] Bob: just past midnight'
    const parsed = parseWhatsappChat(raw, { timeZone: 'Europe/London' })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].sentAt).toBe('2026-04-30T23:30:00.000Z')
  })

  it('treats GMT winter timestamps as UTC for Europe/London', () => {
    // 15 January 2026 12:00:00 Europe/London is still UTC in winter.
    const raw = '[15/01/2026, 12:00:00] Carol: winter'
    const parsed = parseWhatsappChat(raw, { timeZone: 'Europe/London' })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].sentAt).toBe('2026-01-15T12:00:00.000Z')
  })

  it('defaults to UTC interpretation when no timeZone is provided', () => {
    const raw = '[05/07/2026, 15:30:00] Alice: test'
    const parsed = parseWhatsappChat(raw)
    expect(parsed[0].sentAt).toBe('2026-07-05T15:30:00.000Z')
  })
})

describe('filterMonth', () => {
  const messages = [
    { author: 'A', text: 'feb', sentAt: '2026-02-28T23:59:00.000Z' },
    { author: 'A', text: 'mar-start', sentAt: '2026-03-01T00:00:00.000Z' },
    { author: 'A', text: 'mar-end', sentAt: '2026-03-31T23:59:59.000Z' },
    { author: 'A', text: 'apr', sentAt: '2026-04-01T00:00:00.000Z' },
  ]

  it('keeps only messages within the given YYYY-MM month (UTC)', () => {
    const filtered = filterMonth(messages, '2026-03')
    expect(filtered.map((m) => m.text)).toEqual(['mar-start', 'mar-end'])
  })

  it('returns empty when no messages fall inside the month', () => {
    expect(filterMonth(messages, '2025-12')).toEqual([])
  })

  it('throws on an invalid YYYY-MM string', () => {
    expect(() => filterMonth(messages, 'not-a-month')).toThrow()
    expect(() => filterMonth(messages, '2026-13')).toThrow()
  })
})
