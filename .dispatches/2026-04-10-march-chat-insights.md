# CPO Connect — March 2026 Chat Insights Update

**Requested:** 2026-04-10 by Erik
**Context:** New WhatsApp export zips have been downloaded. Build the March 2026 chat insights to match the existing Jan/Feb 2026 pattern.

## Source files

Located in `~/Projects/CPO Connect/` (parent directory of cpo-connect-hub):

```
WhatsApp Chat - CPO Connect __ AI.zip
WhatsApp Chat - CPO Connect __ General.zip
WhatsApp Chat - CPO Connect __ Leadership & Culture.zip
```

The unzipped folders are also present next to the zips.

## Target

Create a new file: `~/Projects/CPO Connect/chat-analysis-mar2026.html`

This should match the style, structure, and analysis approach of the existing files:
- `~/Projects/CPO Connect/chat-analysis-jan2026.html`
- `~/Projects/CPO Connect/chat-analysis-feb2026.html`

**Read both existing files first** to understand:
- The HTML structure (header, sections, styling)
- How the three groups are organized (AI, General, Leadership & Culture)
- What analysis each section contains (top themes, key moments, notable contributions, trends, etc.)
- The tone and voice of the insights
- Any shared CSS or embedded styles

## Task

1. Read `chat-analysis-jan2026.html` and `chat-analysis-feb2026.html` to learn the template and analysis depth
2. Unzip / read the three WhatsApp chat files (if not already extracted)
3. Filter messages to March 2026 only (March 1 through March 31)
4. Produce the same analytical breakdown for each of the three groups:
   - Top discussion themes
   - Notable contributions / quotes
   - Key moments or decisions
   - Trends vs prior month (comparison with Feb 2026 is useful context)
5. Write the output to `chat-analysis-mar2026.html` in the project root (NOT inside cpo-connect-hub)
6. Match the visual and structural style of the existing files exactly

## Archive navigation — important

Keep all monthly archives linked together. The existing Jan and Feb files should have navigation links to sibling months. When you create March:

1. Add a navigation section (header or footer) to `chat-analysis-mar2026.html` with links to Jan and Feb
2. **Update `chat-analysis-jan2026.html` and `chat-analysis-feb2026.html`** to add a link to March as well
3. Ensure the nav is visually consistent across all three files
4. Link format: relative paths (`./chat-analysis-feb2026.html` etc.) — these are all in the same directory

If the existing files don't yet have cross-links, add them now so all three stay in sync.

## Not in scope

- Do NOT modify the app code itself (cpo-connect-hub is untouched)
- Do NOT integrate the analysis into the web app — this is a standalone HTML report like the previous months
- Do NOT commit to git — these HTML files don't appear to be committed (they're reports, not source)

## Completion criteria

- `chat-analysis-mar2026.html` exists in `~/Projects/CPO Connect/`
- It is structurally consistent with the Jan/Feb files
- It covers all three WhatsApp groups
- It only analyzes March 2026 messages
- Report back to Rune with: file location, approximate size, summary of key themes found, and a note on anything unexpected in the data
