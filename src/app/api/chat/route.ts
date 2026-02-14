import { NextRequest, NextResponse } from "next/server";
import { ragService } from "@/lib/rag-service";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;

        // 1. Retrieve context
        const docs = await ragService.search(userQuery);
        const context = docs.map((d) => d.pageContent).join("\n\n");

        // 2. Call OpenRouter
        const chat = new ChatOpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
            },
            modelName: "openrouter/free",
            streaming: true,
            temperature: 0.7,
        });

        // Inject context directly into the user's question
        const enhancedUserMessage = `Here is relevant information from the uploaded document:

---
${context}
---

Now, based ONLY on the information above, answer this question: ${userQuery}`;

        const response = await chat.stream([
            new SystemMessage("You are Vortex, a helpful AI assistant. Answer questions using the information provided in the user's message."),
            ...messages.slice(0, -1).map((m: any) =>
                m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
            ),
            new HumanMessage(enhancedUserMessage),
        ]);

        // 3. Return stream
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
        return NextResponse.json({
            error: "Failed to generate response",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
