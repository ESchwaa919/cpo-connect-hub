import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

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
  // Extract og:image before stripping HTML tags
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (!match?.[1]) return ''
  const url = match[1]
  // Skip LinkedIn default/placeholder images
  if (url.includes('static.licdn.com/aero-v1') || url.includes('default-avatar')) return ''
  return url
}

export async function enrichFromLinkedIn(linkedinUrl: string, name: string): Promise<EnrichmentResult> {
  // Attempt to fetch the public LinkedIn page
  let pageContent = ''
  let photoUrl = ''
  try {
    const response = await fetch(linkedinUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CPOConnect/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) {
      // Cap raw HTML before processing to avoid processing megabytes
      const html = (await response.text()).slice(0, 50_000)
      // Extract og:image BEFORE stripping HTML
      photoUrl = extractOgImage(html)
      pageContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
    }
  } catch {
    // LinkedIn may block the request — proceed with name-only context
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
