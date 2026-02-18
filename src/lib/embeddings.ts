import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

let embedder: unknown = null;

/**
 * Get or initialize the embedding model
 * Uses Xenova/all-MiniLM-L6-v2 (FREE, no API key needed)
 * Generates 384-dimensional embeddings
 */
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

/**
 * Generate embeddings for text using free Transformers.js model
 * @param text - Text to generate embeddings for
 * @returns 384-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = await getEmbedder() as (text: string, options: Record<string, unknown>) => Promise<{ data: number[] }>;
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert tensor to array
    const embedding = Array.from(output.data) as number[];
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of 384-dimensional embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings = await Promise.all(
    texts.map((text) => generateEmbedding(text))
  );
  return embeddings;
}

/**
 * Calculate cosine similarity between two embeddings
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
