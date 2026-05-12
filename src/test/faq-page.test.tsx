import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import Faq from '../pages/Faq'

function renderFaq(): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <Faq />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
  return container
}

describe('FAQ page — visible content', () => {
  it('renders an H1 with the FAQ heading', () => {
    const container = renderFaq()
    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1!.textContent).toMatch(/frequently asked questions/i)
  })

  it('renders all 8 question/answer pairs', () => {
    const container = renderFaq()
    const details = container.querySelectorAll('details')
    expect(details.length).toBe(8)
  })
})

describe('FAQ page — FAQPage JSON-LD', () => {
  it('emits a FAQPage JSON-LD script with @context and @type', () => {
    const container = renderFaq()
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const parsed = JSON.parse(script!.textContent ?? '{}')
    expect(parsed['@context']).toBe('https://schema.org')
    expect(parsed['@type']).toBe('FAQPage')
    expect(Array.isArray(parsed.mainEntity)).toBe(true)
    expect(parsed.mainEntity.length).toBe(8)
  })

  it('JSON-LD answer text matches the visible answer text exactly', () => {
    const container = renderFaq()
    const script = container.querySelector('script[type="application/ld+json"]')
    const parsed = JSON.parse(script!.textContent ?? '{}')

    const details = container.querySelectorAll('details')
    details.forEach((d, i) => {
      const visibleQuestion = d.querySelector('h2')!.textContent?.trim()
      const visibleAnswer = d.querySelector('p')!.textContent?.trim()
      const ldItem = parsed.mainEntity[i]
      expect(ldItem.name).toBe(visibleQuestion)
      expect(ldItem.acceptedAnswer.text).toBe(visibleAnswer)
    })
  })

  it('each Question entry has the required shape', () => {
    const container = renderFaq()
    const script = container.querySelector('script[type="application/ld+json"]')
    const parsed = JSON.parse(script!.textContent ?? '{}')

    for (const q of parsed.mainEntity) {
      expect(q['@type']).toBe('Question')
      expect(typeof q.name).toBe('string')
      expect(q.name.length).toBeGreaterThan(0)
      expect(q.acceptedAnswer['@type']).toBe('Answer')
      expect(typeof q.acceptedAnswer.text).toBe('string')
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0)
    }
  })
})
