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

  it('skips header-only lines with no body text (e.g. "Alice:")', () => {
    const raw = [
      '[05/03/2026, 14:23:11] Alice:',
      '[05/03/2026, 14:23:12] Bob: Hello',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Bob')
    expect(parsed[0].text).toBe('Hello')
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

  it('skips "advanced chat privacy" system notices (group-name authored)', () => {
    // WhatsApp emits these as `[date] <group name>: <text>` — the group name
    // carries a colon, so unlike "Alice added Bob" they DO match LINE_RE and
    // must be dropped explicitly to keep them out of the index and counts.
    const raw = [
      "[09/06/2026, 21:58:14] CPO Connect // AI: Gregor Young turned on advanced chat privacy. No one can auto-save media, export history, ask Meta AI questions, or summarise unread messages in this chat.",
      '[09/06/2026, 22:00:00] Alice: real content',
      '[02/07/2026, 10:37:56] CPO Connect // AI: You turned off advanced chat privacy.',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Alice')
    expect(parsed[0].text).toBe('real content')
  })

  it('skips "Name:"-prefixed system notices (security code, admin, group create)', () => {
    const raw = [
      '[01/06/2026, 12:10:08] Adrian Kelly: Your security code with +44 7470 963520 changed.',
      '[27/10/2025, 09:46:55] Gregor Young: You created the group: CPO Connect // AI',
      "[18/10/2025, 12:06:57] CPO Connect // AI: You're now an admin",
      '[04/06/2026, 14:13:00] +44 7495 899728: +44 7495 899728 changed their phone number to a new number. Tap to message new number.',
      '[01/06/2026, 12:11:00] Bob: real content',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Bob')
  })

  it('skips membership notices carrying the actor name (added/left/joined)', () => {
    const raw = [
      '[03/06/2026, 10:48:00] ~ Shannon: ~ Shannon was added',
      '[05/06/2026, 17:38:21] Dan Entwistle: Dan Entwistle was added',
      '[04/06/2026, 18:22:00] ~ Ellie Down: Sarah Baker-White added ~ Ellie Down',
      '[05/06/2026, 12:55:00] Laura Nana: Laura Nana left',
      "[05/03/2026, 14:01:00] Carol: Carol joined using this group's invite link",
      "[05/06/2026, 13:49:00] James Engelbert: James Engelbert changed the group description",
      '[05/06/2026, 14:00:00] Alice: real content',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].author).toBe('Alice')
    expect(parsed[0].text).toBe('real content')
  })

  it('keeps genuine messages that merely contain system-like words', () => {
    const raw = [
      '[05/06/2026, 14:00:00] Alice: Bob added a new column to the sheet',
      '[05/06/2026, 14:01:00] Bob: I left the meeting early, sorry!',
      '[05/06/2026, 14:02:00] Carol: we changed the group pricing last week',
    ].join('\n')
    const parsed = parseWhatsappChat(raw)
    expect(parsed).toHaveLength(3)
    expect(parsed.map((m) => m.author)).toEqual(['Alice', 'Bob', 'Carol'])
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

  // DST transition edges — last Sunday of March / October 2026 in
  // Europe/London. These assertions lock in the deterministic resolution
  // Intl.DateTimeFormat produces on ambiguous / non-existent wall-clock
  // times so future refactors can't silently change the behavior.

  it('handles the GMT→BST spring-forward transition (2026-03-29)', () => {
    // Clocks jump 01:00 GMT → 02:00 BST, so "01:30" local does not exist.
    // The parser resolves it deterministically to 00:30 UTC (i.e. treats
    // it as BST with a -1h offset — the "forward" side of the jump).
    const raw = [
      '[29/03/2026, 01:30:00] Alice: non-existent wallclock',
      '[29/03/2026, 02:30:00] Bob: first real BST moment',
    ].join('\n')
    const parsed = parseWhatsappChat(raw, { timeZone: 'Europe/London' })
    expect(parsed).toHaveLength(2)
    expect(parsed[0].sentAt).toBe('2026-03-29T00:30:00.000Z')
    expect(parsed[1].sentAt).toBe('2026-03-29T01:30:00.000Z')
  })

  it('handles the BST→GMT fall-back transition (2026-10-25)', () => {
    // Clocks jump 02:00 BST → 01:00 GMT, so "01:30" local happens twice:
    // once as BST (00:30 UTC) and once as GMT (01:30 UTC). The parser
    // picks the GMT occurrence deterministically (the "second" one).
    const raw = [
      '[25/10/2026, 00:30:00] Alice: last BST hour',
      '[25/10/2026, 01:30:00] Bob: ambiguous — parser picks GMT',
      '[25/10/2026, 02:30:00] Carol: firmly GMT',
    ].join('\n')
    const parsed = parseWhatsappChat(raw, { timeZone: 'Europe/London' })
    expect(parsed).toHaveLength(3)
    expect(parsed[0].sentAt).toBe('2026-10-24T23:30:00.000Z')
    expect(parsed[1].sentAt).toBe('2026-10-25T01:30:00.000Z')
    expect(parsed[2].sentAt).toBe('2026-10-25T02:30:00.000Z')
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
