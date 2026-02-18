import { describe, it, expect, vi } from 'vitest';
import { generateEmbeddingWithConfig } from '../embedding-factory';
import type { EmbeddingConfig } from '../types';

// Mock the Xenova embedding module
vi.mock('@/lib/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
}));

// Mock global fetch for OpenAI embeddings
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('generateEmbeddingWithConfig', () => {
  it('routes to Xenova for xenova provider', async () => {
    const config: EmbeddingConfig = {
      provider: 'xenova',
      model: 'Xenova/all-MiniLM-L6-v2',
      dimensions: 384,
    };
    const result = await generateEmbeddingWithConfig('test text', config);
    expect(result).toHaveLength(384);
    expect(result[0]).toBe(0.1);
  });

  it('routes to OpenAI for openai provider', async () => {
    const mockEmbedding = new Array(1536).fill(0.05);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    });

    const config: EmbeddingConfig = {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      apiKey: 'sk-test-key',
    };
    const result = await generateEmbeddingWithConfig('test text', config);
    expect(result).toHaveLength(1536);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-test-key',
        }),
      })
    );
  });

  it('throws without API key for OpenAI', async () => {
    const config: EmbeddingConfig = {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
    };
    await expect(
      generateEmbeddingWithConfig('test', config)
    ).rejects.toThrow('OpenAI API key is required for OpenAI embeddings');
  });

  it('throws for unsupported provider', async () => {
    const config = {
      provider: 'unsupported' as any,
      model: 'some-model',
      dimensions: 768,
    };
    await expect(
      generateEmbeddingWithConfig('test', config)
    ).rejects.toThrow('Unsupported embedding provider: unsupported');
  });
});
