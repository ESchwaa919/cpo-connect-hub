-- WETA — profile opt-out columns
-- Two independent toggles:
--   chat_identification_opted_out — hides member name on source cards
--   chat_query_logging_opted_out  — redacts member's raw question text in events
-- Both default to false (opted in).

ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS chat_identification_opted_out BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS chat_query_logging_opted_out BOOLEAN NOT NULL DEFAULT false;
