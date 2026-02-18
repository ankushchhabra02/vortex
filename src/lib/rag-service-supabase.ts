import { supabaseAdmin } from './supabase/server';
import { generateEmbedding } from './embeddings';
import { generateEmbeddingWithConfig } from './providers/embedding-factory';
import type { EmbeddingConfig } from './providers/types';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

interface Document {
  pageContent: string;
  metadata?: Record<string, unknown>;
}

export class RAGService {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
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

      const { error: chunksError } = await supabaseAdmin
        .from('document_chunks')
        .insert(chunkRecords);

      if (chunksError) {
        console.error('Error inserting chunks:', chunksError);
        throw new Error('Failed to insert document chunks');
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
    matchThreshold: number = 0.5,
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

  async getContext(
    query: string,
    knowledgeBaseId?: string,
    maxChunks: number = 5,
    embeddingConfig?: EmbeddingConfig,
    matchThreshold: number = 0.3
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
