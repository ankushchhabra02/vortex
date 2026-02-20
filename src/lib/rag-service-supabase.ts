import { supabaseAdmin } from './supabase/server';
import { generateEmbedding } from './embeddings';
import { generateEmbeddingWithConfig } from './providers/embedding-factory';
import type { EmbeddingConfig } from './providers/types';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

interface Document {
  pageContent: string;
  metadata?: Record<string, unknown>;
}

interface HybridResult {
  id: string;
  document_id: string;
  chunk_text: string;
  similarity: number;
  keyword_rank: number;
  combined_score: number;
}

export class RAGService {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 300,
      separators: ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
    });
  }

  async addDocuments(
    userId: string,
    knowledgeBaseId: string,
    documents: Document[],
    metadata: {
      title: string;
      sourceUrl?: string;
      filePath?: string;
      fileType?: string;
    },
    embeddingConfig?: EmbeddingConfig
  ): Promise<string> {
    try {
      const { data: doc, error: docError } = await supabaseAdmin
        .from('documents')
        .insert({
          knowledge_base_id: knowledgeBaseId,
          title: metadata.title,
          content: documents.map((d) => d.pageContent).join('\n\n'),
          source_url: metadata.sourceUrl,
          file_path: metadata.filePath,
          file_type: metadata.fileType,
        })
        .select()
        .single();

      if (docError || !doc) {
        console.error('Error creating document:', docError);
        throw new Error('Failed to create document');
      }

      const allChunks: string[] = [];
      for (const document of documents) {
        const chunks = await this.textSplitter.splitText(document.pageContent);
        allChunks.push(...chunks);
      }

      const embeddings = await Promise.all(
        allChunks.map((chunk) =>
          embeddingConfig
            ? generateEmbeddingWithConfig(chunk, embeddingConfig)
            : generateEmbedding(chunk)
        )
      );

      const chunkRecords = allChunks.map((chunk, index) => ({
        document_id: doc.id,
        chunk_text: chunk,
        chunk_index: index,
        embedding: embeddings[index],
      }));

      try {
        const { error: chunksError } = await supabaseAdmin
          .from('document_chunks')
          .insert(chunkRecords);

        if (chunksError) {
          console.error('Error inserting chunks:', chunksError);
          // Rollback: delete the orphaned document
          await supabaseAdmin.from('documents').delete().eq('id', doc.id);
          throw new Error('Failed to insert document chunks');
        }
      } catch (error) {
        // Rollback: delete the orphaned document if not already deleted
        await supabaseAdmin.from('documents').delete().eq('id', doc.id);
        throw error;
      }

      return doc.id;
    } catch (error) {
      console.error('Error in addDocuments:', error);
      throw error;
    }
  }

  async similaritySearch(
    query: string,
    knowledgeBaseId?: string,
    matchThreshold: number = 0.2,
    matchCount: number = 5,
    embeddingConfig?: EmbeddingConfig
  ): Promise<
    Array<{
      id: string;
      document_id: string;
      chunk_text: string;
      similarity: number;
    }>
  > {
    try {
      const queryEmbedding = embeddingConfig
        ? await generateEmbeddingWithConfig(query, embeddingConfig)
        : await generateEmbedding(query);

      const { data, error } = await supabaseAdmin.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        kb_id: knowledgeBaseId || null,
      });

      if (error) {
        console.error('Error in similarity search:', error);
        throw new Error('Failed to perform similarity search');
      }

      console.log(`[RAG] Similarity search found ${data?.length || 0} matches`);
      if (data && data.length > 0) {
        console.log(`[RAG] Best match similarity: ${data[0].similarity.toFixed(4)}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in similaritySearch:', error);
      throw error;
    }
  }

  async hybridSearch(
    query: string,
    knowledgeBaseId?: string,
    matchCount: number = 10,
    embeddingConfig?: EmbeddingConfig
  ): Promise<HybridResult[]> {
    try {
      const queryEmbedding = embeddingConfig
        ? await generateEmbeddingWithConfig(query, embeddingConfig)
        : await generateEmbedding(query);

      const { data, error } = await supabaseAdmin.rpc('hybrid_search_chunks', {
        query_text: query,
        query_embedding: queryEmbedding,
        kb_id: knowledgeBaseId || null,
        match_count: matchCount,
      });

      if (error) {
        console.error('Error in hybrid search:', error);
        // Fallback to vector-only search
        const fallback = await this.similaritySearch(query, knowledgeBaseId, 0.15, matchCount, embeddingConfig);
        return fallback.map((r): HybridResult => ({ ...r, keyword_rank: 0, combined_score: r.similarity }));
      }

      console.log(`[RAG] Hybrid search found ${data?.length || 0} results`);
      if (!data || data.length === 0) {
        console.warn(`[RAG] WARNING: Hybrid search returned 0 results for KB=${knowledgeBaseId}, query="${query.substring(0, 100)}"`);
      }
      return data || [];
    } catch (error) {
      console.error('Error in hybridSearch:', error);
      // Fallback to vector-only search
      const fallback = await this.similaritySearch(query, knowledgeBaseId, 0.15, matchCount, embeddingConfig);
      return fallback.map((r): HybridResult => ({ ...r, keyword_rank: 0, combined_score: r.similarity }));
    }
  }

  private rerank(query: string, results: HybridResult[]): HybridResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const queryLower = query.toLowerCase();

    return results
      .map((result) => {
        const textLower = result.chunk_text.toLowerCase();
        let rerankScore = result.combined_score;

        // Exact phrase match bonus (strong signal)
        if (textLower.includes(queryLower)) {
          rerankScore += 0.3;
        }

        // Keyword density: proportion of query terms found
        if (queryTerms.length > 0) {
          const matchedTerms = queryTerms.filter(t => textLower.includes(t));
          const density = matchedTerms.length / queryTerms.length;
          rerankScore += density * 0.2;
        }

        // Position bonus: if match appears early in the chunk
        const firstMatchPos = queryTerms.reduce((minPos, term) => {
          const pos = textLower.indexOf(term);
          return pos >= 0 && pos < minPos ? pos : minPos;
        }, textLower.length);
        if (firstMatchPos < textLower.length) {
          rerankScore += (1 - firstMatchPos / textLower.length) * 0.1;
        }

        return { ...result, combined_score: rerankScore };
      })
      .sort((a, b) => b.combined_score - a.combined_score);
  }

  async getContextWithSources(
    query: string,
    knowledgeBaseId?: string,
    maxChunks: number = 5,
    embeddingConfig?: EmbeddingConfig,
  ): Promise<{ context: string; sources: Array<{ index: number; title: string; similarity: number }> }> {
    // Retrieve more candidates for re-ranking
    const results = await this.hybridSearch(query, knowledgeBaseId, maxChunks * 3, embeddingConfig);

    if (results.length === 0) {
      console.warn(`[RAG] WARNING: No context found for KB=${knowledgeBaseId}, query="${query.substring(0, 100)}"`);
      return { context: '', sources: [] };
    }

    // Re-rank and take top results
    const reranked = this.rerank(query, results);
    const topResults = reranked.slice(0, maxChunks);

    // Fetch document titles for all unique document_ids
    const docIds = [...new Set(topResults.map(r => r.document_id))];
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('id, title')
      .in('id', docIds);

    const docTitleMap = new Map((docs || []).map(d => [d.id, d.title]));

    const sources = topResults.map((result, index) => ({
      index: index + 1,
      title: docTitleMap.get(result.document_id) || 'Unknown',
      similarity: result.similarity,
    }));

    const context = topResults
      .map((result, index) => {
        const title = docTitleMap.get(result.document_id) || 'Unknown';
        return `[${index + 1}] ${result.chunk_text}\n(Source: "${title}", Similarity: ${result.similarity.toFixed(2)})`;
      })
      .join('\n\n---\n\n');

    return { context, sources };
  }

  async getContext(
    query: string,
    knowledgeBaseId?: string,
    maxChunks: number = 5,
    embeddingConfig?: EmbeddingConfig,
    matchThreshold: number = 0.2
  ): Promise<string> {
    const results = await this.similaritySearch(
      query,
      knowledgeBaseId,
      matchThreshold,
      maxChunks,
      embeddingConfig
    );

    if (results.length === 0) {
      return '';
    }

    const context = results
      .map((result, index) => {
        return `[Source ${index + 1}] (Similarity: ${result.similarity.toFixed(2)})\n${result.chunk_text}`;
      })
      .join('\n\n---\n\n');

    return context;
  }

  async createKnowledgeBase(
    userId: string,
    name: string,
    description?: string,
    embeddingProvider?: string,
    embeddingModel?: string,
    embeddingDimensions?: number
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_bases')
      .insert({
        user_id: userId,
        name,
        description,
        embedding_provider: embeddingProvider || 'xenova',
        embedding_model: embeddingModel || 'Xenova/all-MiniLM-L6-v2',
        embedding_dimensions: embeddingDimensions || 384,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating knowledge base:', error);
      throw new Error('Failed to create knowledge base');
    }

    return data.id;
  }

  async getKnowledgeBases(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('knowledge_bases')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge bases:', error);
      throw new Error('Failed to fetch knowledge bases');
    }

    return data || [];
  }

  async getDocuments(knowledgeBaseId: string) {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw new Error('Failed to fetch documents');
    }

    return data || [];
  }

  async deleteDocument(documentId: string) {
    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      console.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  }
}

export const ragService = new RAGService();
