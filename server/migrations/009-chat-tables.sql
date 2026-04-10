-- WETA — chat tables + evergreen tile seed
-- Idempotent: server/db.ts replays every .sql file on every boot.

-- pgvector is already enabled on the shared Postgres instance (v0.8.1).
-- This is a no-op if it's already installed, but declares the dependency.
CREATE EXTENSION IF NOT EXISTS vector;

-- chat_messages --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  source_export TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sent_at
  ON cpo_connect.chat_messages (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel
  ON cpo_connect.chat_messages (channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding
  ON cpo_connect.chat_messages USING hnsw (embedding vector_cosine_ops);

-- chat_conversations (Phase 1 schema, populated in Phase 2) ------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_conversations (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  message_count INT NOT NULL,
  summary TEXT,
  topics TEXT[],
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_start
  ON cpo_connect.chat_conversations (start_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_embedding
  ON cpo_connect.chat_conversations USING hnsw (embedding vector_cosine_ops);

-- chat_ingestion_runs --------------------------------------------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  run_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_completed_at TIMESTAMPTZ,
  triggered_by_email TEXT,
  source_months TEXT[],
  messages_ingested INT DEFAULT 0,
  messages_skipped INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_ingestion_runs_started
  ON cpo_connect.chat_ingestion_runs (run_started_at DESC);

-- chat_prompt_tiles ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS cpo_connect.chat_prompt_tiles (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  channel TEXT,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed evergreen tiles (idempotent: skip if the specific title already exists).
INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'AI tooling debates', 'What have people said about AI coding tools?', 1
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'AI tooling debates');

INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'Hiring & the CV crisis', 'What are people saying about the hiring market?', 2
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'Hiring & the CV crisis');

INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'Burnout & sustainable work', 'What have members shared about burnout and sustainable pace?', 3
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'Burnout & sustainable work');

INSERT INTO cpo_connect.chat_prompt_tiles (scope, channel, title, query, sort_order)
SELECT 'evergreen', NULL, 'PM tool recommendations', 'What product management tools do members recommend?', 4
WHERE NOT EXISTS (SELECT 1 FROM cpo_connect.chat_prompt_tiles WHERE scope = 'evergreen' AND title = 'PM tool recommendations');
