-- New 384-dim pgvector column for the local bge-small embedding.
-- Runs alongside the existing 768-dim `embedding` column (Gemini)
-- during the migration window. The askHandler reads from one or the
-- other based on USE_LOCAL_EMBEDDINGS env flag, so this column can
-- start empty and get backfilled out-of-band before the flip.
ALTER TABLE cpo_connect.chat_messages
  ADD COLUMN IF NOT EXISTS embedding_local vector(384);

-- HNSW index on the new column. Cosine ops to match askHandler's
-- <=> operator. Partial index with WHERE embedding_local IS NOT NULL
-- so the migration can ship before the backfill completes — rows
-- without the new embedding just stay out of the index until they
-- get a value.
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding_local
  ON cpo_connect.chat_messages USING hnsw (embedding_local vector_cosine_ops)
  WHERE embedding_local IS NOT NULL;
