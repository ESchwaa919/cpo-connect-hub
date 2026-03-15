CREATE SCHEMA IF NOT EXISTS cpo_connect;

CREATE TABLE IF NOT EXISTS cpo_connect.magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpo_connect.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON cpo_connect.magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_email ON cpo_connect.magic_link_tokens(email);
CREATE INDEX IF NOT EXISTS idx_sessions_id ON cpo_connect.sessions(id);
