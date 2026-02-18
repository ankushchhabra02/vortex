-- Migration: Multi-provider support
-- WARNING: This migration drops and recreates the embedding column on document_chunks.
-- All existing embeddings will be lost. Re-ingest documents after running this migration.

-- 1. User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  llm_provider TEXT DEFAULT 'openrouter',
  llm_model TEXT DEFAULT 'openrouter/auto',
  embedding_provider TEXT DEFAULT 'xenova',
  embedding_model TEXT DEFAULT 'Xenova/all-MiniLM-L6-v2',
  temperature FLOAT DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User providers table (API keys, encrypted)
CREATE TABLE IF NOT EXISTS user_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- 3. Add embedding tracking to knowledge_bases
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS embedding_provider TEXT DEFAULT 'xenova',
  ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'Xenova/all-MiniLM-L6-v2',
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER DEFAULT 384;

-- 4. Make embedding column flexible (remove 384-dim constraint)
-- Drop the old IVFFlat index first
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Drop and recreate embedding column without fixed dimensions
ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
-- ALTER TABLE document_chunks ADD COLUMN embedding vector;
ALTER TABLE document_chunks ADD COLUMN embedding vector(384);
-- Recreate index (without fixed dimension — uses HNSW which supports variable dimensions)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Update match function to accept variable-dimension vectors
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  kb_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE
    (kb_id IS NULL OR d.knowledge_base_id = kb_id)
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. RLS policies for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 7. RLS policies for user_providers
ALTER TABLE user_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own providers"
  ON user_providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own providers"
  ON user_providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own providers"
  ON user_providers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own providers"
  ON user_providers FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Auto-update timestamps
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_providers_updated_at
  BEFORE UPDATE ON user_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_providers_user_id ON user_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_providers_user_provider ON user_providers(user_id, provider);
