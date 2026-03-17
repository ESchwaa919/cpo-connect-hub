ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
