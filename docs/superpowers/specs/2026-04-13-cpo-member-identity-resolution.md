# Member Identity Resolution — Design Spec

**Date:** 2026-04-13
**Status:** Approved, ready for implementation plan
**Owner:** Erik (product), Rune (orchestrator), cpo-connect worker (implementation)
**Companion spec:** [2026-04-13-cpo-members-area-redesign.md](./2026-04-13-cpo-members-area-redesign.md) — bundled in same PR

## Context

WhatsApp chat exports include sender metadata as either:
- A contact name (when the sender was in the exporter's address book at export time), or
- A raw phone number like `+44 7700 900123` (when the sender wasn't in their address book)

This produces inconsistent attribution across the Members Area UI:
- The same member may appear as `Sarah Jenkins` in one export and `+44 7700 900123` in another
- Different members see different names depending on whose export the data came from
- Raw phone numbers surface in source chips, contributor charts, and anywhere `author_name` is rendered

The CPO Connect Google Sheet already contains both **name and phone number** for every approved member in **Sheet1** (the Applications tab, 441 rows, the authoritative source for all member identity data). The `PublicMemberDirectoryMVP` tab is a public-facing VIEW of Sheet1 that intentionally omits phone numbers and emails for privacy. The data for a reverse lookup exists in Sheet1 — it just isn't wired into the ingestion pipeline or the rendering path.

This spec fixes that.

## Goals

- Every member's display name in the Members Area UI is consistent everywhere, regardless of how their messages were originally exported.
- No raw phone numbers ever surface in rendered UI. Even as a fallback, numbers are sanitized to `+44 ···· ···999` (country code + last 3 digits).
- The resolution is driven by **Sheet1** in the Google Sheet (the Applications tab — same tab already used by `lookupMember()` for magic-link auth), so updating a member's name or phone in the sheet propagates to their historical messages automatically.
- Historical attribution is preserved when a member leaves or changes identity — old messages keep the name that was canonical at ingest time.
- New WhatsApp ingestions get clean names from day one; existing ingested data gets cleaned up by a one-time backfill.

## Non-goals (explicit)

- Adding new members or managing member lifecycle in any way. This spec is read-only against the Google Sheet's member list.
- Building an admin UI to edit names or phone numbers. Directory edits happen in the Google Sheet; this spec consumes them.
- Supporting non-members in chat. Erik confirmed there are no non-members in the chat (invitees are always members at the time of message). The only "missing" case is a member whose status changed after the message, which the spec handles via ingest-time snapshot.
- Real-time sync from Google Sheet. A periodic (or on-demand) sync is sufficient.
- Handling multi-number members beyond "one canonical phone per member" — the directory is the source of truth.

## Architecture — hybrid lookup

Two layers of name resolution, so the display is always current but historical attribution is preserved when directory state changes.

```
┌──────────────────────────────────────────────────────────────┐
│ Display resolution chain (rendered in the UI)                │
│                                                              │
│   members.display_name (live)                                │
│      ?? messages.sender_display_name (frozen at ingest)      │
│      ?? sanitizePhone(messages.sender_phone)                 │
└──────────────────────────────────────────────────────────────┘
               ▲                    ▲                    ▲
               │                    │                    │
         live lookup          frozen snapshot       sanitized fallback
               │                    │                    │
               │                    │                    │
┌──────────────┴──────┐  ┌──────────┴──────────┐  ┌──────┴─────────┐
│ members table       │  │ messages table       │  │ sanitizePhone()│
│ ─────────────────── │  │ ──────────────────── │  │ utility        │
│ id (uuid)           │  │ id                   │  │                │
│ phone (E.164 pk)    │  │ ...                  │  │ +44 7700 900xyz│
│ display_name        │  │ sender_phone (E.164) │  │      ↓          │
│ email               │  │ sender_display_name  │  │ +44 ···· ···xyz │
│ updated_at          │  │ (frozen at ingest)   │  └────────────────┘
│                     │  │ ...                  │
│ synced from Sheet   │  │                      │
│ PublicMemberDirMVP  │  │ new columns added    │
└─────────────────────┘  │ by this spec         │
                         └──────────────────────┘
```

### Why hybrid

- **Live lookup** (`members.display_name`) means one Google Sheet edit propagates to all historical messages immediately. No re-ingest required when a member changes their display name.
- **Frozen snapshot** (`messages.sender_display_name`, populated at ingest from the directory at that moment) preserves historical attribution when a member leaves. The row in `members` is gone, but the snapshot in `messages` remains, so their old messages still show their original name instead of falling back to a phone number.
- **Sanitized fallback** is the last-resort hygiene layer. It protects against PII leakage if both lookups fail (e.g., a ingestion edge case, a phone number that doesn't match any directory row).

### Data model

#### New table: `members`

Schema (`cpo_connect` schema, raw SQL via `pg`, migration in `server/migrations/`):

```sql
CREATE TABLE IF NOT EXISTS cpo_connect.members (
  phone         TEXT PRIMARY KEY,         -- normalized E.164, e.g. '+447700900123'
  display_name  TEXT NOT NULL,
  email         TEXT,                     -- nullable, from Sheet1 col D
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_email ON cpo_connect.members (LOWER(email)) WHERE email IS NOT NULL;
```

- **Primary key is phone** (normalized E.164) because phone is the join key with WhatsApp messages.
- `email` is kept so we can do a secondary lookup against `chat_messages.author_email` when the WhatsApp export happens to include it (see Ingestion Pipeline section below).
- **Minimal schema only.** No `linkedin_url`, `role`, or `current_org` columns in this spec. If a richer hover card on source chips is wanted later, extend the schema in a follow-up. YAGNI.

#### Modified table: `cpo_connect.chat_messages`

This is the existing chat-ingestion table from `server/migrations/009-chat-tables.sql`. Current relevant columns: `author_name TEXT NOT NULL` (raw string from WhatsApp parser) and `author_email TEXT` (nullable, populated when the exporter's contacts included an email).

Two new columns added via a new migration file (`server/migrations/011-member-identity-resolution.sql` — next number in the sequence, idempotent per existing conventions):

```sql
ALTER TABLE cpo_connect.chat_messages ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE cpo_connect.chat_messages ADD COLUMN IF NOT EXISTS sender_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_phone
  ON cpo_connect.chat_messages (sender_phone)
  WHERE sender_phone IS NOT NULL;
```

- `sender_phone` — normalized E.164, populated at ingest time if the author string is recognizable as a phone number.
- `sender_display_name` — resolved at ingest time by looking up `sender_phone` in `members.display_name` (or `author_email` in `members.email` if phone extraction fails but an email is available). Frozen snapshot for historical preservation.

**Backward compatibility**: the existing `author_name` and `author_email` columns stay in place. The new columns augment rather than replace them — the old columns serve as the final fallback in the resolution chain.

## Phone normalization

**Library:** `libphonenumber-js` (already a common dependency, MIT-licensed, maintained). ~150KB — manageable.

**Canonical format:** E.164, e.g. `+447700900123` (no spaces, no punctuation, always includes the country code).

**Default country:** `GB` for the CPO Connect community (UK-based). This is the default parsing region when a number is ambiguous (e.g., `07700 900123` → `+447700900123`).

**Normalization utility:**

```ts
// src/server/lib/phone.ts (or wherever shared server utilities live)
import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function normalizePhone(raw: string, defaultCountry: 'GB' = 'GB'): string | null {
  if (!raw) return null
  const parsed = parsePhoneNumberFromString(raw, defaultCountry)
  if (!parsed || !parsed.isValid()) return null
  return parsed.format('E.164')  // '+447700900123'
}

export function sanitizePhone(e164: string): string {
  // '+447700900123' → '+44 ···· ···123'
  if (!e164.startsWith('+')) return '···'
  const country = e164.slice(1, 3)   // '44'
  const last3 = e164.slice(-3)       // '123'
  return `+${country} ···· ···${last3}`
}
```

**Edge cases:**
- `raw = null` or empty → return `null`
- Number with extension or invalid format → return `null` (caller falls back to whatever the raw author string was)
- International members with non-GB numbers → `libphonenumber-js` handles them correctly if the raw string includes a country code; if not, they get parsed as GB, which may fail — caller must handle `null`

## Google Sheet sync

### Source tab

**Sheet1** — the Applications tab, 441 rows. This is the same tab already consumed by `lookupMember(email)` in `server/services/sheets.ts` for magic-link authentication. It's the authoritative source for all member identity data (name, email, phone, status). The `PublicMemberDirectoryMVP` tab is a public-facing view that omits phone numbers and emails for privacy — **do not read from `PublicMemberDirectoryMVP`** in this spec.

**Columns we read (verified with Erik 2026-04-13):**

| Column | Header | Used for |
|---|---|---|
| C | Full Name | `members.display_name` |
| D | Email | `members.email` |
| E | Phone Number | `members.phone` (after E.164 normalization) |

**Status filter:** Only rows where the `Status` column equals `"Joined"` are synced into `cpo_connect.members`. This matches the behavior of `lookupMember()` for magic-link auth — we treat "approved, joined" members as the canonical identity set. Rows with Status = "Applied", "Rejected", "Withdrawn", etc. are skipped.

**Other columns in Sheet1** (not consumed by this spec): `Status`, `Job Role`, `LinkedIn Profile`, `Location`, `Current or most recent employer`, `Industry`, `Primary Product Focus Areas`, `Areas of Interest`. These are used by other features (auth, directory rendering). This spec intentionally ignores them — YAGNI until we need them.

**Consistency with the Directory page:** The Directory page renders members from `PublicMemberDirectoryMVP`, which is a view of Sheet1. As long as the view faithfully mirrors Sheet1's `Full Name` column (Erik's confirmation 2026-04-13), the name a member sees on the Directory page will match the name on their Search Chat source chips. If the view diverges from Sheet1 at any point (e.g., manual edits or overrides), Directory and Search Chat will drift — flag to fix upstream at the sheet level rather than patching in two places.

### Sync mechanism

Add a new service function: `syncMembersFromSheet()` in `server/services/sheets.ts` (or a new `members.ts` service file).

Behavior:
1. Fetch all rows from Sheet1
2. Filter to rows where Status = "Joined" (skip applicants, rejected, withdrawn)
3. For each joined row, call `normalizePhone()` on column E ("Phone Number")
4. If normalization succeeds AND column C ("Full Name") is non-empty, upsert into `cpo_connect.members` keyed by normalized phone, with `display_name` from col C and `email` from col D
5. If normalization fails, log a warning with the row index + raw phone value and skip the row (the member is in the sheet but we can't parse their phone — flag for a manual sheet fix)
6. After the pass, log the count of `joined / skipped_not_joined / phone_normalized / phone_failed / upserted`

**When does the sync run?**
- **On server startup** — runs once after migrations, cached result used for the ingest pipeline for the rest of the process lifetime. Simple and sufficient for now.
- **Admin manual trigger** — add a button to the existing `Admin · Ingestion` page: `Sync members from sheet`. Same function, on-demand.
- **NOT** on every WhatsApp ingest run — the ingest script can call the same function or rely on the startup-cached result.

**Caching:** the in-memory cache of resolved members can be a simple `Map<phone, displayName>`. Rebuild on sync. No TTL needed at first; refresh is manual or on restart.

**Why not a cron / polling sync?** Erik hasn't asked for it and the directory changes rarely enough (a few times a month at most) that manual trigger + server restart covers the freshness requirement. If this becomes annoying, add a cron in a follow-up.

## Ingestion pipeline changes

The WhatsApp ingestion script (`scripts/ingest-whatsapp.ts`, using `scripts/lib/whatsapp-parser.ts` and `scripts/lib/ingest-core.ts`) currently stores `authorName: m.author` as the raw parsed author string.

New behavior:

1. Parse the WhatsApp export as today (unchanged)
2. For each message, take `m.author` (the raw WhatsApp author string)
3. Try to extract a phone number from the author string (WhatsApp formats unknown contacts as `~+44 7700 900123` or similar with a tilde prefix — strip the `~` and parse)
4. Call `normalizePhone()` on the extracted number
5. **If normalization yields a valid E.164:**
   - Set `sender_phone = <E.164>`
   - Look up `members.display_name` by that phone
   - If found: `sender_display_name = members.display_name` (frozen snapshot)
   - If not found: `sender_display_name = null` (display layer will fall back to sanitized phone)
6. **If no phone was extractable (i.e., the author was a plain name string like `Sarah Jenkins`):**
   - Set `sender_phone = null`
   - Try a name match: look up a member by exact match (case-insensitive) in `members.display_name`. This handles the case where WhatsApp gave us a name because the exporter's address book happened to have them.
   - If that fails AND the row has a non-null `author_email`: look up by `members.email` (case-insensitive). This handles the edge case where the WhatsApp export included emails.
   - If found by either path: `sender_display_name = members.display_name` (the canonical version, even if casing differs from the raw string)
   - If not found: `sender_display_name = <raw author string>` (we keep whatever name WhatsApp gave us as the best-effort)

This preserves backward compatibility with the existing `author_name` / `author_email` columns (they keep whatever they had) while adding `sender_phone` + `sender_display_name` for the new resolution path.

## Display-time resolution

The chat-answer endpoint (or wherever the sources are assembled for the response) must join against `cpo_connect.members` to get the **live** display name, falling back to `sender_display_name` then `sanitizePhone(sender_phone)`.

**SQL sketch** (adapt to actual query structure):

```sql
SELECT
  cm.id,
  cm.channel,
  cm.message_text,
  cm.sent_at,
  cm.sender_phone,
  COALESCE(mem.display_name, cm.sender_display_name, cm.author_name) AS resolved_author
FROM cpo_connect.chat_messages cm
LEFT JOIN cpo_connect.members mem ON mem.phone = cm.sender_phone
WHERE /* the actual filter */
```

Then in TypeScript at the response layer:

```ts
function pickDisplayAuthor(row: ChatMessageRow): string {
  if (row.resolved_author && !looksLikeRawPhone(row.resolved_author)) {
    return row.resolved_author
  }
  if (row.sender_phone) {
    return sanitizePhone(row.sender_phone)
  }
  // Last-resort: the legacy author_name fell through and doesn't look like a phone,
  // but if it does look like one (e.g., '~+44 7700 900123'), sanitize the embedded number.
  return sanitizeRawAuthorString(row.resolved_author ?? '')
}
```

Sanitization via `sanitizePhone()` happens at the application layer, not in SQL, because it's a string-format utility and belongs in the same place as `normalizePhone()`. The `looksLikeRawPhone()` helper is a simple regex check — if the coalesced author still looks like a raw phone number, sanitize it; otherwise trust it.

## Backfill migration

A one-time Node script runs in the same PR as this spec, processing every existing row in `cpo_connect.chat_messages`:

1. For each row, apply the same phone extraction + normalization logic as the ingest pipeline
2. Populate `sender_phone` and `sender_display_name` from the resolved member (if found)
3. If no resolution, leave both columns NULL and let the legacy `author_name` column serve as the fallback

**Where it runs:**
- **One-time Node script** at `scripts/backfill-member-identity.ts`. Not a SQL migration, because the backfill logic needs to call `normalizePhone()` (TypeScript / `libphonenumber-js`), which doesn't cleanly run inside a `.sql` file.
- The schema changes (new columns on `chat_messages`) ship as the SQL migration `011-member-identity-resolution.sql`.
- The backfill script is invoked manually once after deploy: `npx tsx scripts/backfill-member-identity.ts`. Commit the script and document the invocation command in the PR description and in the script's header comment.
- After the backfill runs cleanly on production, no further runs are needed — new ingests write the resolved columns directly.

**Idempotency:** the backfill must be safe to run multiple times. Use `WHERE sender_phone IS NULL` as the target filter and handle the case where a message already has a resolved phone.

**Performance:** with the current message volume (low thousands from ingested WhatsApp exports), the backfill should complete in under 30 seconds. No chunking required. If the volume grows to millions, revisit.

## Edge cases

| Case | Behavior |
|---|---|
| Raw author is a plain name the directory knows | `sender_phone = null`, `sender_display_name = canonical directory name (casing normalized)` |
| Raw author is a phone number the directory knows | `sender_phone = E.164`, `sender_display_name = directory name at ingest time` (frozen); live lookup against `members` takes precedence at display time |
| Raw author is a phone number the directory does NOT know | `sender_phone = E.164`, `sender_display_name = null`; display falls back to `sanitizePhone(sender_phone)` |
| Raw author is a plain name the directory does NOT know | `sender_phone = null`, `sender_display_name = raw author string`; display shows the raw string as-is (pre-existing behavior) |
| Member leaves the community between message and query | `members` row is gone, but `messages.sender_display_name` is frozen. UI still shows their historical name. ✅ matches Erik's requirement. |
| Member changes their display name in the directory | `members.display_name` updates. UI shows the new name everywhere, including in historical messages. ✅ Live lookup wins. |
| Member changes their phone number | New number must be reflected in the directory sheet. Historical messages (which were ingested against the old number) continue to resolve via the frozen snapshot. New messages use the new number. |
| Phone number format mismatch between sheet and WhatsApp | Both go through `normalizePhone()` → same E.164 → they match. No format mismatches downstream. |
| Non-member participates in the chat (shouldn't happen but the spec handles it) | No directory match in either step. Falls back to `sender_display_name = raw string` (if name) or `sanitizePhone(sender_phone)` (if phone). UI never shows raw numbers. |
| Member is in directory but their phone column is blank | Row is skipped during sync with a warning log. Their messages will fall back to frozen snapshot (if populated) or raw author string (if name) or sanitized phone (if we can extract one). This is acceptable — the member gets flagged to the CPO Connect admin to fix their directory row. |

## Acceptance criteria

1. `cpo_connect.members` table exists with a normalized E.164 primary key
2. `syncMembersFromSheet()` populates the table from **Sheet1** (filtered to `Status = "Joined"`, reading col C Full Name / col D Email / col E Phone Number) — with edge-case logging for rows that can't be normalized
3. Sync runs on server startup and via an admin-triggered endpoint
4. `cpo_connect.chat_messages` has new columns `sender_phone` and `sender_display_name` (via migration `011-member-identity-resolution.sql`)
5. WhatsApp ingestion pipeline writes both columns for newly ingested messages
6. Backfill migration populates both columns for all existing messages (idempotently)
7. The search / chat-answer display path returns `display_author` via the resolution chain (live → frozen → sanitized → legacy)
8. `normalizePhone()` handles UK and international numbers correctly; has unit tests covering: null input, empty string, no country code, with country code, with spaces / dashes, obviously invalid input, extension numbers
9. `sanitizePhone()` has unit tests covering: E.164 UK, E.164 US, E.164 short countries (e.g. `+1` vs `+44`), output format verification
10. No raw phone number appears in any rendered UI (search source chips, contributor charts, directory, anywhere). This is testable by: run the backfill, query the messages table, confirm every `display_author` output either resolves to a directory name OR a sanitized phone.
11. When a member's name changes in the sheet, running `syncMembersFromSheet()` + refreshing the query returns the new name in historical messages (tested manually with a sheet edit before shipping)
12. All tests pass, `npx tsc --noEmit` clean

## Out of scope (explicit)

- A UI for editing members (the Google Sheet IS the UI)
- Conflict resolution when two members share a phone number (shouldn't happen; if it does, the most recently synced row wins and we log a warning)
- Admin tooling to see which messages failed to resolve (add it later if it becomes needed)
- Deduplication of the `messages` table against the resolved identities (out of scope; if two members sent similar messages, they stay as two rows)
- Merging author identity across WhatsApp and other platforms (Slack, Discord, etc.)

## Dependencies

- Blocks / blocked by: **CPO Members Area Redesign** (companion spec). Both ship in the same PR. Either works independently, but the value of the redesigned source chips depends on identity resolution landing simultaneously.

## Open questions / risks

- **`libphonenumber-js` bundle size** — the library is ~150KB minified. That's server-side, so it doesn't affect frontend bundle size. Fine.
- **Google Sheet rate limiting** — `syncMembersFromSheet()` is a single API call to fetch all rows. Google Sheets API has a 300 req/min quota per project. At one sync per restart or admin click, we're nowhere near the limit.
- **Startup latency** — the sync adds a Google Sheets API round-trip to server startup (~500ms-2s depending on Google API responsiveness). Acceptable for a members-only app with a single Render instance. If startup time becomes a concern, defer the sync to the first ingest run or the first admin page load.
- **Historical data quality** — the backfill can only resolve phone numbers that are currently in the directory. Messages from former members who have been removed from the directory will fall back to whatever the raw author string was (name or sanitized phone). This is acceptable — the measure-twice choice is to NOT try to reconstruct historical member data, only to display consistent canonical names for current members.
