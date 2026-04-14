-- Query + feedback capture for Search Chat launch readiness
-- (Cluster E). Single-tenant: no organization_id column. user_id
-- holds the asker's email — matches the identifier used in
-- cpo_connect.sessions.email and cpo_connect.member_profiles.email.

CREATE TABLE IF NOT EXISTS cpo_connect.chat_query_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  query_text    TEXT NOT NULL,
  answer_text   TEXT,
  source_count  INT NOT NULL DEFAULT 0,
  query_ms      INT,
  model         TEXT,
  channels      TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_query_log_created_at
  ON cpo_connect.chat_query_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_query_log_user_id
  ON cpo_connect.chat_query_log (user_id);

CREATE TABLE IF NOT EXISTS cpo_connect.chat_query_feedback (
  id             BIGSERIAL PRIMARY KEY,
  query_log_id   BIGINT NOT NULL REFERENCES cpo_connect.chat_query_log(id) ON DELETE CASCADE,
  rating         TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_query_feedback_log_id
  ON cpo_connect.chat_query_feedback (query_log_id);
