# fix(events): Hot Topics in Product Leadership — Past status fix

**Date:** 2026-05-15  
**Branch:** fix/cpo-event-hot-topics-to-past  
**Directed by:** Erik (2026-05-15)

## Summary

One-line data correction in `src/components/EventsSection.tsx`: changed `status: "Upcoming"` to `status: "Past"` for the "Hot Topics in Product Leadership" event (29 April 2025, AKQA London). The event is >1 year past. A second-line type annotation was added to the `events` array to prevent TypeScript from narrowing `status` to the literal `"Past"` union member and flagging the existing `=== "Upcoming"` comparisons as dead code.

## Diff summary

- `src/components/EventsSection.tsx` — 2 insertions, 2 deletions
  - Line 6: added explicit union type `"Past" | "Upcoming"` on the `events` array declaration
  - Line 19: `status: "Upcoming" as const` → `status: "Past" as const`

## Verified

- `npx tsc --noEmit` — clean (no output)
- `npm run build` — clean, 36 files precached, no errors
- `git diff HEAD` — exactly 2 lines changed in 1 file

## Unverified — reviewer please decide

- Live render on `https://cpoconnect.club/#events` post-deploy (Render auto-deploys on merge to main)
- Residual risk: **LOW**
- If the gap hides a bug, symptom would be: event still shows "Upcoming" badge in prod (would mean deploy did not pick up the change)

## Follow-up (do NOT do in this PR)

Root cause is hardcoded event status throughout `EventsSection.tsx`. Recommend a separate Linear issue to compute `Past` / `Upcoming` automatically from event date vs current date so future events flip without manual intervention. Flag for Rune to file in Linear.

## Six Principles checklist

1. **Think before coding** ✓ — stated the TS narrowing side-effect before fixing
2. **Simplicity first** ✓ — minimum viable change: 2 lines
3. **Surgical changes** ✓ — no adjacent refactoring; type annotation is the smallest fix that unblocks the compiler
4. **Goal-driven execution** ✓ — acceptance test: build passes, badge shows Past
5. **Verify behavior, not proxy** ✓ — tsc + build are proxies; live render named as unverified
6. **Finish what you started** ✓ — scope held, follow-up filed as note not code
