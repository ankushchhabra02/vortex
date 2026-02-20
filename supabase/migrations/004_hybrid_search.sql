-- Add tsvector column for full-text search
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts ON document_chunks USING GIN (fts);

-- Hybrid search function using Reciprocal Rank Fusion (RRF)
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
    query_text TEXT,
    query_embedding vector,
    kb_id UUID DEFAULT NULL,
    match_count INT DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.7,
    keyword_weight FLOAT DEFAULT 0.3,
    rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_text TEXT,
    similarity FLOAT,
    keyword_rank FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            dc.id,
            dc.document_id,
            dc.chunk_text,
            1 - (dc.embedding <=> query_embedding) AS similarity,
            ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS rank_ix
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE (kb_id IS NULL OR d.knowledge_base_id = kb_id)
          AND d.deleted_at IS NULL
        ORDER BY dc.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    keyword_results AS (
        SELECT
            dc.id,
            dc.document_id,
            dc.chunk_text,
            ts_rank_cd(dc.fts, websearch_to_tsquery('english', query_text)) AS keyword_score,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE (kb_id IS NULL OR d.knowledge_base_id = kb_id)
            AND d.deleted_at IS NULL
            AND dc.fts @@ websearch_to_tsquery('english', query_text)
        ORDER BY keyword_score DESC
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT
            COALESCE(v.id, k.id) AS id,
            COALESCE(v.document_id, k.document_id) AS document_id,
            COALESCE(v.chunk_text, k.chunk_text) AS chunk_text,
            COALESCE(v.similarity, 0) AS similarity,
            COALESCE(k.keyword_score, 0) AS keyword_rank,
            (
                vector_weight * COALESCE(1.0 / (rrf_k + v.rank_ix), 0) +
                keyword_weight * COALESCE(1.0 / (rrf_k + k.rank_ix), 0)
            ) AS combined_score
        FROM vector_results v
        FULL OUTER JOIN keyword_results k ON v.id = k.id
    )
    SELECT
        combined.id,
        combined.document_id,
        combined.chunk_text,
        combined.similarity,
        combined.keyword_rank,
        combined.combined_score
    FROM combined
    ORDER BY combined.combined_score DESC
    LIMIT match_count;
END;
$$;
