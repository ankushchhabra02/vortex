import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  createServerSupabaseClient: vi.fn(),
}));

// Mock embeddings
vi.mock('@/lib/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
}));

vi.mock('@/lib/providers/embedding-factory', () => ({
  generateEmbeddingWithConfig: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
}));

// Mock text splitter
vi.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: class {
    async splitText(text: string) {
      return text.length > 100
        ? [text.slice(0, 100), text.slice(100)]
        : [text];
    }
  },
}));

import { RAGService } from '../rag-service-supabase';

describe('RAGService', () => {
  let service: RAGService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RAGService();
  });

  describe('addDocuments', () => {
    it('creates document and inserts chunks', async () => {
      const mockDoc = { id: 'doc-123' };

      const selectSingle = { data: mockDoc, error: null };
      const selectChain = { single: () => selectSingle };
      const insertChainDoc = { select: () => selectChain };
      const insertChainChunks = { error: null };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'documents') {
          return { insert: () => insertChainDoc, delete: () => ({ eq: () => ({}) }) };
        }
        if (table === 'document_chunks') {
          return { insert: () => insertChainChunks };
        }
        return {};
      });

      const result = await service.addDocuments(
        'user-1',
        'kb-1',
        [{ pageContent: 'Test document content' }],
        { title: 'test.txt' }
      );

      expect(result).toBe('doc-123');
      expect(mockFrom).toHaveBeenCalledWith('documents');
      expect(mockFrom).toHaveBeenCalledWith('document_chunks');
    });

    it('rolls back document on chunk insertion failure', async () => {
      const mockDoc = { id: 'doc-456' };
      const selectSingle = { data: mockDoc, error: null };
      const selectChain = { single: () => selectSingle };
      const insertChainDoc = { select: () => selectChain };

      const deleteEq = vi.fn().mockReturnValue({});
      const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'documents') {
          return { insert: () => insertChainDoc, delete: deleteFn };
        }
        if (table === 'document_chunks') {
          return { insert: () => ({ error: { message: 'Insert failed' } }) };
        }
        return {};
      });

      await expect(
        service.addDocuments('user-1', 'kb-1', [{ pageContent: 'Test' }], { title: 'test.txt' })
      ).rejects.toThrow('Failed to insert document chunks');

      expect(deleteFn).toHaveBeenCalled();
    });

    it('throws when document creation fails', async () => {
      const selectSingle = { data: null, error: { message: 'Insert failed' } };
      const selectChain = { single: () => selectSingle };
      const insertChainDoc = { select: () => selectChain };

      mockFrom.mockReturnValue({ insert: () => insertChainDoc });

      await expect(
        service.addDocuments('user-1', 'kb-1', [{ pageContent: 'Test' }], { title: 'test.txt' })
      ).rejects.toThrow('Failed to create document');
    });
  });

  describe('similaritySearch', () => {
    it('returns matching chunks', async () => {
      const mockResults = [
        { id: 'chunk-1', document_id: 'doc-1', chunk_text: 'Hello world', similarity: 0.9 },
        { id: 'chunk-2', document_id: 'doc-1', chunk_text: 'Foo bar', similarity: 0.7 },
      ];

      mockRpc.mockResolvedValue({ data: mockResults, error: null });

      const results = await service.similaritySearch('hello', 'kb-1');
      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.9);
      expect(mockRpc).toHaveBeenCalledWith('match_document_chunks', expect.objectContaining({
        kb_id: 'kb-1',
      }));
    });

    it('throws on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(
        service.similaritySearch('test', 'kb-1')
      ).rejects.toThrow('Failed to perform similarity search');
    });

    it('returns empty array when no matches', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const results = await service.similaritySearch('test', 'kb-1');
      expect(results).toHaveLength(0);
    });
  });

  describe('getContext', () => {
    it('returns formatted context string', async () => {
      const mockResults = [
        { id: 'c1', document_id: 'd1', chunk_text: 'First chunk', similarity: 0.85 },
      ];
      mockRpc.mockResolvedValue({ data: mockResults, error: null });

      const context = await service.getContext('query', 'kb-1');
      expect(context).toContain('[Source 1]');
      expect(context).toContain('First chunk');
      expect(context).toContain('0.85');
    });

    it('returns empty string when no results', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      const context = await service.getContext('query', 'kb-1');
      expect(context).toBe('');
    });
  });

  describe('createKnowledgeBase', () => {
    it('creates and returns KB id', async () => {
      const mockKb = { id: 'kb-new' };
      const selectSingle = { data: mockKb, error: null };
      const selectChain = { single: () => selectSingle };
      const insertChain = { select: () => selectChain };

      mockFrom.mockReturnValue({ insert: () => insertChain });

      const id = await service.createKnowledgeBase('user-1', 'Test KB', 'A test');
      expect(id).toBe('kb-new');
    });

    it('throws on error', async () => {
      const selectSingle = { data: null, error: { message: 'Failed' } };
      const selectChain = { single: () => selectSingle };
      const insertChain = { select: () => selectChain };

      mockFrom.mockReturnValue({ insert: () => insertChain });

      await expect(
        service.createKnowledgeBase('user-1', 'Test KB')
      ).rejects.toThrow('Failed to create knowledge base');
    });
  });

  describe('getKnowledgeBases', () => {
    it('returns knowledge bases', async () => {
      const mockKbs = [{ id: 'kb-1', name: 'Test' }];
      const orderChain = { data: mockKbs, error: null };
      const isChain = { order: () => orderChain };
      const eqChain = { is: () => isChain };
      const selectChain = { eq: () => eqChain };

      mockFrom.mockReturnValue({ select: () => selectChain });

      const results = await service.getKnowledgeBases('user-1');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test');
    });

    it('throws on error', async () => {
      const orderChain = { data: null, error: { message: 'Failed' } };
      const isChain = { order: () => orderChain };
      const eqChain = { is: () => isChain };
      const selectChain = { eq: () => eqChain };

      mockFrom.mockReturnValue({ select: () => selectChain });

      await expect(
        service.getKnowledgeBases('user-1')
      ).rejects.toThrow('Failed to fetch knowledge bases');
    });
  });

  describe('getDocuments', () => {
    it('returns documents for a knowledge base', async () => {
      const mockDocs = [{ id: 'doc-1', title: 'test.pdf' }];
      const orderChain = { data: mockDocs, error: null };
      const isChain = { order: () => orderChain };
      const eqChain = { is: () => isChain };
      const selectChain = { eq: () => eqChain };

      mockFrom.mockReturnValue({ select: () => selectChain });

      const results = await service.getDocuments('kb-1');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('test.pdf');
    });
  });

  describe('deleteDocument', () => {
    it('deletes successfully', async () => {
      const eqChain = { error: null };
      const deleteChain = { eq: () => eqChain };

      mockFrom.mockReturnValue({ delete: () => deleteChain });

      await expect(service.deleteDocument('doc-1')).resolves.not.toThrow();
    });

    it('throws on error', async () => {
      const eqChain = { error: { message: 'Failed' } };
      const deleteChain = { eq: () => eqChain };

      mockFrom.mockReturnValue({ delete: () => deleteChain });

      await expect(service.deleteDocument('doc-1')).rejects.toThrow('Failed to delete document');
    });
  });

  describe('hybridSearch', () => {
    it('returns hybrid search results', async () => {
      const mockResults = [
        { id: 'c1', document_id: 'd1', chunk_text: 'Test', similarity: 0.8, keyword_rank: 0.5, combined_score: 0.7 },
      ];
      mockRpc.mockResolvedValue({ data: mockResults, error: null });

      const results = await service.hybridSearch('test query', 'kb-1');
      expect(results).toHaveLength(1);
      expect(results[0].combined_score).toBe(0.7);
      expect(mockRpc).toHaveBeenCalledWith('hybrid_search_chunks', expect.objectContaining({
        query_text: 'test query',
        kb_id: 'kb-1',
      }));
    });

    it('falls back to similarity search on RPC error', async () => {
      // First call: hybrid_search_chunks fails
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Function not found' } });
      // Second call: match_document_chunks succeeds (fallback)
      mockRpc.mockResolvedValueOnce({
        data: [{ id: 'c1', document_id: 'd1', chunk_text: 'Fallback', similarity: 0.6 }],
        error: null,
      });

      const results = await service.hybridSearch('test', 'kb-1');
      expect(results).toHaveLength(1);
      expect(results[0].keyword_rank).toBe(0);
      expect(results[0].combined_score).toBe(0.6);
    });

    it('uses 0.15 threshold in fallback similarity search', async () => {
      // hybrid_search_chunks fails
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Function not found' } });
      // match_document_chunks fallback
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await service.hybridSearch('test', 'kb-1');

      expect(mockRpc).toHaveBeenCalledWith('match_document_chunks', expect.objectContaining({
        match_threshold: 0.15,
      }));
    });
  });
});
