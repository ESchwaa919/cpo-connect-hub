# THE-702 — Branded OG social card

**Linear:** https://linear.app/the-ai-expert/issue/THE-702
**Branch:** `eschwaa/the-702-og-social-card`
**Started:** 2026-05-27

## Problem

`index.html` currently points `og:image` and `twitter:image` at `/pwa-icon-512.png` — a 512×512 square PWA icon. When the site is shared on WhatsApp / iMessage / Slack, this either gets stretched, letterboxed, or shows a Lovable-flavoured generic preview. Erik wants a 1200×630 branded card.

## Current state (verified)

- `index.html:25` → `og:image` = `https://cpoconnect.club/pwa-icon-512.png`
- `index.html:34` → `twitter:image` = same
- Brand colour: `#863bff` (primary purple — from `public/favicon.svg`)
- Tagline (from `HeroSection.tsx`): **"The peer network for senior product leaders"**
- Sub-line (from hero): *"A private WhatsApp community built on openness, trust, and shared experience."*
- Logo asset: `src/assets/logo.png` (660×660 PNG with transparency)

## Approach — picked (a) clean branded card

Picked option (a) from the dispatch: design a clean card. Reasons:

- Simpler than screenshotting the live hero (no Playwright/Chromium driver pre-installed; would need to spin one up).
- The hero contains animated framer-motion elements that wouldn't snapshot cleanly anyway.
- A clean typographic card is the dominant convention for tech-product OG previews (Linear, Vercel, Stripe).

## Implementation steps

1. **Build SVG → PNG**
   - Hand-author a 1200×630 SVG with:
     - Light gradient background (white → very-light-purple) matching the live landing page
     - Logo (top-left, ~96px) — embed `src/assets/logo.png` as base64 to keep the SVG self-contained
     - Headline (left-aligned, bold): "The peer network for senior product leaders" — primary colour on "senior product leaders" to mirror the hero
     - Sub-line: "A private WhatsApp community built on openness, trust, and shared experience."
     - Footer line: "cpoconnect.club" + small "By CPOs, for CPOs." tagline
     - Subtle blurred purple/blue blobs in corners to echo the hero's background atmosphere
   - Render to PNG at 1200×630 via `npx @resvg/resvg-js-cli` (no project dependency added — one-shot npx).
   - If resvg fails, fall back to driving Chrome (mcp__claude-in-chrome) to render the HTML at a fixed 1200×630 viewport and capture via canvas → base64 → file.

2. **Save** to `public/og-image.png`.

3. **Update `index.html`:**
   - `og:image` → `https://cpoconnect.club/og-image.png`
   - Add `og:image:width = 1200`, `og:image:height = 630`, `og:image:alt`
   - `twitter:image` → same URL
   - `twitter:card` is already `summary_large_image` (no change)

4. **Commit** on branch `eschwaa/the-702-og-social-card`, push, open PR, self-merge.

5. **Verify** at https://www.opengraph.xyz/url/?url=https%3A%2F%2Fcpoconnect.club after Render finishes deploying (typically ~2 min). Capture the OG-debugger URL for state.json `done` payload.

## Scope guardrails (Six Principles)

- **#2 Simplicity** — One new asset (`public/og-image.png`) + a handful of meta tag edits. No new build step, no new dependency, no design system rework.
- **#3 Surgical** — Only `index.html` + `public/og-image.png` change. Will resist the urge to "fix" any neighbouring meta tags or restructure the SEO block.
- **#5 Verify behaviour** — Verification = OG debugger fetches the new URL and shows the new card image. Not "I changed the tag." Will paste the debugger URL into state.json.

## Verified
- (To fill at end) OG debugger shows new 1200×630 card image for https://cpoconnect.club

## Unverified — reviewer please decide
- (To fill at end) Real-world WhatsApp/iMessage preview (cache may take longer than the OG debugger to refresh)
- Residual risk: LOW — landing-page meta-tag change, reversible by reverting the commit; no schema, auth, or data implications.
