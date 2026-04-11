# `reference/` — CPO Connect monthly chat analysis archive

This directory holds self-contained HTML reports for each monthly chat
analysis. The files are served behind auth at `/reference/` — see
`server/app.ts` for the mount (WETA Batch 8).

Each monthly file is a standalone HTML document with inline CSS +
Chart.js visualisations, designed to be readable in isolation and
diffable at the source-file level.

## Files

| File | Coverage | Notes |
|---|---|---|
| `index.html` | — | Landing page listing the reports below |
| `chat-analysis-jan2026.html` | 29 Dec 2025 – 29 Jan 2026 | **Historical exception.** AI channel only. Uses an earlier single-channel template (no tabs, 30-day rolling window, different stats row). General and Leadership channels were not yet part of the community at this time, so this file cannot be retrofitted to the multi-channel template without fabricating data. It stays as-is for historical accuracy. |
| `chat-analysis-feb2026.html` | 1 – 28 Feb 2026 | **Canonical template.** First multi-channel monthly report. All subsequent months derive from this structure. |
| `chat-analysis-mar2026.html` | 1 – 31 Mar 2026 | Aligned to the Feb template per THE-553. |
| `general.html` | — | Early general-channel snapshot from before the consolidation. |

## Template stability commitment (from Feb 2026 onward)

Starting with **February 2026**, monthly reports MUST match the
`chat-analysis-feb2026.html` template structure. When producing a new
month:

1. **Copy `chat-analysis-feb2026.html` as the starting skeleton.** Do
   not start from a clean sheet and do not evolve the template from
   the most recent month — it introduces drift.
2. **Update the file-level metadata:**
   - `<title>` — `CPO Connect — <Month> <Year> Chat Analysis`
   - `<p class="subtitle">` — `<Month> <Year> Chat Analysis · 1 – <last day> <Month> <Year>`
   - `<p class="prev-nav">` — `← <Previous Month> <Year>` linking to the previous month's file
   - `<footer>` — generation date
3. **Preserve the stats-row schema:**
   - Top-level: `Total Messages | Channels | Active Days | New Members | Active Members` (5 stats)
   - Per channel: `Messages | Active Members | Active Days | New Members` (4 stats)
   - **Do NOT substitute `New Members` for a month-over-month delta or
     any other metric.** If a month-over-month comparison is editorially
     useful, put it in the narrative trend content, not the stats slot.
4. **Preserve the Cross-Channel Insights section** at the bottom,
   using the same `.channel-badge` classes (`badge-ai`, `badge-general`,
   `badge-leadership`) for per-insight channel tags.
5. **Preserve the 5-category sentiment model** for all three channels:
   - `Enthusiastic / Optimistic`
   - `Practical / Balanced`
   - `Skeptical / Critical`
   - `Philosophical / Cautious`
   - `Humorous / Social`
   - If a future month has a legitimately distinct sentiment signal
     that needs a new category, update this list AND re-score all
     prior months from Feb onward against the new taxonomy in the
     same PR. Never ship asymmetric categories across months — either
     every month uses the same taxonomy or the series stops being
     comparable.
6. **Resolve contributor identities before ingest.** If the upstream
   data has phone-suffix fallbacks (e.g. `Member ···9211`), resolve
   them to real names via the Google Sheet (see below) BEFORE writing
   the HTML. Never ship phone-suffix labels in the final report.
7. **Daily activity chart x-axis** — use the full calendar-month
   sequence (`['1','2',...,'31']`), including zero-value days, for
   all channels. Feb's sparse x-axis for the General and Leadership
   charts is a pre-commitment legacy artifact.

## Authoritative data source — Google Sheet

The Google Sheet used for magic-link authentication is the
authoritative source of member records — full name, phone number,
join date, and `Status`. When a report needs "new members joined"
counts or contributor real-name resolution:

- Env: `GOOGLE_SHEET_ID` (see `server/services/sheets.ts` for the
  default and `render.yaml` for the production value)
- Env: `GOOGLE_SHEETS_CREDENTIALS` (base64-encoded service account JSON,
  set on Render only)

The existing `lookupMember` / `getDirectory` helpers in
`server/services/sheets.ts` are the canonical access path. Do not
introduce a second Sheets integration.

For ad-hoc retrofit work (like THE-553), see
`scripts/extract-retrofit-data.ts` — a one-off helper that pulls
new-member counts and phone → name resolution for a given month and
prints JSON for pasting into a new report.

## Serving

The whole directory is mounted auth-gated at `/reference/` via
`server/app.ts`:

```ts
app.use(
  '/reference',
  requireAuth,
  express.static(path.join(__dirname, '..', 'reference'), {
    index: 'index.html',
    fallthrough: false,
  }),
)
```

Integration tests live in `src/test/reference-auth-gated.test.ts` —
they exercise the `requireAuth` gate, valid-session success path,
404-on-unknown-file, and path-traversal defense.
