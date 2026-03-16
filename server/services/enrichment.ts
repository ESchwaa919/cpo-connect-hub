import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const PLAYWRIGHT_URL = process.env.PLAYWRIGHT_RENDERER_URL ?? 'https://playwright-renderer.onrender.com'

export interface EnrichmentResult {
  bio: string
  skills: string
  role: string
  currentOrg: string
  location: string
  industry: string
  photoUrl: string
}

function extractOgImage(html: string): string {
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (!match?.[1]) return ''
  const url = match[1]
  // Skip LinkedIn default/placeholder images
  if (url.includes('static.licdn.com/aero-v1') || url.includes('default-avatar')) return ''
  return url
}

async function fetchViaPlaywright(url: string): Promise<string> {
  const response = await fetch(`${PLAYWRIGHT_URL}/raw-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(60_000), // Playwright needs time to render
  })
  if (!response.ok) {
    throw new Error(`Playwright returned ${response.status}`)
  }
  const data = await response.json() as { html: string; title: string }
  return data.html
}

async function fetchDirect(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CPOConnect/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10_000),
  })
  // LinkedIn returns HTTP 999 (soft block) but the body still contains
  // profile meta tags (og:image, og:description). Read body regardless of status.
  const text = await response.text()
  return text.slice(0, 50_000)
}

export async function enrichFromLinkedIn(linkedinUrl: string, name: string): Promise<EnrichmentResult> {
  let pageContent = ''
  let photoUrl = ''

  function processHtml(html: string) {
    photoUrl = extractOgImage(html)
    pageContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  }

  const isLinkedIn = linkedinUrl.includes('linkedin.com')

  if (isLinkedIn) {
    // LinkedIn serves profile meta tags (og:image, description) in the initial HTML
    // response, before JS redirects to the auth wall. Direct fetch captures this;
    // Playwright waits for JS and lands on the auth wall instead.
    try {
      console.log('[enrichment] Direct fetch (LinkedIn):', linkedinUrl)
      const html = await fetchDirect(linkedinUrl)
      if (html) processHtml(html)
      console.log('[enrichment] Direct fetch — content length:', pageContent.length, 'photoUrl:', photoUrl ? 'found' : 'none')
    } catch {
      // LinkedIn blocked — proceed with name-only context
    }
  } else {
    // Non-LinkedIn: use Playwright for JS-rendered pages, fall back to direct fetch
    try {
      console.log('[enrichment] Fetching via Playwright:', linkedinUrl)
      const html = await fetchViaPlaywright(linkedinUrl)
      processHtml(html)
      console.log('[enrichment] Playwright success — content length:', pageContent.length, 'photoUrl:', photoUrl ? 'found' : 'none')
    } catch (err) {
      console.warn('[enrichment] Playwright failed, falling back to direct fetch:', (err as Error).message)
      try {
        const html = await fetchDirect(linkedinUrl)
        if (html) processHtml(html)
      } catch {
        // Both methods failed — proceed with name-only context
      }
    }
  }

  const contextBlock = pageContent
    ? `Here is text extracted from their LinkedIn profile page:\n\n${pageContent}`
    : `Their LinkedIn profile URL is ${linkedinUrl} but the page content could not be fetched. Use only the member's name to write a brief placeholder bio.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are helping enrich a CPO Connect community member's profile. The member's name is "${name}".

${contextBlock}

Based on the available information, extract and provide:

1. **bio**: Write an original, professional bio (2-4 sentences) in third person. Do NOT copy text verbatim from LinkedIn. Rewrite in your own words, focusing on their product leadership experience and expertise. If limited information is available, write a brief generic bio mentioning they are a CPO Connect community member.

2. **skills**: Extract a comma-separated list of professional skills (max 10). Focus on product management, leadership, and technical skills. If limited information is available, return an empty string.

3. **role**: Extract their current job title (e.g. "Chief Product Officer", "VP Product"). If not clearly stated, return an empty string.

4. **currentOrg**: Extract their current employer or organisation. If not clearly stated, return an empty string.

5. **location**: Extract their location (city, country). If not clearly stated, return an empty string.

6. **industry**: Extract their industry or sector (e.g. "FinTech", "SaaS", "Healthcare"). If not clearly stated, return an empty string.

Respond in JSON format only:
{"bio": "...", "skills": "...", "role": "...", "currentOrg": "...", "location": "...", "industry": "..."}`,
      },
    ],
  })

  // Extract text from response
  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = textBlock.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(jsonStr) as {
    bio?: string; skills?: string; role?: string; currentOrg?: string
    location?: string; industry?: string
  }

  return {
    bio: parsed.bio ?? '',
    skills: parsed.skills ?? '',
    role: parsed.role ?? '',
    currentOrg: parsed.currentOrg ?? '',
    location: parsed.location ?? '',
    industry: parsed.industry ?? '',
    photoUrl,
  }
}
