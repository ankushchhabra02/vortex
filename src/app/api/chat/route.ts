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

const MAX_MESSAGE_LENGTH = 10000;
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
      } catch {
        // Fall back to env
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
      try { apiKey = decrypt(providerData.api_key_encrypted); } catch { }
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
    const { messages, knowledgeBaseId, conversationId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    const limitedMessages = messages.slice(-MAX_MESSAGES_HISTORY);
    const lastMessage = limitedMessages[limitedMessages.length - 1];
    const userQuery = lastMessage.content;

    if (typeof userQuery !== 'string' || userQuery.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

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
    if (knowledgeBaseId) {
      console.log(`[RAG] Retrieving context for KB: ${knowledgeBaseId}, Query: "${sanitizedQuery}"`);
      try {
        const embeddingConfig = await getKBEmbeddingConfig(knowledgeBaseId, user.id);
        console.log(`[RAG] Embedding Config:`, embeddingConfig);
        context = await ragService.getContext(sanitizedQuery, knowledgeBaseId, 5, embeddingConfig);
        console.log(`[RAG] Retrieved context length: ${context.length}`);
      } catch (error) {
        console.error("[RAG] Error retrieving context:", error);
      }
    }

    let docTitles = "None Available";
    if (knowledgeBaseId) {
      const { data: kbDocs } = await supabaseAdmin
        .from("documents")
        .select("title")
        .eq("knowledge_base_id", knowledgeBaseId);
      if (kbDocs && kbDocs.length > 0) {
        docTitles = kbDocs.map(d => d.title).join(", ");
      }
    }

    const systemPrompt = `You are Vortex, a helpful AI assistant.
Current Knowledge Base Documents: ${docTitles}

${context ? `Use the following context to answer accurately:
CONTEXT:
${context}
` : "You have access to a knowledge base, but no specific relevant content was found for this query. If the user asks about documents, confirm you have access to them but need a specific question to provide details."}

IMPORTANT: Never say you cannot read or process files. You have direct access to the text content of the documents listed above through your knowledge base integration.`;

    const llmConfig = await getUserLLMConfig(user.id);
    const chat = createChatModel({
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
