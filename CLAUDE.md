# CPO Connect Hub — CLAUDE.md

Project-specific guidance for Claude Code.

## What this is

A members-only web app for the CPO Connect community. Vite + React + Tailwind frontend, Express backend (server.ts), PostgreSQL via raw `pg` driver (no ORM), magic-link auth via Resend.

Deployed on Render (Frankfurt): `cpo-connect-hub` service. Shares the region-locked Postgres instance (`truth_tone`) via the `cpo_connect` schema.

## Deprecated repos (do not use)

- **`ESchwaa919/cpo-connect-ai-chat`** — archived 2026-04-10. This was the original standalone static site for Jan/Feb 2026 chat analysis (created Jan 2026, before the members area existed). It has been superseded by this repo (`cpo-connect-hub`) and the members area within it. **Do not** add new files, commits, or monthly insights to `cpo-connect-ai-chat`. All chat-related work lives here now.

## Key directories

| Path | Purpose |
|---|---|
| `src/` | React frontend (Vite + TS) |
| `src/pages/members/` | Authenticated members area (ChatInsights, Directory, Profile) |
| **`src/data/insights/`** | **Canonical home for monthly chat insight components (React/TSX). Each month is its own component; rendered by `src/pages/members/ChatInsights.tsx`.** |
| `server.ts` | Express backend entry |
| `server/` | Backend routes, migrations, db helpers |
| `server/migrations/` | SQL migrations run on startup |
| `reference/` | Legacy static HTML artifacts (Jan/Feb/Mar 2026 chat analyses + `general.html`). Not served to members; kept for historical link continuity only. **Do NOT add new chat-insight work here** — new monthly insights belong in `src/data/insights/` and render via `src/pages/members/ChatInsights.tsx`. |
| `public/` | Static assets for the frontend |
| `dist/` | Build output |

## The `reference/` directory

Legacy / archival. Contains the original standalone static HTML chat analyses from before the members area existed. These files are **not served to members** — the canonical surface for monthly insights is the ChatInsights members page (`/members/chat-insights`).

Current contents (as of 2026-04-10):
- `chat-analysis-jan2026.html` — Jan 2026 insights (original static HTML)
- `chat-analysis-feb2026.html` — Feb 2026 insights (original static HTML)
- `general.html` — early general channel snapshot

**Rule (updated 2026-04-24):** `reference/` is archival only. New monthly chat insights live as TSX components in `src/data/insights/` and are rendered via `src/pages/members/ChatInsights.tsx`. Do not add new `.html` files under `reference/`.

## Authentication

- Magic-link auth via Resend. Magic link tokens stored in `magic_link_tokens` table.
- Sessions stored in `sessions` table with an HttpOnly cookie.
- `SESSION_SECRET` must be stable across deploys (fixed on Render env vars).
- `RESEND_API_KEY` — must be a valid key tied to a Resend account with a verified sending domain. Rotating the key requires a redeploy.
- See ProtectedRoute component for frontend auth guards.

## Resend gotcha (2026-04-10)

If login suddenly fails with "Application not found" from Resend even though the dashboard shows the key as operational, the key is likely tied to a deleted/archived Resend application. Fix: generate a new API key in the Resend dashboard, update `RESEND_API_KEY` env var on Render, and redeploy. Consider adding a deploy-time health check for magic link auth to catch this sooner.

## Database

Raw SQL via `pg`, schema `cpo_connect`. Tables:
- `magic_link_tokens` — passwordless auth tokens
- `sessions` — active user sessions
- `member_profiles` — editable user data (bio, skills, links, privacy flags)
- `events` — analytics log (fire-and-forget)

Migrations run automatically on server startup from `server/migrations/`.

## Workflow

1. Make code changes locally
2. Commit and push to `main`
3. Render auto-deploys on push
4. Verify at `https://cpo-connect-hub.onrender.com` (or the prod URL in `render.yaml`)

No local dev database by default — local dev hits the remote Postgres via `DATABASE_URL`. Verify your IP is in Render's Postgres allowlist before running any Prisma / SQL against prod (see global CLAUDE.md and `reference_starlink_ip_rotation.md` memory).

## AI integration

`@anthropic-ai/sdk` is installed but not yet used in code. Target use case: the "chat to the chat" feature (members can ask natural language questions about WhatsApp group history). Spec being designed 2026-04-10.

## Don't

- Don't add new files to `reference/` — it's archival only. Monthly insights belong in `src/data/insights/`.
- Don't modify schema without a migration file in `server/migrations/`
- Don't bypass ProtectedRoute for members-only routes
- Don't store secrets in source — all secrets are Render env vars
