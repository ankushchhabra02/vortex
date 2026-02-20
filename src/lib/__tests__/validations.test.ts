import { describe, it, expect } from 'vitest';
import {
  validateBody,
  chatSchema,
  conversationCreateSchema,
  kbCreateSchema,
  settingsUpdateSchema,
  providerSaveSchema,
  providerDeleteSchema,
  messageCreateSchema,
  conversationUpdateSchema,
  providerVerifySchema,
} from '../validations';

describe('validateBody', () => {
  it('returns success with valid data', () => {
    const result = validateBody(kbCreateSchema, { name: 'Test KB' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Test KB');
  });

  it('returns error with invalid data', () => {
    const result = validateBody(kbCreateSchema, { name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it('returns path in error message', () => {
    const result = validateBody(chatSchema, { messages: [{ role: 'bad', content: 'Hi' }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('messages');
  });
});

describe('chatSchema', () => {
  it('validates correct chat input', () => {
    const result = chatSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty messages array', () => {
    const result = chatSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = chatSchema.safeParse({
      messages: [{ role: 'admin', content: 'Hello' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects overly long content', () => {
    const result = chatSchema.safeParse({
      messages: [{ role: 'user', content: 'x'.repeat(10001) }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional knowledgeBaseId as uuid', () => {
    const result = chatSchema.safeParse({
      messages: [{ role: 'user', content: 'Hi' }],
      knowledgeBaseId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid uuid for knowledgeBaseId', () => {
    const result = chatSchema.safeParse({
      messages: [{ role: 'user', content: 'Hi' }],
      knowledgeBaseId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional conversationId as uuid', () => {
    const result = chatSchema.safeParse({
      messages: [{ role: 'user', content: 'Hi' }],
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid roles', () => {
    for (const role of ['user', 'assistant', 'system']) {
      const result = chatSchema.safeParse({
        messages: [{ role, content: 'Hi' }],
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('conversationCreateSchema', () => {
  it('validates with knowledgeBaseId', () => {
    const result = conversationCreateSchema.safeParse({
      knowledgeBaseId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional title', () => {
    const result = conversationCreateSchema.safeParse({
      knowledgeBaseId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'My Chat',
    });
    expect(result.success).toBe(true);
  });

  it('rejects title over 100 chars', () => {
    const result = conversationCreateSchema.safeParse({
      knowledgeBaseId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing knowledgeBaseId', () => {
    const result = conversationCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('conversationUpdateSchema', () => {
  it('validates with title', () => {
    expect(conversationUpdateSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(conversationUpdateSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('kbCreateSchema', () => {
  it('validates with name only', () => {
    const result = kbCreateSchema.safeParse({ name: 'My KB' });
    expect(result.success).toBe(true);
  });

  it('trims the name', () => {
    const result = kbCreateSchema.safeParse({ name: '  My KB  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('My KB');
  });

  it('rejects empty name', () => {
    const result = kbCreateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = kbCreateSchema.safeParse({ name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('accepts optional description', () => {
    const result = kbCreateSchema.safeParse({ name: 'KB', description: 'A test' });
    expect(result.success).toBe(true);
  });

  it('rejects description over 500 chars', () => {
    const result = kbCreateSchema.safeParse({ name: 'KB', description: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts optional embedding fields', () => {
    const result = kbCreateSchema.safeParse({
      name: 'KB',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-small',
    });
    expect(result.success).toBe(true);
  });
});

describe('settingsUpdateSchema', () => {
  it('validates with valid provider', () => {
    const result = settingsUpdateSchema.safeParse({ llm_provider: 'openai' });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = settingsUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid provider', () => {
    const result = settingsUpdateSchema.safeParse({ llm_provider: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('validates temperature range', () => {
    expect(settingsUpdateSchema.safeParse({ temperature: 0 }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ temperature: 2 }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ temperature: -1 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ temperature: 3 }).success).toBe(false);
  });

  it('accepts all valid LLM providers', () => {
    for (const p of ['openai', 'anthropic', 'openrouter', 'xai', 'google']) {
      expect(settingsUpdateSchema.safeParse({ llm_provider: p }).success).toBe(true);
    }
  });

  it('accepts all valid embedding providers', () => {
    for (const p of ['xenova', 'openai', 'google', 'openrouter']) {
      expect(settingsUpdateSchema.safeParse({ embedding_provider: p }).success).toBe(true);
    }
  });
});

describe('providerSaveSchema', () => {
  it('validates correct input', () => {
    const result = providerSaveSchema.safeParse({ provider: 'openai', api_key: 'sk-test' });
    expect(result.success).toBe(true);
  });

  it('rejects empty api_key', () => {
    const result = providerSaveSchema.safeParse({ provider: 'openai', api_key: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid provider', () => {
    const result = providerSaveSchema.safeParse({ provider: 'invalid', api_key: 'key' });
    expect(result.success).toBe(false);
  });

  it('rejects api_key over 500 chars', () => {
    const result = providerSaveSchema.safeParse({ provider: 'openai', api_key: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('providerDeleteSchema', () => {
  it('validates correct provider', () => {
    expect(providerDeleteSchema.safeParse({ provider: 'anthropic' }).success).toBe(true);
  });

  it('rejects invalid provider', () => {
    expect(providerDeleteSchema.safeParse({ provider: 'bad' }).success).toBe(false);
  });
});

describe('providerVerifySchema', () => {
  it('validates correct provider', () => {
    expect(providerVerifySchema.safeParse({ provider: 'google' }).success).toBe(true);
  });

  it('rejects invalid provider', () => {
    expect(providerVerifySchema.safeParse({ provider: 'fake' }).success).toBe(false);
  });
});

describe('messageCreateSchema', () => {
  it('validates correct message', () => {
    const result = messageCreateSchema.safeParse({ role: 'user', content: 'Hello' });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = messageCreateSchema.safeParse({ role: 'user', content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content over 50000 chars', () => {
    const result = messageCreateSchema.safeParse({ role: 'user', content: 'x'.repeat(50001) });
    expect(result.success).toBe(false);
  });
});
