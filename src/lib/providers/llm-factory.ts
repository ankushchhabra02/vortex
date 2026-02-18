import { ChatOpenAI } from '@langchain/openai';
import type { ProviderConfig } from './types';

export function createChatModel(config: ProviderConfig) {
  const { provider, apiKey, model, temperature = 0.7 } = config;

  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        apiKey,
        modelName: model,
        streaming: true,
        temperature,
      });

    case 'anthropic': {
      // Dynamic import to avoid requiring the package when not in use
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ChatAnthropic } = require('@langchain/anthropic');
      return new ChatAnthropic({
        apiKey,
        modelName: model,
        streaming: true,
        temperature,
      });
    }

    case 'openrouter':
      return new ChatOpenAI({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY || '',
        modelName: model,
        streaming: true,
        temperature,
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',
        },
      });

    case 'xai':
      return new ChatOpenAI({
        apiKey,
        modelName: model,
        streaming: true,
        temperature,
        configuration: {
          baseURL: 'https://api.x.ai/v1',
        },
      });

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
