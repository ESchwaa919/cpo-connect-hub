# CPO Connect — Consolidate Chat Analysis Files

**Requested:** 2026-04-10 by Erik
**Goal:** One true home for monthly chat analysis HTML files: `cpo-connect-hub/reference/`

## Current state (three locations)

1. **`~/Projects/CPO Connect/`** (parent dir, no git) — recently updated by the March 2026 dispatch:
   - `chat-analysis-jan2026.html`
   - `chat-analysis-feb2026.html`
   - `chat-analysis-mar2026.html` (new, built 2026-04-10)

2. **`~/Projects/CPO Connect/cpo-connect-hub/reference/`** (inside this repo) — the canonical home per CLAUDE.md:
   - `chat-analysis-jan2026.html` (older snapshot, dated March 27)
   - `chat-analysis-feb2026.html` (older snapshot, dated March 27)
   - `general.html` (early snapshot)

3. **`~/Projects/cpo-connect-ai-chat/`** (separate archived repo) — DO NOT TOUCH. It's been archived on GitHub.

## Task

Consolidate everything into `cpo-connect-hub/reference/` as the single source of truth.

### Steps

1. **Back up any unique content from the existing `reference/` files** — check if `reference/chat-analysis-jan2026.html` or `reference/chat-analysis-feb2026.html` has anything not in the parent-directory versions (e.g. if the reference versions have different layout, content, cross-links, etc.). If they're substantively identical, just overwrite. If there are differences worth preserving, merge manually.

2. **Keep `reference/general.html`** as-is — it's a different file, not a monthly snapshot.

3. **Move the parent-directory files into `reference/`:**
   - `~/Projects/CPO Connect/chat-analysis-jan2026.html` → `reference/chat-analysis-jan2026.html` (overwrite)
   - `~/Projects/CPO Connect/chat-analysis-feb2026.html` → `reference/chat-analysis-feb2026.html` (overwrite)
   - `~/Projects/CPO Connect/chat-analysis-mar2026.html` → `reference/chat-analysis-mar2026.html` (new)

4. **Verify the previous-month nav links work with relative paths** inside `reference/`:
   - `chat-analysis-mar2026.html` should have `← February 2026` linking to `./chat-analysis-feb2026.html`
   - `chat-analysis-feb2026.html` should have `← January 2026` linking to `./chat-analysis-jan2026.html`
   - `chat-analysis-jan2026.html` has no previous-month link
   - All links must be relative, no absolute paths, no reference to the parent directory

5. **Delete the parent-directory versions** once the reference copies are verified:
   - `rm ~/Projects/CPO\ Connect/chat-analysis-jan2026.html`
   - `rm ~/Projects/CPO\ Connect/chat-analysis-feb2026.html`
   - `rm ~/Projects/CPO\ Connect/chat-analysis-mar2026.html`

6. **Commit the reference/ changes** to the cpo-connect-hub repo:
   - Branch: `chore/consolidate-chat-analysis-files`
   - Commit message: `chore: consolidate monthly chat analysis files into reference/`
   - Include all three updated HTML files + the verification that cross-nav works

7. **Push and create a PR** — this is a small chore, no agent review needed, just a clean PR that Erik can merge.

## Not in scope

- Do NOT touch `~/Projects/cpo-connect-ai-chat/` — that repo is archived
- Do NOT modify the analytical content of the files — we're just relocating and fixing links
- Do NOT touch `reference/general.html` — it's separate from the monthly series

## Verification before push

- All three monthly files exist ONLY in `reference/`
- Cross-nav links work when opening any of the files in a browser
- The parent directory no longer has any `chat-analysis-*.html` files
- `git status` shows only the reference/ changes (no stray files)

## Completion

Report back with:
- PR URL
- Confirmation that cross-nav was tested
- Any surprises (e.g. if the old reference files had content that needed merging)
