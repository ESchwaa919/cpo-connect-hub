# CPO Connect — LinkedIn Profile Enrichment

**Date:** 2026-03-15
**Status:** Draft

## Overview

Add a profile page to the members area that lets CPO Connect members view and edit their profile data, with an optional one-click enrichment flow that uses their public LinkedIn profile to generate an original bio and extract skills via the Claude API.

The feature has two distinct layers:

1. **Profile page with manual editing** — works standalone, no external dependencies. Data seeded from the Google Sheet on first login, then owned by PostgreSQL.
2. **LinkedIn enrichment** — optional layer on top. Scrapes the user's public LinkedIn page, passes the raw HTML to Claude (haiku), and writes back an AI-generated bio and skills list. Users can edit all AI-generated fields after the fact.

This spec builds on the members area and authentication foundation documented in `2026-03-14-members-area-design.md`.

---

## User Flow

### 1. Profile Page (`/members/profile`)

On first login, the member's profile is seeded from the Google Sheet row that matched their email during auth: name, role, current org, sector, focus areas, areas of interest, and LinkedIn URL. These are written to `cpo_connect.member_profiles`.

The profile page displays all fields in an editable form. The user can update anything and save. Changes persist to PostgreSQL via `PUT /api/members/profile`.

### 2. Enrichment Banner

If `profile_enriched = false` AND the user has a non-empty `linkedin_url`, the profile page shows a banner:

> "Enrich your profile with your LinkedIn data?"
> *[linked URL shown]* — **Enrich my profile** button

The user must explicitly click to confirm. No enrichment happens automatically.

### 3. Backend Enrichment Flow

`POST /api/members/profile/enrich` (authenticated, no request body):

1. Load the user's `linkedin_url` from `member_profiles`.
2. Fetch the public LinkedIn profile page as raw HTML (simple `fetch`, no browser simulation).
3. Pass the raw HTML to Claude (haiku model via Anthropic SDK) with a prompt instructing it to:
   - Write a clean 2–3 sentence professional bio in third person, entirely in the AI's own words. Do NOT quote or reproduce any LinkedIn text verbatim.
   - Extract 5–10 skills/expertise tags as a comma-separated string.
4. Write `bio` and `skills` back to `member_profiles`. Set `profile_enriched = true`. Set `enrichment_source = 'linkedin'`.
5. Return the updated profile object.

**Copyright note:** The AI must generate an original summary — it must not reproduce any LinkedIn content. The prompt enforces this. This is the primary safeguard against copyright issues.

### 4. Post-Enrichment Editing

After enrichment, the profile page renders the AI-generated bio and skills in the same editable form. The user can freely edit or clear them. Saving triggers `PUT /api/members/profile` as normal.

### 5. Directory Search

The member directory search is updated to include `bio`, `skills`, `focus_areas`, and `areas_of_interest` in its full-text matching, in addition to name, role, and org.

---

## Architecture

### Frontend

