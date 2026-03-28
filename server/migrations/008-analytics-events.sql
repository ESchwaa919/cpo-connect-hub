CREATE TABLE IF NOT EXISTS cpo_connect.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_event ON cpo_connect.events (event);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON cpo_connect.events (created_at);
CREATE INDEX IF NOT EXISTS idx_events_email ON cpo_connect.events (email);
