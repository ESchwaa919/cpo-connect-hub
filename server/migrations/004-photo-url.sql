ALTER TABLE cpo_connect.member_profiles
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
