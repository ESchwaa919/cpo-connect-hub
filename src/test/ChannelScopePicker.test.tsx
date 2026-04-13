import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChannelScopePicker } from '../components/members/shared/ChannelScopePicker'
import type { ChannelScopeValue } from '../lib/channel-scope-params'

function renderPicker(
  value: ChannelScopeValue,
  onChange = vi.fn(),
  opts: {
    allowMultiSelect?: boolean
    showAllOption?: boolean
  } = {},
) {
  const utils = render(
    <ChannelScopePicker value={value} onChange={onChange} {...opts} />,
  )
  return { ...utils, onChange }
}

describe('ChannelScopePicker — trigger label', () => {
  it('shows "All 3 channels" label when value is the all sentinel', () => {
    renderPicker({ mode: 'all', ids: ['general', 'ai', 'leadership'] })
    const trigger = screen.getByRole('button', { name: /all 3 channels/i })
    expect(trigger).toBeInTheDocument()
  })

  it('shows "General only" for a single-channel subset', () => {
    renderPicker({ mode: 'subset', ids: ['general'] })
    expect(
      screen.getByRole('button', { name: /general only/i }),
    ).toBeInTheDocument()
  })

  it('shows "AI + Leadership" for a two-channel subset', () => {
    renderPicker({ mode: 'subset', ids: ['ai', 'leadership'] })
    expect(
      screen.getByRole('button', { name: /AI \+ Leadership/i }),
    ).toBeInTheDocument()
  })
})

describe('ChannelScopePicker — multi-select mode (default)', () => {
  it('is collapsed by default (menu not rendered)', () => {
    renderPicker({ mode: 'all', ids: ['general', 'ai', 'leadership'] })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the menu when the trigger is clicked', () => {
    renderPicker({ mode: 'all', ids: ['general', 'ai', 'leadership'] })
    fireEvent.click(screen.getByRole('button', { name: /all 3 channels/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('renders the "All channels" option + one item per channel', () => {
    renderPicker({ mode: 'all', ids: ['general', 'ai', 'leadership'] })
    fireEvent.click(screen.getByRole('button', { name: /all 3 channels/i }))
    expect(
      screen.getByRole('menuitemcheckbox', { name: /all channels/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemcheckbox', { name: /^general$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemcheckbox', { name: /^ai$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemcheckbox', { name: /^leadership$/i }),
    ).toBeInTheDocument()
  })

  it('marks all channel items as checked when value mode is "all"', () => {
    renderPicker({ mode: 'all', ids: ['general', 'ai', 'leadership'] })
    fireEvent.click(screen.getByRole('button', { name: /all 3 channels/i }))
    const all = screen.getByRole('menuitemcheckbox', { name: /all channels/i })
    const general = screen.getByRole('menuitemcheckbox', { name: /^general$/i })
    expect(all).toHaveAttribute('aria-checked', 'true')
    expect(general).toHaveAttribute('aria-checked', 'true')
  })

  it('only checks the subset items when value mode is "subset"', () => {
    renderPicker({ mode: 'subset', ids: ['ai'] })
    fireEvent.click(screen.getByRole('button', { name: /ai only/i }))
    const all = screen.getByRole('menuitemcheckbox', { name: /all channels/i })
    const ai = screen.getByRole('menuitemcheckbox', { name: /^ai$/i })
    const general = screen.getByRole('menuitemcheckbox', { name: /^general$/i })
    expect(all).toHaveAttribute('aria-checked', 'false')
    expect(ai).toHaveAttribute('aria-checked', 'true')
    expect(general).toHaveAttribute('aria-checked', 'false')
  })

  it('emits mode "all" when the "All channels" option is clicked', () => {
    const { onChange } = renderPicker({ mode: 'subset', ids: ['general'] })
    fireEvent.click(screen.getByRole('button', { name: /general only/i }))
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /all channels/i }),
    )
    expect(onChange).toHaveBeenCalledWith({
      mode: 'all',
      ids: ['general', 'ai', 'leadership'],
    })
  })

  it('toggling a single channel from all-mode produces a subset with just that channel', () => {
    const { onChange } = renderPicker({
      mode: 'all',
      ids: ['general', 'ai', 'leadership'],
    })
    fireEvent.click(screen.getByRole('button', { name: /all 3 channels/i }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^ai$/i }))
    expect(onChange).toHaveBeenCalledWith({ mode: 'subset', ids: ['ai'] })
  })

  it('toggling an already-checked subset item removes it', () => {
    const { onChange } = renderPicker({
      mode: 'subset',
      ids: ['ai', 'general'],
    })
    fireEvent.click(screen.getByRole('button', { name: /general \+ ai/i }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^ai$/i }))
    expect(onChange).toHaveBeenCalledWith({ mode: 'subset', ids: ['general'] })
  })

  it('toggling every channel on collapses back to the all sentinel', () => {
    const { onChange } = renderPicker({
      mode: 'subset',
      ids: ['general', 'ai'],
    })
    fireEvent.click(screen.getByRole('button', { name: /general \+ ai/i }))
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: /^leadership$/i }),
    )
    expect(onChange).toHaveBeenCalledWith({
      mode: 'all',
      ids: ['general', 'ai', 'leadership'],
    })
  })

  it('toggling the last subset item off is a no-op (must keep at least one channel)', () => {
    const { onChange } = renderPicker({ mode: 'subset', ids: ['general'] })
    fireEvent.click(screen.getByRole('button', { name: /general only/i }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^general$/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ChannelScopePicker — single-select mode (Chat Insights)', () => {
  it('omits the "All channels" option when showAllOption is false', () => {
    renderPicker(
      { mode: 'subset', ids: ['general'] },
      vi.fn(),
      { allowMultiSelect: false, showAllOption: false },
    )
    fireEvent.click(screen.getByRole('button', { name: /general only/i }))
    expect(
      screen.queryByRole('menuitemradio', { name: /all channels/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /all channels/i }),
    ).not.toBeInTheDocument()
  })

  it('renders channels as radio items when allowMultiSelect is false', () => {
    renderPicker(
      { mode: 'subset', ids: ['general'] },
      vi.fn(),
      { allowMultiSelect: false, showAllOption: false },
    )
    fireEvent.click(screen.getByRole('button', { name: /general only/i }))
    expect(
      screen.getByRole('menuitemradio', { name: /^general$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: /^ai$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitemcheckbox'),
    ).not.toBeInTheDocument()
  })

  it('picking a different channel replaces the selection (never accumulates)', () => {
    const { onChange } = renderPicker(
      { mode: 'subset', ids: ['general'] },
      vi.fn(),
      { allowMultiSelect: false, showAllOption: false },
    )
    fireEvent.click(screen.getByRole('button', { name: /general only/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^ai$/i }))
    expect(onChange).toHaveBeenCalledWith({ mode: 'subset', ids: ['ai'] })
  })

  it('clicking the already-selected channel is a no-op in single-select mode', () => {
    const { onChange } = renderPicker(
      { mode: 'subset', ids: ['general'] },
      vi.fn(),
      { allowMultiSelect: false, showAllOption: false },
    )
    fireEvent.click(screen.getByRole('button', { name: /general only/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^general$/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
