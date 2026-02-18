import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChatModel } from '../llm-factory';
import type { ProviderConfig } from '../types';

let openAICalls: Record<string, unknown>[] = [];
let anthropicCalls: Record<string, unknown>[] = [];

// Mock with classes since the factory uses `new`
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class MockChatOpenAI {
    _type = 'ChatOpenAI';
    apiKey = '';
    modelName = '';
    streaming = false;
    temperature = 0;
    configuration?: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      Object.assign(this, config);
      openAICalls.push(config);
    }
  },
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: class MockChatAnthropic {
    _type = 'ChatAnthropic';
    apiKey = '';
    modelName = '';
    streaming = false;
    temperature = 0;
    constructor(config: Record<string, unknown>) {
      Object.assign(this, config);
      anthropicCalls.push(config);
    }
  },
}));

describe('createChatModel', () => {
  beforeEach(() => {
    openAICalls = [];
    anthropicCalls = [];
  });

  it('creates OpenAI model correctly', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
      temperature: 0.5,
    };
    interface MockModel {
      _type: string;
      apiKey: string;
      modelName: string;
      temperature: number;
      streaming: boolean;
    }
    const model = createChatModel(config) as unknown as MockModel;
    expect(model._type).toBe('ChatOpenAI');
    expect(model.apiKey).toBe('sk-test-key');
    expect(model.modelName).toBe('gpt-4');
    expect(model.temperature).toBe(0.5);
    expect(model.streaming).toBe(true);
  });

  it('creates Anthropic model correctly', () => {
    const config: ProviderConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-3-opus',
      temperature: 0.3,
    };
    interface MockModel {
      apiKey: string;
      modelName: string;
      temperature: number;
      streaming: boolean;
    }
    const model = createChatModel(config) as unknown as MockModel;
    // The dynamic require() in llm-factory may not use vitest mock,
    // so verify by checking the returned model has the right config
    expect(model.apiKey).toBe('sk-ant-test');
    expect(model.modelName).toBe('claude-3-opus');
    expect(model.streaming).toBe(true);
    expect(model.temperature).toBe(0.3);
  });

  it('creates OpenRouter model with correct baseURL', () => {
    const config: ProviderConfig = {
      provider: 'openrouter',
      apiKey: 'or-key',
      model: 'meta-llama/llama-3.2-3b-instruct:free',
    };
    createChatModel(config);
    expect(openAICalls).toHaveLength(1);
    expect(openAICalls[0].configuration).toEqual({
      baseURL: 'https://openrouter.ai/api/v1',
    });
  });

  it('creates xAI model with correct baseURL', () => {
    const config: ProviderConfig = {
      provider: 'xai',
      apiKey: 'xai-key',
      model: 'grok-1',
    };
    createChatModel(config);
    expect(openAICalls).toHaveLength(1);
    expect(openAICalls[0].configuration).toEqual({
      baseURL: 'https://api.x.ai/v1',
    });
  });

  it('throws for unsupported provider', () => {
    const config = {
      provider: 'unknown-provider' as unknown as 'openai',
      apiKey: 'key',
      model: 'model',
    };
    expect(() => createChatModel(config)).toThrow('Unsupported LLM provider: unknown-provider');
  });

  it('defaults temperature to 0.7', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'key',
      model: 'gpt-4',
    };
    const model = createChatModel(config) as unknown as { temperature: number };
    expect(model.temperature).toBe(0.7);
  });
});
