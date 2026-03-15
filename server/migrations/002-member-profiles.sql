CREATE TABLE IF NOT EXISTS cpo_connect.member_profiles (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  current_org TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  location TEXT DEFAULT '',
  focus_areas TEXT DEFAULT '',
  areas_of_interest TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  bio TEXT,
  profile_enriched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
