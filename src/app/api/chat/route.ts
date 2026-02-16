import { NextRequest, NextResponse } from "next/server";
import { ragService } from "@/lib/rag-service-supabase";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

// Security: Maximum message length
const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES_HISTORY = 20;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, knowledgeBaseId } = body;

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

    // Sanitize user query (basic protection)
    const sanitizedQuery = userQuery.trim();

    if (!sanitizedQuery) {
      return NextResponse.json(
        { error: "Empty message" },
        { status: 400 }
      );
    }

    // 1. Retrieve context from RAG (if knowledge base provided)
    let context = "";
    if (knowledgeBaseId) {
      try {
        context = await ragService.getContext(sanitizedQuery, knowledgeBaseId, 5);
      } catch (error) {
        console.error("Error retrieving context:", error);
        // Continue without context if retrieval fails
      }
    }

    // 2. Prepare messages for LLM
    const systemPrompt = context
      ? `You are Vortex, a helpful AI assistant with access to a knowledge base.
Use the following context to answer the user's question accurately. If the answer is not in the context, say so.

CONTEXT:
${context}

Answer based on the context above. Be concise and helpful.`
      : "You are Vortex, a helpful AI assistant. Answer questions concisely and helpfully.";

    // 3. Call OpenRouter with FREE model
    const chat = new ChatOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
      // Use a free model from OpenRouter
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

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.content;
            if (content && typeof content === 'string') {
              // Fix: Properly encode the stream
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
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
