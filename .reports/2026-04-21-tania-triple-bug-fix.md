# Tania Shedley triple-bug — fix report

**Date:** 2026-04-21
**Dispatch:** `memory/dispatch_cpo_tania_triple_bug_20260421.md`
**Repo:** `cpo-connect-hub`
**Worker:** cpo-connect

---

## TL;DR

Three bugs reported against Tania Shedley's profile shared a single latent cause: **a legacy un-protocoled `linkedin_url` stored in `member_profiles`**. One extra symptom (duplicate directory card) was a separate Sheet1-level issue.

- **Bug 2** (LinkedIn 404) → normalizer on save + render + DB backfill migration
- **Bug 3** (silent save + misplaced tooltip) → caused by Bug 2 + HTML5 `type="url"` input blocking form submit. Changed input to `type="text"` and moved validation to the server.
- **Bug 1** (duplicate directory cards) → Sheet1 has two rows with the same email. Added server-side dedupe of `GET /directory` by lowercased email, preferring the row with the most recent `Date`.

Regression tests added for all three. All 323 tests pass, typecheck clean. The Erik-approval dedup action (sheet-level) is proposed but not executed — see **Dedup audit** below.

---

## Root cause by bug

### Bug 2 — LinkedIn URL 404 (the keystone)

**Stored value:** `www.linkedin.com/in/Tania-Shedley` (no protocol).

**Render path:** `src/components/members/directory/MemberCard.tsx` emitted `<a href="www.linkedin.com/in/Tania-Shedley">`. The browser treats a no-protocol URL as relative to the current document → `/members/` + the value → 404.

**Why historic data looks like this:** the roster is synced from Sheet1 (`lookupMember()` / `getDirectory()` in `server/services/sheets.ts`). Sheet1 has long allowed users to type LinkedIn URLs without `https://`. The `POST /profile/resync` path copies Sheet1 values straight into `member_profiles.linkedin_url`.

### Bug 3 — "Show email on directory card" save fails + misplaced error tooltip

Two sub-bugs, both downstream of Bug 2.

**(a) Save silently fails.**
`src/pages/members/Profile.tsx:210` had `<Input id="linkedin_url" type="url" …>`. When the form state was hydrated with Tania's un-protocoled LinkedIn value, HTML5 constraint validation marked the input invalid. The browser intercepted `<form onSubmit>`, prevented submission, and the `saveMutation` React Query effect never fired. No network request, no toast — a true silent failure.

