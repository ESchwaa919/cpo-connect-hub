import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  matchAuthor,
} from '../../server/services/authorReconciliation'

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Erik Schwartz  ')).toBe('erik schwartz')
  })

  it('strips leading tilde prefix (WhatsApp unknown-contact marker)', () => {
    expect(normalizeName('~ Joana')).toBe('joana')
  })

  it('strips emoji', () => {
    expect(normalizeName('Natalia 🚀 Jaszczuk')).toBe('natalia jaszczuk')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeName('Erik   Schwartz')).toBe('erik schwartz')
  })

  it('preserves phone-number authors verbatim (lowercased trivially)', () => {
    expect(normalizeName('+44 7850 325835')).toBe('+44 7850 325835')
  })
})

describe('matchAuthor', () => {
  const profiles = [
    { email: 'erik@example.com', name: 'Erik Schwartz' },
    { email: 'joana@example.com', name: 'Joana Ribeiro' },
    { email: 'dave@example.com', name: 'Dave Killeen' },
  ]

  it('matches an exact name', () => {
    expect(matchAuthor('Erik Schwartz', profiles)).toBe('erik@example.com')
  })

  it('matches case-insensitively', () => {
    expect(matchAuthor('erik schwartz', profiles)).toBe('erik@example.com')
  })

  it('matches a single-word first name against a unique profile first name', () => {
    expect(matchAuthor('~ Joana', profiles)).toBe('joana@example.com')
  })

  it('returns null for a phone number', () => {
    expect(matchAuthor('+44 7850 325835', profiles)).toBeNull()
  })

  it('returns null for an unknown name', () => {
    expect(matchAuthor('Unknown Person', profiles)).toBeNull()
  })

  it('returns null when multiple profiles share the same first name (ambiguous)', () => {
    const ambiguous = [
      { email: 'erik1@example.com', name: 'Erik Schwartz' },
      { email: 'erik2@example.com', name: 'Erik Johnson' },
    ]
    expect(matchAuthor('Erik', ambiguous)).toBeNull()
  })

  it('returns null for the empty string', () => {
    expect(matchAuthor('', profiles)).toBeNull()
  })
})
