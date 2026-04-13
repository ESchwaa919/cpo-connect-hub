-- Member identity resolution (spec 2026-04-13-cpo-member-identity-resolution.md).
-- Adds a canonical members table synced from Sheet1 + frozen-snapshot
-- columns on chat_messages so display names stay consistent across
-- historical data even when members leave or change identity.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS cpo_connect.members (
  phone         TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_email
  ON cpo_connect.members (LOWER(email))
  WHERE email IS NOT NULL;

-- Ingest-time frozen snapshot + live-lookup join columns on chat_messages.
ALTER TABLE cpo_connect.chat_messages
  ADD COLUMN IF NOT EXISTS sender_phone TEXT;

ALTER TABLE cpo_connect.chat_messages
  ADD COLUMN IF NOT EXISTS sender_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_phone
  ON cpo_connect.chat_messages (sender_phone)
  WHERE sender_phone IS NOT NULL;
