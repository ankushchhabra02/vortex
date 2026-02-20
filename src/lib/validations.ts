import { z } from 'zod';

// Shared
const uuidSchema = z.string().uuid();

// Chat API
export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(10000),
      })
    )
    .min(1)
    .max(100),
  knowledgeBaseId: uuidSchema.optional(),
  conversationId: uuidSchema.optional(),
});

// Conversations
export const conversationCreateSchema = z.object({
  knowledgeBaseId: uuidSchema,
  title: z.string().max(100).optional(),
});

export const conversationUpdateSchema = z.object({
  title: z.string().min(1).max(100),
});

// Messages
export const messageCreateSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(50000),
});

// Knowledge Bases
export const kbCreateSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
  description: z.string().max(500).optional(),
  embeddingProvider: z.string().optional(),
  embeddingModel: z.string().optional(),
});

// Settings
export const settingsUpdateSchema = z
  .object({
    llm_provider: z
      .enum(['openai', 'anthropic', 'openrouter', 'xai', 'google'])
      .optional(),
    llm_model: z.string().max(200).optional(),
    embedding_provider: z
      .enum(['xenova', 'openai', 'google', 'openrouter'])
      .optional(),
    embedding_model: z.string().max(200).optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// Providers
const validProviders = [
  'openai',
  'anthropic',
  'openrouter',
  'xai',
  'google',
] as const;

export const providerSaveSchema = z.object({
  provider: z.enum(validProviders),
  api_key: z.string().min(1).max(500),
});

export const providerDeleteSchema = z.object({
  provider: z.enum(validProviders),
});

export const providerVerifySchema = z.object({
  provider: z.enum(validProviders),
});

// Helper to validate and return typed result or error response
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues;
    if (!issues || issues.length === 0) {
      return { success: false, error: result.error.message || 'Validation failed' };
    }
    const firstIssue = issues[0];
    const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';
    return { success: false, error: `${path}${firstIssue.message}` };
  }
  return { success: true, data: result.data };
}
