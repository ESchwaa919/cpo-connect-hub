# CPO Connect — Chat Analysis Header Nav Cleanup

**Requested:** 2026-04-10 by Erik
**Affected files:**
- `~/Projects/CPO Connect/chat-analysis-jan2026.html`
- `~/Projects/CPO Connect/chat-analysis-feb2026.html`
- `~/Projects/CPO Connect/chat-analysis-mar2026.html`

## Problem

The current nav puts ALL other months in the header subtitle as comma-separated links:

> `CPO Connect — All Channels`
> `March 2026 Chat Analysis · 1 – 31 Mar 2026 · ← January 2026 · ← February 2026`

This looks cluttered and will only get worse as months accumulate. The ask: simpler nav that just jumps to the **previous month** from the current one.

## Target behavior

Simple "← Previous month" link only. Format:

### March 2026 file
> `CPO Connect — All Channels`
> `March 2026 Chat Analysis · 1 – 31 Mar 2026`
> `← February 2026` (styled as a subtle link)

### February 2026 file
> `CPO Connect — All Channels`
> `February 2026 Chat Analysis · 1 – 28 Feb 2026`
> `← January 2026`

### January 2026 file
> `CPO Connect — All Channels`
> `January 2026 Chat Analysis · 1 – 31 Jan 2026`
> (no previous-month link — January is the oldest)

## Design notes

- Move the previous-month link OUT of the subtitle line (where it's currently mashed in with the date range)
- Put it on its own line below the subtitle, or in a small badge/pill above/below the title
- Keep it understated — it's navigation, not a call to action
- Match the existing color palette (purple/indigo on dark background per the screenshot)
- The link should be a relative href: `./chat-analysis-<prev>2026.html`

## Not in scope

- Do NOT add a "jump to month" dropdown — Erik flagged that as future work once we have more months
- Do NOT modify the analytical content, stat cards, or any other section
- Do NOT touch cpo-connect-hub app code — these are standalone report files
- Do NOT commit to git

## Verification

After edits, open each of the three files in a browser (or use `open chat-analysis-mar2026.html` from a terminal) and verify:
1. March shows "← February 2026" link, no reference to January
2. February shows "← January 2026" link, no reference to March
3. January has no previous-month link
4. The subtitle date range is clean (no embedded links)
5. Visual style matches across all three files
