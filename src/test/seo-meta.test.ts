import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const robotsTxt = readFileSync(resolve(root, 'public/robots.txt'), 'utf8')

describe('SEO — index.html meta tags', () => {
  it('robots tag is index, follow (not noindex/nofollow)', () => {
    const match = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)
    expect(match, 'robots meta tag must be present').not.toBeNull()
    const content = match![1].toLowerCase()
    expect(content).not.toContain('noindex')
    expect(content).not.toContain('nofollow')
    expect(content).toContain('index')
    expect(content).toContain('follow')
  })

  it('has a meta description between 50 and 160 characters', () => {
    const match = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    expect(match, 'description meta must be present').not.toBeNull()
    const description = match![1]
    expect(description.length).toBeGreaterThanOrEqual(50)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('has a meta keywords tag', () => {
    expect(html).toMatch(/<meta\s+name="keywords"\s+content="[^"]+"/i)
  })

  it('has a canonical link to the production domain', () => {
    const match = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)
    expect(match, 'canonical link must be present').not.toBeNull()
    expect(match![1]).toBe('https://cpoconnect.club/')
  })

  it('has author + publisher meta tags', () => {
    expect(html).toMatch(/<meta\s+name="author"\s+content="[^"]+"/i)
    expect(html).toMatch(/<meta\s+name="publisher"\s+content="[^"]+"/i)
  })

  it('has all required OpenGraph tags', () => {
    expect(html).toMatch(/<meta\s+property="og:title"\s+content="[^"]+"/i)
    expect(html).toMatch(/<meta\s+property="og:description"\s+content="[^"]+"/i)
    expect(html).toMatch(/<meta\s+property="og:image"\s+content="https:\/\/[^"]+"/i)
    expect(html).toMatch(/<meta\s+property="og:url"\s+content="https:\/\/cpoconnect\.club\/"/i)
    expect(html).toMatch(/<meta\s+property="og:type"\s+content="[^"]+"/i)
  })

  it('has Twitter Card tags', () => {
    expect(html).toMatch(/<meta\s+name="twitter:card"\s+content="summary_large_image"/i)
    expect(html).toMatch(/<meta\s+name="twitter:title"\s+content="[^"]+"/i)
    expect(html).toMatch(/<meta\s+name="twitter:description"\s+content="[^"]+"/i)
    expect(html).toMatch(/<meta\s+name="twitter:image"\s+content="https:\/\/[^"]+"/i)
  })

  it('has JSON-LD Organization structured data', () => {
    const match = html.match(
      /<script\s+type="application\/ld\+json">\s*([\s\S]+?)\s*<\/script>/i,
    )
    expect(match, 'JSON-LD script must be present').not.toBeNull()
    const parsed = JSON.parse(match![1])
    expect(parsed['@context']).toBe('https://schema.org')
    expect(parsed['@type']).toBe('Organization')
    expect(parsed.name).toBe('CPO Connect')
    expect(parsed.url).toBe('https://cpoconnect.club/')
  })
})

describe('SEO — robots.txt', () => {
  it('allows crawlers and excludes /members/', () => {
    expect(robotsTxt).toMatch(/User-agent:\s*\*/i)
    expect(robotsTxt).not.toMatch(/^Disallow:\s*\/\s*$/m)
    expect(robotsTxt).toMatch(/Disallow:\s*\/members\//i)
  })

  it('references the sitemap', () => {
    expect(robotsTxt).toMatch(/Sitemap:\s*https:\/\/cpoconnect\.club\/sitemap\.xml/i)
  })
})

describe('SEO — sitemap.xml', () => {
  it('exists and lists the home page', () => {
    const sitemapPath = resolve(root, 'public/sitemap.xml')
    expect(existsSync(sitemapPath), 'public/sitemap.xml must exist').toBe(true)
    const xml = readFileSync(sitemapPath, 'utf8')
    expect(xml).toMatch(/<\?xml\s+version="1\.0"/)
    expect(xml).toMatch(/<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/)
    expect(xml).toMatch(/<loc>https:\/\/cpoconnect\.club\/<\/loc>/)
  })
})
