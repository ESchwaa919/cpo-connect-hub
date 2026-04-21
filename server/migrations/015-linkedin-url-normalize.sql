-- Backfill: prepend https:// to any member_profiles.linkedin_url values
-- that were stored without a protocol (e.g. "www.linkedin.com/in/Handle").
-- These un-protocoled values render as relative hrefs → the browser
-- resolves them against /members/, producing a 404 on the directory card.
--
-- Gated on the presence of "linkedin.com" in the value so we never
-- accidentally prepend https:// to bare handles or non-URL noise.
--
-- Idempotent: the `!~* '^https?://'` guard skips any row that already
-- has a protocol, so re-runs are no-ops.
UPDATE cpo_connect.member_profiles
SET linkedin_url = 'https://' || linkedin_url,
    updated_at = NOW()
WHERE linkedin_url IS NOT NULL
  AND linkedin_url <> ''
  AND linkedin_url !~* '^https?://'
  AND linkedin_url ~* 'linkedin\.com';
