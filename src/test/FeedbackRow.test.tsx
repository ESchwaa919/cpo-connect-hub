import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FeedbackRow } from '../components/members/whats-talked/FeedbackRow'

describe('FeedbackRow', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders both thumb buttons enabled when queryLogId is provided', () => {
    render(<FeedbackRow queryLogId="42" />)
    expect(
      screen.getByRole('button', { name: /Mark answer as helpful/i }),
    ).not.toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Mark answer as not helpful/i }),
    ).not.toBeDisabled()
  })

  it('disables both buttons when queryLogId is null', () => {
    render(<FeedbackRow queryLogId={null} />)
    expect(
      screen.getByRole('button', { name: /Mark answer as helpful/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Mark answer as not helpful/i }),
    ).toBeDisabled()
  })

  it('posts thumbs_up and shows confirmation on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<FeedbackRow queryLogId="42" />)
    fireEvent.click(
      screen.getByRole('button', { name: /Mark answer as helpful/i }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('feedback-submitted')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/chat/feedback')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string) as {
      queryLogId: string
      rating: string
    }
    expect(body).toEqual({ queryLogId: '42', rating: 'thumbs_up' })
  })

  it('posts thumbs_down and shows confirmation on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<FeedbackRow queryLogId="7" />)
    fireEvent.click(
      screen.getByRole('button', { name: /Mark answer as not helpful/i }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('feedback-submitted')).toBeInTheDocument()
    })

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { rating: string }
    expect(body.rating).toBe('thumbs_down')
  })

  it('stays in the row state when the server returns a non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'query_log_not_found' }), {
        status: 404,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<FeedbackRow queryLogId="42" />)
    fireEvent.click(
      screen.getByRole('button', { name: /Mark answer as helpful/i }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    // Still in the "Was this helpful?" state — no confirmation shown.
    expect(screen.queryByTestId('feedback-submitted')).not.toBeInTheDocument()
    expect(screen.getByTestId('feedback-row')).toBeInTheDocument()
  })
})
