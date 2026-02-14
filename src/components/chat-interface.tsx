import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatInterface() {
    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
        { role: "assistant", content: "Hello! I'm Vortex. Add a URL or upload a document to get started." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages, isLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput("");

        // Optimistic update
        const newMessages = [...messages, { role: "user" as const, content: userMsg }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages }),
            });

            if (!res.ok) throw new Error(res.statusText);

            // Create placeholder for assistant response
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) return;

            let isFirstChunk = true;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (isFirstChunk) {
                    setIsLoading(false);
                    isFirstChunk = false;
                }

                const chunk = decoder.decode(value, { stream: true });
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    const updated = { ...last, content: last.content + chunk };
                    return [...prev.slice(0, -1), updated];
                });
            }
        } catch (error) {
            console.error(error);
            setMessages((prev) => [...prev, { role: "assistant", content: "Error: Failed to get response." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-neutral-900 text-neutral-100">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex w-full",
                            m.role === "user" ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[80%] rounded-lg p-3",
                                m.role === "user"
                                    ? "bg-blue-600 text-white"
                                    : "bg-neutral-800 text-neutral-200"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
                                <span className="text-xs opacity-50 capitalize">{m.role}</span>
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none">
                                {m.role === "assistant" && m.content === "" && isLoading ? (
                                    <div className="flex items-center py-1">
                                        <span className="text-sm font-medium bg-gradient-to-r from-neutral-500 via-neutral-200 to-neutral-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                                            Thinking...
                                        </span>
                                    </div>
                                ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {m.content}
                                    </ReactMarkdown>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-neutral-800 bg-neutral-900">
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ask a question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50 transition-colors"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </form>
        </div>
    );
}
