# CPO Connect — Founders re-layout + Events→Luma widget (2026-05-19)

**Branch:** `worktree-cpo-founders-events` (off latest origin/main)
**Scope:** `src/components/FoundersSection.tsx`, `src/components/EventsSection.tsx` only. 26 insertions, 69 deletions.

## What changed

**Task 1 — Founders**
- Removed Glynn Williams entirely from the `founders` array (1 line).
- Container `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-5 max-w-3xl mx-auto` → `flex flex-wrap justify-center gap-5 max-w-3xl mx-auto`.
- Each card got `basis-[calc(50%-0.625rem)] sm:basis-[calc(33.333%-0.834rem)]` so it is 3-per-row at ≥640px (rows 3/3/2 for the 8 remaining founders) and 2-per-row below 640px. `flex-wrap justify-center` centres every row **including the short final row**.
- Spacing unchanged: `gap-5` (20px) kept exactly as before.
- Display convention is "First Last"; the post-removal list is already alphabetical by first name (Erik, Gokul, Gregor, James, Jessie, Sarah, Scott, Shiv) — no reordering of data needed.

**Task 2 — Events**
- Removed the two `JOIN_URL`-linked event boxes and the now-dead `events` array, `JOIN_URL` const, and `Calendar/MapPin/Clock` lucide imports. `motion` import kept (still used by the wrapper).
- Inserted the exact Luma embed inside a `motion.div` wrapper that matches the section header's existing reveal pattern. Iframe attributes preserved; made responsive via `style` `width:100%; maxWidth:600px` (raw 600px no longer breaks mobile). Added `title` for iframe a11y.

## Verified

- **Founders desktop (Chrome, ~1605px viewport, DOM geometry — authoritative):** 8 cards, all equal width 243px. Row1 y=722 (Erik x=419 / Gokul x=681 / Gregor x=944), Row2 y=895 (James / Jessie / Sarah), Row3 y=1068 (Scott x=550 / Shiv x=813). Full-row span x=419→1187 (centre 803); final 2-card row span x=550→1056 (centre **803**) → final row is exactly horizontally centred, not left-aligned. Inter-card gap = 19–20px = `gap-5` unchanged. Glynn absent. Visual screenshots confirmed each row renders with the centred final row.
- **Founders mobile (same-origin 414px iframe harness, `matchMedia(min-width:640px)=false` → genuine mobile branch):** `documentElement.scrollWidth == clientWidth == 408` → **no horizontal overflow**. 8 cards, equal width 170px, **2 per row** (Erik|Gokul, Gregor|James, Jessie|Sarah, Scott|Shiv). Row span x=24→384 inside 408 viewport — symmetric 24px margins each side → centred. 20px gap preserved. Reflows cleanly, readable.
- **Events desktop (Chrome, DOM + visual):** iframe `src` = exact `https://luma.com/embed/calendar/cal-FlrNymwoPAxiNWC/events?lt=light`, 600×450, `allowFullScreen`, `title` set. **0 remaining `fillout`-linked old boxes** (`#events [href*="fillout"]` → 0). Luma widget rendered real events ("Book Talk & Q&A - Matt LeMay - Impact First Product Teams", "By CPO Connect", "Google Meet").
- **Events mobile (414px harness):** iframe rendered width = **360px** (not raw 600px) → responsive shrink to container. `scrollWidth == clientWidth == 408` → **no horizontal overflow**; iframe right edge 384 ≤ 408. Visual screenshot showed the Luma widget rendering cleanly inside the mobile frame with real events stacked, no clipping.
- **Proxies (named as proxies):** `tsc -b` clean; `eslint` clean on both changed files; `npm run build` green (pre-existing chunk-size warning unrelated, untouched).

## Unverified — reviewer please decide

- **No "before" screenshots captured** on this branch; the prior state (Glynn present, 3-col grid with left-aligned 2-card last row, two fillout-linked boxes) is documented from the original source, not a screenshot. Residual risk: LOW — diff is small and the before state is fully described by the removed code.
- **MCP screenshot files** are held in the Chrome extension sandbox and were not retrievable to embed as files; visual evidence was observed inline during verification and is described above. Authoritative proof is the DOM-geometry measurements. Residual risk: LOW.
- **Luma widget rendered against live luma.com.** Verified on `localhost:8080`; production (`cpoconnect.club`) uses the identical embed URL/attributes — Luma does not domain-restrict this public calendar embed. Residual risk: LOW. If the gap hides a bug, symptom would be: a blank bordered box where the calendar should be on prod.
- Founders cards use framer-motion `whileInView` reveal (pre-existing, unchanged); cards appear as they scroll into view — same behaviour as before this change.

## Six Principles

1. **Think before coding** — confirmed display convention (First Last), verified post-removal count (8) and that the list is already alphabetical; chose flex+justify-center because CSS grid cannot centre a short final row.
2. **Simplicity first** — flex-wrap + `justify-center` + `basis` calc; no new deps, no JS layout logic, no abstractions.
3. **Surgical** — only the two target sections; removed strictly the data/imports tied to the deleted boxes; `gap-5` and card styling untouched; `motion` import retained.
4. **Goal-driven** — acceptance criteria (Glynn gone, alphabetical, 3/3/2 centred incl. final row, gap unchanged, mobile clean, Luma replaces boxes, responsive) each checked with DOM measurement.
5. **Verify behaviour not proxy** — verified the user-facing layout via Chrome DOM geometry at desktop and a genuine 414px mobile viewport, plus visual rendering of the live Luma widget; build/lint/tsc named explicitly as proxies.
6. **Finish what you started** — task completed end-to-end; PR opened, **not self-merged** — orchestrator independent review gates merge.

## Hard rules

- ⛔ No `npm install` / no package additions (Mini Shai-Hulud).
- PR opened; **DO NOT self-merge**.
