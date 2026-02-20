import { NextRequest, NextResponse } from "next/server";
import { ragService } from "@/lib/rag-service-supabase";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createChatModel } from "@/lib/providers/llm-factory";
import { decrypt } from "@/lib/providers/crypto";
import type { EmbeddingConfig, LLMProvider } from "@/lib/providers/types";
import { getEmbeddingDimensions } from "@/lib/providers/types";
import { chatLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { verifyKBOwnership } from "@/lib/supabase/verify-ownership";
import { validateBody, chatSchema } from "@/lib/validations";

const MAX_MESSAGES_HISTORY = 20;

async function getUserLLMConfig(userId: string) {
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  const provider = (settings?.llm_provider || 'openrouter') as LLMProvider;
  const model = settings?.llm_model || 'openrouter/auto';
  const temperature = settings?.temperature ?? 0.7;

  let apiKey = '';

  if (provider === 'openrouter' && model.includes(':free')) {
    apiKey = process.env.OPENROUTER_API_KEY || '';
  } else {
    const { data: providerData } = await supabaseAdmin
      .from('user_providers')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (providerData) {
      try {
        apiKey = decrypt(providerData.api_key_encrypted);
      } catch (e) {
        console.error('[chat] Decrypt error:', e);
      }
    }

    if (!apiKey) {
      if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY || '';
      else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || '';
    }
  }

  return { provider, model, temperature, apiKey };
}

async function getKBEmbeddingConfig(kbId: string, userId: string): Promise<EmbeddingConfig | undefined> {
  const { data: kb } = await supabaseAdmin
    .from('knowledge_bases')
    .select('embedding_provider, embedding_model, embedding_dimensions')
    .eq('id', kbId)
    .single();

  if (!kb || kb.embedding_provider === 'xenova') {
    return undefined;
  }

  let apiKey = '';
  if (kb.embedding_provider === 'openai') {
    const { data: providerData } = await supabaseAdmin
      .from('user_providers')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .eq('provider', 'openai')
      .single();

    if (providerData) {
      try { apiKey = decrypt(providerData.api_key_encrypted); } catch (e) { console.error('[chat] Decrypt error:', e); }
    }
  }

  return {
    provider: kb.embedding_provider as 'xenova' | 'openai',
    model: kb.embedding_model,
    dimensions: kb.embedding_dimensions || getEmbeddingDimensions(kb.embedding_provider as 'xenova' | 'openai', kb.embedding_model),
    apiKey,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = chatLimiter.check(user.id);
    if (!rl.success) return rateLimitResponse(rl.resetMs);

    const body = await req.json();
    const validation = validateBody(chatSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { messages, knowledgeBaseId, conversationId } = validation.data;

    if (knowledgeBaseId) {
      const isOwner = await verifyKBOwnership(user.id, knowledgeBaseId);
      if (!isOwner) {
        return NextResponse.json({ error: "Knowledge base not found" }, { status: 403 });
      }
    }

    const limitedMessages = messages.slice(-MAX_MESSAGES_HISTORY);
    const lastMessage = limitedMessages[limitedMessages.length - 1];
    const userQuery = lastMessage.content;
    const sanitizedQuery = userQuery.trim();
    if (!sanitizedQuery) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    let activeConversationId = conversationId;

    if (!activeConversationId && knowledgeBaseId) {
      const title = sanitizedQuery.length > 50
        ? sanitizedQuery.substring(0, 50) + "..."
        : sanitizedQuery;

      const { data: conv, error: convError } = await supabaseAdmin
        .from("conversations")
        .insert({
          user_id: user.id,
          knowledge_base_id: knowledgeBaseId,
          title,
        })
        .select()
        .single();

      if (!convError && conv) {
        activeConversationId = conv.id;
      }
    }

    let context = "";
    let sources: Array<{ index: number; title: string; similarity: number }> = [];
    if (knowledgeBaseId) {
      console.log(`[RAG] Retrieving context for KB: ${knowledgeBaseId}, Query: "${sanitizedQuery}"`);
      try {
        const embeddingConfig = await getKBEmbeddingConfig(knowledgeBaseId, user.id);
        console.log(`[RAG] Embedding Config:`, embeddingConfig);
        const result = await ragService.getContextWithSources(sanitizedQuery, knowledgeBaseId, 5, embeddingConfig);
        context = result.context;
        sources = result.sources;
        console.log(`[RAG] Retrieved context length: ${context.length}, sources: ${sources.length}`);
      } catch (error) {
        console.error("[RAG] Error retrieving context:", error);
      }
    }

    let docTitles = "None Available";
    if (knowledgeBaseId) {
      const { data: kbDocs } = await supabaseAdmin
        .from("documents")
        .select("title")
        .eq("knowledge_base_id", knowledgeBaseId)
        .is("deleted_at", null);
      if (kbDocs && kbDocs.length > 0) {
        docTitles = kbDocs.map(d => d.title).join(", ");
      }
    }

    const systemPrompt = knowledgeBaseId
      ? `You are Vortex, a helpful AI assistant with access to a knowledge base.

Available documents: ${docTitles}

${context
        ? `The following context was retrieved from the knowledge base and is DIRECTLY RELEVANT to the user's question. You MUST use this context as your primary source of information. Base your answer on the context below. When using information from the context, cite the source using [n] notation matching the source numbers.

Do NOT say "based on the context provided" or similar meta-references. Simply answer the question naturally using the information.

CONTEXT:
${context}

If the context does not fully answer the question, use what is available and note what additional information might be needed.`
        : `No matching content was found in the knowledge base for this specific query. You still have access to these documents: ${docTitles}. Try to help the user by:
1. Suggesting they rephrase their question with different keywords
2. Letting them know what topics the available documents cover (based on the titles)
3. Answering from your general knowledge if appropriate, but clearly stating that the answer is not from their documents`
      }

IMPORTANT RULES:
- Never say you cannot read or process files. You have direct access to the document text through the knowledge base.
- If context is provided above, prioritize it over your general knowledge.
- Be specific and detailed when context supports it.`
      : `You are Vortex, a helpful AI assistant. Answer the user's question to the best of your ability.`;

    const llmConfig = await getUserLLMConfig(user.id);
    const chat = await createChatModel({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      temperature: llmConfig.temperature,
    });

    const chatMessages = [
      new SystemMessage(systemPrompt),
      ...limitedMessages.map((m: { role: string; content: string }) => {
        if (m.role === "user") return new HumanMessage(m.content);
        if (m.role === "assistant") return new AIMessage(m.content);
        return new SystemMessage(m.content);
      }),
    ];

    const response = await chat.stream(chatMessages);

    const encoder = new TextEncoder();
    let fullAssistantResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.content;
            if (content && typeof content === 'string') {
              fullAssistantResponse += content;
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();

          if (activeConversationId) {
            try {
              await supabaseAdmin.from("messages").insert({
                conversation_id: activeConversationId,
                role: "user",
                content: sanitizedQuery,
              });
              await supabaseAdmin.from("messages").insert({
                conversation_id: activeConversationId,
                role: "assistant",
                content: fullAssistantResponse,
              });
              await supabaseAdmin
                .from("conversations")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", activeConversationId);
            } catch (saveError) {
              console.error("Error saving messages:", saveError);
            }
          }
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    };

    if (activeConversationId) {
      headers['X-Conversation-Id'] = activeConversationId;
    }

    if (sources.length > 0) {
      headers['X-Sources'] = JSON.stringify(sources);
    }

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error("Chat error:", error);
    const isProviderError = error instanceof Error &&
      (error.message.includes('API') || error.message.includes('model') || error.message.includes('rate'));
    return NextResponse.json(
      {
        error: isProviderError
          ? "The AI provider returned an error. Check your settings or try again."
          : "Failed to generate response",
        code: isProviderError ? 'PROVIDER_ERROR' : 'INTERNAL_ERROR',
      },
      { status: isProviderError ? 502 : 500 }
    );
  }
}
