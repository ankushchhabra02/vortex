import { supabaseAdmin } from './supabase/server';
import { generateEmbedding } from './embeddings';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

interface Document {
  pageContent: string;
  metadata?: Record<string, any>;
}

/**
 * RAG Service using Supabase pgvector
 * Completely FREE - no API costs
 */
export class RAGService {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  /**
   * Add documents to a knowledge base with embeddings
   * @param userId - User ID who owns the knowledge base
   * @param knowledgeBaseId - Knowledge base ID
   * @param documents - Documents to add
   * @param metadata - Optional metadata (source URL, file path, etc.)
   */
  async addDocuments(
    userId: string,
    knowledgeBaseId: string,
    documents: Document[],
    metadata: {
      title: string;
      sourceUrl?: string;
      filePath?: string;
      fileType?: string;
    }
  ): Promise<string> {
    try {
      // 1. Create document record
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

      // 2. Split documents into chunks
      const allChunks: string[] = [];
      for (const document of documents) {
        const chunks = await this.textSplitter.splitText(document.pageContent);
        allChunks.push(...chunks);
      }

      // 3. Generate embeddings for all chunks (FREE using Transformers.js)
      console.log(`Generating embeddings for ${allChunks.length} chunks...`);
      const embeddings = await Promise.all(
        allChunks.map((chunk) => generateEmbedding(chunk))
      );

      // 4. Insert chunks with embeddings into database
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

      console.log(`Successfully added ${allChunks.length} chunks to database`);
      return doc.id;
    } catch (error) {
      console.error('Error in addDocuments:', error);
      throw error;
    }
  }

  /**
   * Search for relevant document chunks using vector similarity
   * @param query - User's query text
   * @param knowledgeBaseId - Optional: limit search to specific knowledge base
   * @param matchThreshold - Minimum similarity score (0-1)
   * @param matchCount - Number of results to return
   * @returns Relevant document chunks with similarity scores
   */
  async similaritySearch(
    query: string,
    knowledgeBaseId?: string,
    matchThreshold: number = 0.5,
    matchCount: number = 5
  ): Promise<
    Array<{
      id: string;
      document_id: string;
      chunk_text: string;
      similarity: number;
    }>
  > {
    try {
      // 1. Generate embedding for the query (FREE)
      const queryEmbedding = await generateEmbedding(query);

      // 2. Call Supabase function for vector similarity search
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

      return data || [];
    } catch (error) {
      console.error('Error in similaritySearch:', error);
      throw error;
    }
  }

  /**
   * Get context for RAG by combining relevant chunks
   * @param query - User's query
   * @param knowledgeBaseId - Optional: limit to specific KB
   * @param maxChunks - Maximum number of chunks to include
   * @returns Combined context string
   */
  async getContext(
    query: string,
    knowledgeBaseId?: string,
    maxChunks: number = 5
  ): Promise<string> {
    const results = await this.similaritySearch(
      query,
      knowledgeBaseId,
      0.5,
      maxChunks
    );

    if (results.length === 0) {
      return '';
    }

    // Combine chunks with separators
    const context = results
      .map((result, index) => {
        return `[Source ${index + 1}] (Similarity: ${result.similarity.toFixed(2)})\n${result.chunk_text}`;
      })
      .join('\n\n---\n\n');

    return context;
  }

  /**
   * Create a new knowledge base for a user
   * @param userId - User ID
   * @param name - Knowledge base name
   * @param description - Optional description
   * @returns Knowledge base ID
   */
  async createKnowledgeBase(
    userId: string,
    name: string,
    description?: string
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_bases')
      .insert({
        user_id: userId,
        name,
        description,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating knowledge base:', error);
      throw new Error('Failed to create knowledge base');
    }

    return data.id;
  }

  /**
   * Get all knowledge bases for a user
   * @param userId - User ID
   * @returns Array of knowledge bases
   */
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

  /**
   * Get all documents in a knowledge base
   * @param knowledgeBaseId - Knowledge base ID
   * @returns Array of documents
   */
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

  /**
   * Delete a document and all its chunks
   * @param documentId - Document ID to delete
   */
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

// Export singleton instance
export const ragService = new RAGService();
