-- Fix match_document_chunks: add deleted_at filter, lower threshold default
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector,
  match_threshold float DEFAULT 0.2,
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
    AND d.deleted_at IS NULL
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fix hybrid_search_chunks:
--   1. plainto_tsquery instead of websearch_to_tsquery (safe with special chars)
--   2. LEFT JOIN instead of FULL OUTER JOIN (vector results always survive)
--   3. Wider candidate pool (match_count * 3)
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
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    keyword_results AS (
        SELECT
            dc.id,
            ts_rank_cd(dc.fts, plainto_tsquery('english', query_text)) AS keyword_score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(dc.fts, plainto_tsquery('english', query_text)) DESC
            ) AS rank_ix
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE (kb_id IS NULL OR d.knowledge_base_id = kb_id)
            AND d.deleted_at IS NULL
            AND dc.fts @@ plainto_tsquery('english', query_text)
        ORDER BY keyword_score DESC
        LIMIT match_count * 3
    ),
    combined AS (
        SELECT
            v.id,
            v.document_id,
            v.chunk_text,
            v.similarity,
            COALESCE(k.keyword_score, 0.0)::float AS keyword_rank,
            (
                vector_weight * (1.0 / (rrf_k + v.rank_ix)) +
                keyword_weight * COALESCE(1.0 / (rrf_k + k.rank_ix), 0.0)
            )::float AS combined_score
        FROM vector_results v
        LEFT JOIN keyword_results k ON v.id = k.id
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