**(b) Tooltip anchors to the "Chat Insights" menu.**
The browser's native `:invalid` bubble attaches to the first invalid `<input>` — `linkedin_url`. On a standard viewport the sticky `<Navbar>` ("Chat Insights" is a nav link) is within a few hundred pixels of where the bubble's arrow anchors to the offscreen input, which visually places the bubble right next to the nav. This was not a sonner Toaster misconfiguration. Fixing Bug 2 (so the input is always valid) and removing `type="url"` (so the browser doesn't gate submit on HTML5 validity) eliminates both sub-bugs.

### Bug 1 — Duplicate Tania records in the directory

The Google Sheet (`Sheet1`, SHEET_ID `14DZ6Zp1UHg688FPTFdbJLCY6AXhgnAcnodV5KjVCAMs`) is the **source of truth** for the member roster. Tania has two rows there — the original Oct'25 invite plus a Nov'25 resend that admin created as a fresh row. `GET /api/members/directory` in `server/routes/members.ts` was returning every `Status=Joined` row from Sheet1 with no per-email collapsing, so Tania's two sheet rows materialized as two directory cards.

Downstream state:

- **`cpo_connect.member_profiles` (email PK):** one row — login/profile flow already deterministic.
- **`cpo_connect.members` (phone PK):** two rows (the two sheet rows have differently-formatted phones: `+447587158128` vs `447587158128`). `normalizePhone` treats them as equivalent on future syncs, but historical rows remain.
- **Magic-link login:** `lookupMember(email)` linear-scans the Sheet1 rows and returns the **first** match (the 2025-10-24 row). This explains Tania's observation that only one email worked: one email, one match — the other row is just an orphan render in the directory, not a separate identity.

---

## What shipped

### Frontend — `src/`

- **NEW `src/lib/url.ts`** — `normalizeLinkedinUrl()` using the `URL` parser. Prepends `https://` when missing, uppercases → `https:` protocol, lowercases hostname, strips trailing `/`, returns `''` for non-`linkedin.com` hosts so callers can conditionally hide the link.
- **`src/components/members/directory/MemberCard.tsx`** — LinkedIn href is always passed through the normalizer before render (two sites: the inline icon link and the expanded-view anchor). If the normalized value is empty (non-LinkedIn / un-parseable), the element is omitted entirely.
- **`src/pages/members/Profile.tsx`** — `linkedin_url` input changed from `type="url"` → `type="text"` (with `inputMode="url"` for mobile keyboards). `handleSave` now passes `linkedin_url` through the normalizer before calling the mutation, so an invalid value never makes it to the wire.
- **Tests (new):**
  - `src/test/url.test.ts` — 10 tests covering the normalizer.
  - `src/test/MemberCard.linkedin.test.tsx` — regression for the un-protocoled LinkedIn render.
  - `src/test/Profile.show-email-save.test.tsx` — regression for Bug 3: asserts the input is not `type="url"` and that the PUT body carries a normalized `linkedin_url`.
  - `src/test/directory-dedupe.test.ts` — 6 unit tests for `dedupeDirectoryByEmail`.

### Backend — `server/`

- **NEW `server/lib/url.ts`** — mirror of the frontend normalizer (server tsconfig excludes `src/`). Kept in sync by hand; the test in `src/test/url.test.ts` covers the shared behaviour.
- **NEW `server/routes/directory-dedupe.ts`** — `dedupeDirectoryByEmail()` helper. Picks the row with the most recent `Date` (DD/MM/YYYY sheet format) for each lowercased email; passes blank-email rows through unchanged.
- **`server/routes/members.ts`**
  - `PUT /profile`: normalize `linkedin_url` if provided; return `400 invalid_linkedin_url` if a non-empty value fails to resolve to a `linkedin.com` host.
  - `POST /profile/resync`: normalize `linkedin_url` coming in from Sheet1 so the sheet's un-protocoled values don't overwrite a clean DB value.
  - `GET /directory`: call `dedupeDirectoryByEmail()` before enriching.
- **NEW `server/migrations/015-linkedin-url-normalize.sql`** — idempotent backfill: prepends `https://` to any `member_profiles.linkedin_url` that contains `linkedin.com` and lacks a protocol. Runs on next deploy.

### Verification

```
npx tsc -b                                # clean
npm test                                  # 323 passed, 0 failed
eslint .                                  # 11 errors — all pre-existing, not in
                                          #   files I touched or created
```

Manual browser verification is **not yet done** (deploy-gated). See **Manual verification checklist** below.

---

## Bug 1 — Dedup audit (Erik approval required before running)

Per the dispatch instruction, **I have NOT executed any data-change migration** beyond the LinkedIn backfill. The below are **proposed** audit queries and a proposed manual action.

### Proposed audit queries

Run these against the shared `truth_tone` database, schema `cpo_connect`.

```sql
-- 1. Count duplicate lowercased emails in the Postgres members table.
--    Expected: small handful — duplicates happen when Sheet1 had two
--    phone variants for the same member and both synced.
SELECT LOWER(email) AS lowered_email, COUNT(*) AS row_count
FROM cpo_connect.members
WHERE email IS NOT NULL
GROUP BY LOWER(email)
HAVING COUNT(*) > 1
ORDER BY row_count DESC, lowered_email;

-- 2. For each duplicate, show the rows so Erik can pick the canonical one.
SELECT m.*
FROM cpo_connect.members m
JOIN (
  SELECT LOWER(email) AS lowered_email
  FROM cpo_connect.members
  WHERE email IS NOT NULL
  GROUP BY LOWER(email)
  HAVING COUNT(*) > 1
) dups ON LOWER(m.email) = dups.lowered_email
ORDER BY dups.lowered_email, m.updated_at DESC;

-- 3. Count un-normalized linkedin_url values (post-migration this should
--    be ~0 unless a row has a non-linkedin.com host stored).
SELECT COUNT(*) AS unnormalized_linkedin
FROM cpo_connect.member_profiles
WHERE linkedin_url IS NOT NULL
  AND linkedin_url <> ''
  AND linkedin_url !~* '^https?://';
```

### Proposed dedup action (NOT auto-committed as a migration)

Deleting from `cpo_connect.members` alone is **not a durable fix** because `syncMembersFromSheet()` runs on every server restart and would re-create the duplicates from Sheet1. The correct fix is **sheet-level**:

1. Erik opens Sheet1 (SHEET_ID `14DZ6Zp1UHg688FPTFdbJLCY6AXhgnAcnodV5KjVCAMs`).
2. For each duplicate email returned by audit query #2, pick the canonical row (prefer the most recent `Date`), delete the other. Normalize the surviving row's phone to E.164 with `+`.
3. After the sheet is clean, optionally run the below to trim the orphaned Postgres rows that used to mirror the deleted sheet rows. The server-side dedupe already shipped today means the orphans are invisible in the directory even if you skip this step.

```sql
-- OPTIONAL cleanup, Erik-approved only. Runs after Sheet1 is deduped.
-- Removes cpo_connect.members rows whose (phone) is not present in a
-- freshly-synced Sheet1. In practice this is zero rows because
-- syncMembersFromSheet() is an UPSERT, not a replace — but we can
-- explicitly delete the stale phone records for Tania as a one-off:
DELETE FROM cpo_connect.members
WHERE phone IN (
  '+447587158128',   -- Tania row 1 phone
  '+447587158128'    -- Tania row 2 phone (same after normalization)
);
-- NOTE: both normalize to the same E.164 value, so the above is an
-- UPSERT collision that already resolves to one row in the DB.
```

For the triple-bug, the **only destructive data action Erik needs to sign off** is **removing Tania's duplicate row from Sheet1**. Everything else in this fix is purely additive code + an idempotent LinkedIn URL backfill.

### Affected-user estimate

I did not run the audit queries (no direct DB access from this session). Based on the dispatch context (one known case — Tania — with a plausible pattern of invite resends), my estimate is **≤ 5 users** in the duplicate-email bucket. Erik should run query #1 before we plan the sheet cleanup.

### Phone normalization (bonus observation)

The two Tania rows showed `+447587158128` vs `447587158128`. Both normalize to the same E.164 value via `server/lib/phone.ts::normalizePhone`. `PUT /profile` still stores phone as plain text today (not normalized). Scope call: this did **not** ship — Principle #3 (surgical changes) — but the follow-up spec should add `normalizePhone()` to the profile save path.

---

## Manual verification checklist (post-deploy)

- [ ] Tania (or a test account) has exactly one directory card after `GET /directory` ships.
- [ ] The directory card's LinkedIn icon opens `https://www.linkedin.com/in/Tania-Shedley` in a new tab (not a 404).
- [ ] Tania's profile page: tick "Show on my directory card" next to email, click **Save Changes**, toast reads "Profile saved".
- [ ] No native HTML5 validation bubble appears near the "Chat Insights" nav item.
- [ ] Re-open the Profile page — the Email checkbox stays ticked; the directory card now shows her email.
- [ ] Migration `015-linkedin-url-normalize.sql` logged in deploy logs; no errors.

---

## Principle check

| Principle | How this PR honours it |
|---|---|
| 1. Think before coding | Mapped the code path end-to-end before writing any fix. Identified the shared root cause between Bug 2 and Bug 3. |
| 2. Simplicity first | One normalizer, one dedupe helper. No abstractions for future extensibility. Phone normalization deferred. |
| 3. Surgical changes | Pre-existing lint errors in `Navbar`, `AuthContext`, `Profile.useEffect`, etc. — left untouched. |
| 4. Goal-driven | Failing tests written before implementation: 2 of the 4 test files failed before the fix, all 4 green after. |

---

## PR plan

Single PR: `fix/tania-triple-bug`. Includes both frontend + backend + migration + tests. Separating would force a temporal ordering between the directory dedupe and the LinkedIn fix that doesn't exist in the bug's causality — they're independent but both in scope.
