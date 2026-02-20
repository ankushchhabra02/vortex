"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface Source {
    index: number;
    title: string;
    similarity: number;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
}

interface ChatInterfaceProps {
    knowledgeBaseId: string | null;
    conversationId: string | null;
    onConversationCreated: (id: string) => void;
}

export function ChatInterface({
    knowledgeBaseId,
    conversationId,
    onConversationCreated,
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [totalMessages, setTotalMessages] = useState(0);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeConversationRef = useRef<string | null>(null);
    const msgIdRef = useRef(0);
    const nextMsgId = () => `msg-${++msgIdRef.current}`;
    const justCreatedConvRef = useRef(false);

    // Track the current conversation to avoid stale closures
    activeConversationRef.current = conversationId;

    // Load conversation messages when conversationId changes
    useEffect(() => {
        if (!conversationId) {
            setMessages([]);
            setTotalMessages(0);
            return;
        }

        // Skip fetching if we just created this conversation (messages are already in state from streaming)
        if (justCreatedConvRef.current) {
            justCreatedConvRef.current = false;
            return;
        }

        let cancelled = false;
        setLoadingHistory(true);

        fetch(`/api/conversations/${conversationId}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load conversation");
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                const msgs = (data.messages || []).map((m: { role: string; content: string }) => ({
                    id: nextMsgId(),
                    role: m.role as "user" | "assistant",
                    content: m.content,
                }));
                setMessages(msgs);
                setTotalMessages(data.total ?? msgs.length);
            })
            .catch(() => {
                if (cancelled) return;
                setMessages([]);
                setTotalMessages(0);
            })
            .finally(() => {
                if (!cancelled) setLoadingHistory(false);
            });

        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    const loadOlderMessages = async () => {
        if (!conversationId || loadingOlder) return;
        // Calculate which page of older messages to load
        const loaded = messages.length;
        const remaining = totalMessages - loaded;
        if (remaining <= 0) return;

        setLoadingOlder(true);
        try {
            // Fetch from page 1 with the right limit to get the older chunk
            const olderLimit = Math.min(50, remaining);
            const res = await fetch(
                `/api/conversations/${conversationId}?page=1&limit=${olderLimit}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const olderMsgs = (data.messages || [])
                .slice(0, remaining > olderLimit ? olderLimit : remaining)
                .map((m: { role: string; content: string }) => ({
                    id: nextMsgId(),
                    role: m.role as "user" | "assistant",
                    content: m.content,
                }));
            if (olderMsgs.length > 0) {
                setMessages((prev) => [...olderMsgs, ...prev]);
                setTotalMessages(data.total ?? totalMessages);
            }
        } catch {
            // Silent fail
        } finally {
            setLoadingOlder(false);
        }
    };

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

        const userMsgObj: ChatMessage = { id: nextMsgId(), role: "user", content: userMsg };
        const assistantPlaceholder: ChatMessage = { id: nextMsgId(), role: "assistant", content: "" };
        const newMessages = [...messages, userMsgObj];
        // Add assistant placeholder immediately to show "Thinking..."
        setMessages([...newMessages, assistantPlaceholder]);
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    knowledgeBaseId,
                    conversationId: activeConversationRef.current,
                }),
            });

            if (!res.ok) {
                // Remove the placeholder if error
                setMessages(newMessages);
                const body = await res.json().catch(() => null);
                const code = body?.code;
                if (code === "RATE_LIMITED") throw new Error("Too many requests. Please wait a moment and try again.");
                if (code === "PROVIDER_ERROR") throw new Error("The AI provider is temporarily unavailable. Please try again.");
                throw new Error(body?.error || "Failed to get response");
            }

            // Check if a new conversation was created
            const newConvId = res.headers.get("X-Conversation-Id");
            if (newConvId && !activeConversationRef.current) {
                justCreatedConvRef.current = true;
                onConversationCreated(newConvId);
            }

            // Parse sources from response headers
            const sourcesHeader = res.headers.get("X-Sources");
            let parsedSources: Source[] = [];
            if (sourcesHeader) {
                try { parsedSources = JSON.parse(sourcesHeader); } catch { /* ignore parse error */ }
            }

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

            // After streaming is done, attach sources to the assistant message
            if (parsedSources.length > 0) {
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    return [...prev.slice(0, -1), { ...last, sources: parsedSources }];
                });
            }
        } catch (error) {
            const errMsg =
                error instanceof Error && error.message
                    ? error.message
                    : "Failed to get response";
            setMessages((prev) => [
                ...prev,
                {
                    id: nextMsgId(),
                    role: "assistant",
                    content: `Something went wrong: ${errMsg}. Please try again.`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-smooth"
            >
                {/* Loading history */}
                {loadingHistory ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 size={24} className="text-zinc-500 animate-spin" />
                    </div>
                ) : /* Empty state when no KB selected */
                    !knowledgeBaseId ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <Database size={48} className="text-zinc-700 mb-4" />
                            <h3 className="text-lg font-medium text-zinc-400 mb-2">
                                No Knowledge Base Selected
                            </h3>
                            <p className="text-sm text-zinc-500 max-w-sm">
                                Select or create a knowledge base from the sidebar, then upload
                                documents to start chatting.
                            </p>
                        </div>
                    ) : /* Empty state for new chat */
                        messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <Bot size={48} className="text-zinc-700 mb-4" />
                                <h3 className="text-lg font-medium text-zinc-400 mb-2">
                                    Start a Conversation
                                </h3>
                                <p className="text-sm text-zinc-500 max-w-sm">
                                    Ask a question about your knowledge base documents.
                                </p>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
                                {totalMessages > messages.length && (
                                    <div className="flex justify-center">
                                        <button
                                            onClick={loadOlderMessages}
                                            disabled={loadingOlder}
                                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 py-2"
                                        >
                                            {loadingOlder ? (
                                                <Loader2 size={14} className="inline animate-spin" />
                                            ) : (
                                                `Load older messages (${totalMessages - messages.length} more)`
                                            )}
                                        </button>
                                    </div>
                                )}
                                {messages.map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            "flex w-full animate-fade-in",
                                            m.role === "user" ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] rounded-2xl px-4 py-3",
                                                m.role === "user"
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                {m.role === "user" ? (
                                                    <User size={14} />
                                                ) : (
                                                    <Bot size={14} />
                                                )}
                                                <span className="text-xs opacity-50 capitalize">
                                                    {m.role}
                                                </span>
                                            </div>
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                {m.role === "assistant" &&
                                                    m.content === "" &&
                                                    isLoading ? (
                                                    <div className="flex items-center py-1">
                                                        <span className="text-sm font-medium bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                                                            Thinking...
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                                                        {m.content}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                            {m.sources && m.sources.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700/50">
                                                    <p className="text-[10px] text-zinc-500 mb-1">Sources:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {m.sources.map((s) => (
                                                            <span
                                                                key={s.index}
                                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-600/20 text-blue-300 border border-blue-500/30"
                                                                title={`${s.title} (${(s.similarity * 100).toFixed(0)}% match)`}
                                                            >
                                                                [{s.index}] {s.title}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-md shrink-0">
                <form
                    onSubmit={handleSubmit}
                    className="max-w-4xl mx-auto p-3 sm:p-4"
                >
                    <div className="flex gap-2 items-end">
                        <input
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 placeholder-zinc-500 transition-colors"
                            placeholder={
                                knowledgeBaseId
                                    ? "Ask a question about your knowledge base..."
                                    : "Select a knowledge base to start..."
                            }
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={!knowledgeBaseId}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !knowledgeBaseId}
                            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-2.5 disabled:opacity-50 transition-colors shrink-0"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
