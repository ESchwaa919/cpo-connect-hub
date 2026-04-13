import { describe, it, expect } from 'vitest'
import {
  ALL_CHANNELS,
  parseChannelScopeParam,
  serializeChannelScopeParam,
  labelForChannelScope,
} from '../lib/channel-scope-params'

describe('parseChannelScopeParam', () => {
  it('returns all channels when no param is present', () => {
    const v = parseChannelScopeParam(new URLSearchParams(''))
    expect(v.mode).toBe('all')
    expect(v.ids).toEqual([...ALL_CHANNELS])
  })

  it('parses a comma-separated `channels` param into a subset', () => {
    const v = parseChannelScopeParam(
      new URLSearchParams('channels=ai,general'),
    )
    expect(v.mode).toBe('subset')
    expect(v.ids.sort()).toEqual(['ai', 'general'])
  })

  it('parses a single-value `channel` param (legacy back-compat)', () => {
    const v = parseChannelScopeParam(new URLSearchParams('channel=general'))
    expect(v.mode).toBe('subset')
    expect(v.ids).toEqual(['general'])
  })

  it('treats `channels=all` as the all-channels sentinel', () => {
    const v = parseChannelScopeParam(new URLSearchParams('channels=all'))
    expect(v.mode).toBe('all')
  })

  it('drops unknown channel ids but keeps the known ones', () => {
    const v = parseChannelScopeParam(
      new URLSearchParams('channels=general,fake,ai'),
    )
    expect(v.mode).toBe('subset')
    expect(v.ids.sort()).toEqual(['ai', 'general'])
  })

  it('collapses a subset equal to every channel back to the all sentinel', () => {
    const v = parseChannelScopeParam(
      new URLSearchParams('channels=general,ai,leadership_culture'),
    )
    expect(v.mode).toBe('all')
  })

  it('falls back to all-channels when every id is unknown', () => {
    const v = parseChannelScopeParam(new URLSearchParams('channels=foo,bar'))
    expect(v.mode).toBe('all')
  })

  it('ignores a legacy ?channel=foo when ?channels=... is also present', () => {
    const v = parseChannelScopeParam(
      new URLSearchParams('channel=ai&channels=general'),
    )
    // Plural wins. Explicit behavior: plural is the canonical form.
    expect(v.mode).toBe('subset')
    expect(v.ids).toEqual(['general'])
  })
})

describe('serializeChannelScopeParam', () => {
  it('returns an empty object for the all-channels sentinel', () => {
    expect(
      serializeChannelScopeParam({ mode: 'all', ids: [...ALL_CHANNELS] }),
    ).toEqual({})
  })

  it('serializes a subset as a comma-separated `channels` value', () => {
    expect(
      serializeChannelScopeParam({ mode: 'subset', ids: ['ai', 'general'] }),
    ).toEqual({ channels: 'ai,general' })
  })
})

describe('labelForChannelScope', () => {
  it('returns "All 3 channels" for the all-channels sentinel', () => {
    expect(
      labelForChannelScope({ mode: 'all', ids: [...ALL_CHANNELS] }),
    ).toBe('All 3 channels')
  })
  it('returns "{Channel} only" for a single-channel subset', () => {
    expect(
      labelForChannelScope({ mode: 'subset', ids: ['general'] }),
    ).toBe('General only')
  })
  it('returns "{A} + {B}" for a two-channel subset', () => {
    expect(
      labelForChannelScope({ mode: 'subset', ids: ['ai', 'leadership_culture'] }),
    ).toBe('AI + Leadership & Culture')
  })
})
