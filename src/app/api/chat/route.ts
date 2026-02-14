import { NextRequest, NextResponse } from "next/server";
import { ragService } from "@/lib/rag-service";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

export const runtime = "edge"; // OpenRouter works well with Edge

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;

        // 1. Retrieve context
        const docs = await ragService.search(userQuery);
        const context = docs.map((d) => d.pageContent).join("\n\n");

        // 2. Prepare prompt
        const systemPrompt = `You are Vortex, an intelligent assistant. 
    Use the following pieces of context to answer the user's question.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    
    Context:
    ${context}
    `;

        // 3. Call OpenRouter
        const chat = new ChatOpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
            },
            modelName: "openai/gpt-3.5-turbo", // Or any free model like "mistralai/mistral-7b-instruct:free"
            streaming: true,
            temperature: 0.7,
        });

        const response = await chat.stream([
            new SystemMessage(systemPrompt),
            ...messages.map((m: any) =>
                m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
            ),
        ]);

        // 4. Return stream
        // Using LangChain's AI SDK adapter or manual streaming
        // For simplicity, let's use a basic text stream response
        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of response) {
                    controller.enqueue(chunk.content);
                }
                controller.close();
            },
        });

        return new NextResponse(stream);

    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }
}
