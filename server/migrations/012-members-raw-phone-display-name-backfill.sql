-- Backfill: any existing cpo_connect.members rows whose display_name
-- still looks like a raw phone string (historical data from before
-- the syncMembersFromSheet guard was added) get reset to 'Unknown
-- member'. The pattern matches strings that are entirely phone-like
-- (optional +, digits / spaces / dashes / parens / dots) AND contain
-- at least 6 digits total — that threshold rules out cleaner names
-- like "Member 42" or "Bob (2)".
--
-- Idempotent: re-running this migration just updates the same rows
-- to the same placeholder value.
UPDATE cpo_connect.members
SET display_name = 'Unknown member',
    updated_at = NOW()
WHERE display_name ~ '^\+?[\d\s\-().]+$'
  AND display_name ~ '.*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*';
