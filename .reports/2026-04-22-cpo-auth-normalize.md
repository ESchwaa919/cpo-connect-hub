# PR #38 follow-up — auth.ts first-login LinkedIn normalize

**Date:** 2026-04-22
**Dispatch:** `memory/dispatch_cpo_auth_normalize_20260422.md`
**Trigger:** Codex Medium review finding on PR #38
**Branch:** `fix/tania-triple-bug` (same as PR #38 — one additional commit)

---

## The gap

`server/routes/auth.ts:186` was persisting `member.linkedinUrl` raw into `member_profiles.linkedin_url` on first-login profile creation. PR #38 added `normalizeLinkedinUrl` to `PUT /profile` and `POST /profile/resync` but not to the `/verify` first-login INSERT. A new member joining via magic-link whose Sheet1 LinkedIn lacked `https://` (the Tania shape) would land with an un-protocoled value → Bug 2 recurrence on their very first profile view.

## The fix

Single-call wrap in `server/routes/auth.ts`:

- Import `normalizeLinkedinUrl` from `../lib/url.ts`.
- Change the 9th INSERT parameter from `member.linkedinUrl` to `normalizeLinkedinUrl(member.linkedinUrl)`.

No other files touched. No refactor. Two diff lines in auth.ts plus the new test file.

## Test added

`src/test/auth-verify-linkedin-normalize.test.ts` — 2 cases:

1. First-login with raw `www.linkedin.com/in/New-Member` → INSERT parameter stored as `https://www.linkedin.com/in/New-Member`.
2. First-login with already-normalized `https://www.linkedin.com/in/already` → INSERT stores unchanged (control).

Test mocks `pool.query` and `lookupMember`, invokes the `/verify` handler directly via `router.stack`, and locates the `INSERT INTO cpo_connect.member_profiles` call by SQL match (not by positional index) so the assertion isn't brittle against future handler reordering.

## Verified

- **Environment:** vitest / jsdom in local dev.
- **Evidence:**
  - `npx vitest run src/test/auth-verify-linkedin-normalize.test.ts` → 2/2 pass.
  - Failing test written first: pre-fix, test showed `values[8]` was `'www.linkedin.com/in/New-Member'` (raw). Post-fix: `'https://www.linkedin.com/in/New-Member'`.
  - `npx tsc -b` → clean.
  - `npm test` → 325/325 pass (was 323 before this change; +2 from the new file).
  - `npm run build` → clean; service worker regenerates 35 precached files.

## Unverified — reviewer please decide

- **Real `/verify` HTTP flow in a browser.** I tested the handler function with a mocked `pool` and a mocked `lookupMember` return. I did not hit a real magic-link flow in Chrome and observe the DB row land with `https://…`. For a one-line wrap around a function that already has its own 21-test coverage (the `normalizeLinkedinUrl` unit + cross tests from PR #38's initial ship), proxy-test coverage is defensible — but it is proxy.
- **Residual risk: LOW.** The wrap is a single function call around a pure function that has unit coverage for the exact input shape (`www.linkedin.com/in/foo` → `https://www.linkedin.com/in/foo`). If the wrap silently regressed, the symptom would be: a brand-new member's first profile render shows their LinkedIn icon as a relative URL → `/members/…` 404. Post-merge, Erik's plan is to verify on live `cpoconnect.club` the next time a test magic-link first-login occurs.
- **Codex re-review.** Not yet re-triggered from this session. Will be re-run by the orchestrator after push.
- **Migration idempotency Medium.** Codex flagged a separate Medium on the `015-linkedin-url-normalize.sql` migration's idempotency. Per dispatch instruction, that is tracked as a **separate follow-up** and is not addressed in this commit.

## Files changed

- `server/routes/auth.ts` — +1 import, 1-line wrap (total: 2 diff lines).
- `src/test/auth-verify-linkedin-normalize.test.ts` — new (2 tests, ~160 LOC).
- `.reports/2026-04-22-cpo-auth-normalize.md` — this report.
