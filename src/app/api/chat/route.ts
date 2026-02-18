import { NextRequest, NextResponse } from "next/server";
import { ragService } from "@/lib/rag-service-supabase";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Security: Maximum message length
const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES_HISTORY = 20;

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages, knowledgeBaseId, conversationId } = body;

    // Security: Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Security: Limit message history
    const limitedMessages = messages.slice(-MAX_MESSAGES_HISTORY);

    const lastMessage = limitedMessages[limitedMessages.length - 1];
    const userQuery = lastMessage.content;

    // Security: Validate message length
    if (typeof userQuery !== 'string' || userQuery.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: "Message too long" },
        { status: 400 }
      );
    }

    const sanitizedQuery = userQuery.trim();

    if (!sanitizedQuery) {
      return NextResponse.json(
        { error: "Empty message" },
        { status: 400 }
      );
    }

    // Resolve or create conversation
    let activeConversationId = conversationId;
    let isNewConversation = false;

    if (!activeConversationId && knowledgeBaseId) {
      // Create a new conversation
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
        isNewConversation = true;
      }
    }

    // 1. Retrieve context from RAG (if knowledge base provided)
    let context = "";
    let retrievalError = "";
    if (knowledgeBaseId) {
      try {
        context = await ragService.getContext(sanitizedQuery, knowledgeBaseId, 5);
      } catch (error) {
        console.error("Error retrieving context:", error);
        retrievalError = "Warning: Could not retrieve knowledge base context.";
      }
    }

    // 2. Prepare messages for LLM
    const systemPrompt = context
      ? `You are Vortex, a helpful AI assistant with access to a knowledge base.
Use the following context to answer the user's question accurately. If the answer is not in the context, say so.

CONTEXT:
${context}

Answer based on the context above. Be concise and helpful.`
      : retrievalError
        ? `You are Vortex, a helpful AI assistant. ${retrievalError} Please let the user know there was an issue retrieving context and answer to the best of your ability.`
        : "You are Vortex, a helpful AI assistant. Answer questions concisely and helpfully.";

    // 3. Call OpenRouter with FREE model
    const chat = new ChatOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
      modelName: "meta-llama/llama-3.2-3b-instruct:free",
      streaming: true,
      temperature: 0.7,
    });

    // Convert message history
    const chatMessages = [
      new SystemMessage(systemPrompt),
      ...limitedMessages.map((m: any) => {
        if (m.role === "user") {
          return new HumanMessage(m.content);
        } else if (m.role === "assistant") {
          return new AIMessage(m.content);
        }
        return new SystemMessage(m.content);
      }),
    ];

    const response = await chat.stream(chatMessages);

    // 4. Return stream with proper encoding
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

          // Save messages to database after streaming completes
          if (activeConversationId) {
            try {
              // Save user message
              await supabaseAdmin.from("messages").insert({
                conversation_id: activeConversationId,
                role: "user",
                content: sanitizedQuery,
              });

              // Save assistant response
              await supabaseAdmin.from("messages").insert({
                conversation_id: activeConversationId,
                role: "assistant",
                content: fullAssistantResponse,
              });

              // Update conversation timestamp
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
    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
