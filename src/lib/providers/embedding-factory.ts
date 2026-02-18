import type { EmbeddingConfig } from './types';

// Lazy import for Xenova to avoid loading it when using API embeddings
let xenovaEmbed: ((text: string) => Promise<number[]>) | null = null;

async function getXenovaEmbed() {
  if (!xenovaEmbed) {
    const { generateEmbedding } = await import('@/lib/embeddings');
    xenovaEmbed = generateEmbedding;
  }
  return xenovaEmbed;
}

async function openaiEmbed(
  text: string,
  apiKey: string,
  model: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `OpenAI embedding error: ${error.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function generateEmbeddingWithConfig(
  text: string,
  config: EmbeddingConfig
): Promise<number[]> {
  switch (config.provider) {
    case 'xenova': {
      const embed = await getXenovaEmbed();
      return embed(text);
    }
    case 'openai': {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required for OpenAI embeddings');
      }
      return openaiEmbed(text, config.apiKey, config.model);
    }
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }
}

export async function generateEmbeddingsWithConfig(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  return Promise.all(
    texts.map((text) => generateEmbeddingWithConfig(text, config))
  );
}