- **Profile page component:** `src/pages/members/Profile.tsx`
- Route: `/members/profile` (added to protected routes alongside `/members/directory`)
- Profile nav item added to the authenticated navbar

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/members/profile` | Yes | Return current user's profile from PostgreSQL |
| PUT | `/api/members/profile` | Yes | Update editable profile fields |
| POST | `/api/members/profile/enrich` | Yes | Trigger LinkedIn scrape + AI enrichment |

### Database

Table: `cpo_connect.member_profiles` (created by `server/migrations/002-member-profiles.sql`)

Migration `003-profile-enrichment.sql` adds two columns:

```sql
-- 003-profile-enrichment.sql
ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT DEFAULT '';
```

Full table shape after both migrations:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `email` | TEXT | FK to session email, unique |
| `name` | TEXT | |
| `role` | TEXT | |
| `current_org` | TEXT | |
| `sector` | TEXT | |
| `location` | TEXT | |
| `focus_areas` | TEXT | comma-separated or JSON |
| `areas_of_interest` | TEXT | |
| `linkedin_url` | TEXT | |
| `bio` | TEXT | AI-generated, user-editable |
| `skills` | TEXT | added by 003 |
| `profile_enriched` | BOOLEAN | default false |
| `enrichment_source` | TEXT | added by 003; `'linkedin'` or `''` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### LinkedIn Scraping

A plain `fetch()` of the public profile URL. No headless browser, no proxies. This is intentionally a minimal first bet — LinkedIn may return a redirect, a login wall, or a 403. The enrichment flow handles failure gracefully: the banner remains, the user is shown an error message, and manual editing always works.

Rate limiting: one enrichment attempt per user per 24 hours, enforced server-side by checking `updated_at` on the `member_profiles` row when `profile_enriched` is true.

### AI Processing

- **SDK:** Anthropic Node.js SDK (`@anthropic-ai/sdk`)
- **Model:** `claude-haiku-4-5` (cost-efficient for a single profile scrape)
- **Prompt goal:** Generate an original bio and extract skills — no reproduction of LinkedIn content
- **Failure handling:** If the Claude API call fails, return 500; the enrichment banner remains and the user can retry

---

## API Contracts

### `GET /api/members/profile`

Returns the current user's full profile.

**Response 200:**
```json
{
  "profile": {
    "email": "jane@example.com",
    "name": "Jane Smith",
    "role": "Chief Product Officer",
    "currentOrg": "Acme Corp",
    "sector": "SaaS",
    "location": "London",
    "focusAreas": "Product strategy, Team building",
    "areasOfInterest": "AI, Platform",
    "linkedinUrl": "https://linkedin.com/in/janesmith",
    "bio": "",
    "skills": "",
    "profileEnriched": false
  }
}
```

**Error responses:**

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `not_authenticated` | No valid session |

---

### `PUT /api/members/profile`

Update one or more profile fields.

**Request body** (all fields optional):
```json
{
  "name": "Jane Smith",
  "role": "CPO",
  "currentOrg": "Acme",
  "sector": "SaaS",
  "location": "London",
  "focusAreas": "Product strategy",
  "areasOfInterest": "AI",
  "bio": "Jane is a product leader...",
  "skills": "Product strategy, Roadmapping, AI"
}
```

**Response 200:** `{ "profile": { ... } }` (full updated profile)

**Error responses:**

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `validation_error` | Invalid field value |
| 401 | `not_authenticated` | No valid session |

---

### `POST /api/members/profile/enrich`

Trigger LinkedIn enrichment for the current user. Uses the `linkedin_url` already stored on their profile.

**Request body:** none

**Response 200:** `{ "profile": { ... } }` with updated `bio`, `skills`, `profileEnriched: true`

**Error responses:**

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `no_linkedin_url` | No LinkedIn URL on profile; user must add one first |
| 400 | `already_enriched` | Profile already enriched; must be reset before re-enriching |
| 429 | `rate_limited` | Enrichment attempted within the last 24 hours |
| 401 | `not_authenticated` | No valid session |
| 502 | `linkedin_fetch_failed` | LinkedIn returned an error or was unreachable |
| 500 | `ai_processing_failed` | Claude API call failed |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for bio generation and skill extraction |

All other environment variables are inherited from the members area spec (`DATABASE_URL`, `SESSION_SECRET`, etc.).

---

## Risks & Fallbacks

### 1. LinkedIn blocks scraping (highest probability)

LinkedIn actively blocks automated fetches. A plain `fetch()` will likely receive a login redirect, a 429, or a 403 on the first attempt or after a few attempts. The fallback is manual editing — the profile page and all edit functionality work regardless of whether enrichment succeeds. The enrichment banner is a nice-to-have on top of a fully functional profile.

### 2. Rate limiting / cooldown

One enrichment attempt per user per 24 hours. Prevents hammering LinkedIn or the Claude API if a user hits retry repeatedly after a failed scrape.

### 3. Data quality

AI-generated bios may be generic or miss nuance. Users are expected to edit the output. The UI should set this expectation: "We've generated a draft bio from your LinkedIn — feel free to edit it."

### 4. Privacy & consent

- Only the authenticated user's own LinkedIn URL is ever scraped (the URL is stored on their own profile row, and the endpoint uses their session identity).
- The user must explicitly click to trigger enrichment — no passive scraping.
- No other member's LinkedIn profile is ever fetched.

---

## Implementation Order

Build in this sequence so each step is independently deployable:

1. **Profile page — manual editing** (`src/pages/members/Profile.tsx`, `GET`/`PUT` endpoints, `003-profile-enrichment.sql` migration). This is the foundation; ships and works standalone.
2. **Directory search update** — extend client-side search to include `bio`, `skills`, `focusAreas`, `areasOfInterest`.
3. **LinkedIn enrichment** — `POST /api/members/profile/enrich`, scrape + Claude AI call, enrichment banner on the profile page.

---

## Future

- **Skills-based member matching** — "Members with similar skills" section on profile page, driven by overlap in `skills` and `focus_areas`.
- **Profile completeness score** — nudge members to fill in empty fields; show a completeness percentage on the profile page.
- **Re-enrichment** — allow a user to reset `profile_enriched = false` and trigger enrichment again (e.g., after updating their LinkedIn). Currently blocked by the `already_enriched` guard.
- **Richer skills UI** — replace the plain text `skills` field with a tag-chip input component.
