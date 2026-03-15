ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT DEFAULT '';
