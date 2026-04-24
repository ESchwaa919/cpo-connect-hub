// Regression test for Tania Shedley's LinkedIn 404: stored value
// `www.linkedin.com/in/Tania-Shedley` (no protocol) was rendered as a
// relative href, producing /members/www.linkedin.com/... 404.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemberCard } from '../components/members/directory/MemberCard'

function findLinkedinAnchor(container: HTMLElement): HTMLAnchorElement | null {
  const links = container.querySelectorAll('a[aria-label*="on LinkedIn"]')
  return (links[0] as HTMLAnchorElement | undefined) ?? null
}

describe('MemberCard LinkedIn href', () => {
  it('prepends https:// when the stored LinkedIn value has no protocol', () => {
    const { container } = render(
      <MemberCard
        name="Tania Shedley"
        role="Product Director"
        linkedIn="www.linkedin.com/in/Tania-Shedley"
      />,
    )
    const a = findLinkedinAnchor(container)
    expect(a).not.toBeNull()
    expect(a!.href).toBe('https://www.linkedin.com/in/Tania-Shedley')
  })

  it('leaves a properly-formed https LinkedIn URL unchanged', () => {
    const { container } = render(
      <MemberCard
        name="Someone"
        role="PM"
        linkedIn="https://www.linkedin.com/in/someone"
      />,
    )
    const a = findLinkedinAnchor(container)
    expect(a!.href).toBe('https://www.linkedin.com/in/someone')
  })

  it('omits the LinkedIn icon entirely when the stored value is not a linkedin host', () => {
    // Defense: the normalizer rejects non-linkedin hosts by returning '',
    // which should cause the icon to not render.
    const { container } = render(
      <MemberCard
        name="Someone"
        role="PM"
        linkedIn="https://evil.example.com/phish"
      />,
    )
    expect(findLinkedinAnchor(container)).toBeNull()
  })
})
