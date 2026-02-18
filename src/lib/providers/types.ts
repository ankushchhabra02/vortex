export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'xai';
export type EmbeddingProvider = 'xenova' | 'openai';

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  temperature?: number;
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  apiKey?: string;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  free?: boolean;
}

export interface LLMProviderInfo {
  name: string;
  baseUrl?: string;
  requiresKey: boolean;
  models: LLMModelInfo[];
}

export interface EmbeddingModelInfo {
  id: string;
  name: string;
  dimensions: number;
  free?: boolean;
}

export interface EmbeddingProviderInfo {
  name: string;
  requiresKey: boolean;
  models: EmbeddingModelInfo[];
}

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderInfo> = {
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: false, // free models work without key, paid need key
    models: [
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', free: true },
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)', free: true },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', free: true },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', free: true },
      { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen 2.5 7B (Free)', free: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
    ],
  },
  openai: {
    name: 'OpenAI',
    requiresKey: true,
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385 },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    requiresKey: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
    ],
  },
  xai: {
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    requiresKey: true,
    models: [
      { id: 'grok-2-latest', name: 'Grok 2' },
      { id: 'grok-2-mini', name: 'Grok 2 Mini' },
    ],
  },
};

export const EMBEDDING_PROVIDERS: Record<EmbeddingProvider, EmbeddingProviderInfo> = {
  xenova: {
    name: 'Xenova (Local, Free)',
    requiresKey: false,
    models: [
      { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', dimensions: 384, free: true },
    ],
  },
  openai: {
    name: 'OpenAI',
    requiresKey: true,
    models: [
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small', dimensions: 1536 },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large', dimensions: 3072 },
    ],
  },
};

export function getEmbeddingDimensions(provider: EmbeddingProvider, model: string): number {
  const providerInfo = EMBEDDING_PROVIDERS[provider];
  const modelInfo = providerInfo?.models.find(m => m.id === model);
  return modelInfo?.dimensions ?? 384;
}
