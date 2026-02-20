"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, MessageSquare, Loader2 } from "lucide-react";
import { ConversationListSkeleton } from "@/components/skeleton-loader";
import { cn, timeAgo } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}

interface ConversationListProps {
  knowledgeBaseId: string | null;
  activeConversationId: string | null;
  onSelect: (conversationId: string | null) => void;
  refreshKey?: number;
}

export function ConversationList({
  knowledgeBaseId,
  activeConversationId,
  onSelect,
  refreshKey,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchConversations = useCallback(async (pageNum = 1, append = false) => {
    if (!knowledgeBaseId) {
      setConversations([]);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(
        `/api/conversations?knowledgeBaseId=${knowledgeBaseId}&page=${pageNum}&limit=20`
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = data.conversations || [];
      if (append) {
        setConversations((prev) => [...prev, ...items]);
      } else {
        setConversations(items);
      }
      setPage(pageNum);
      setHasMore(pageNum * 20 < (data.total ?? 0));
    } catch {
      toast("Failed to load conversations", "error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [knowledgeBaseId, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshKey]);

  const handleNewChat = () => {
    onSelect(null);
  };

  const handleDelete = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        onSelect(null);
      }
    } catch {
      toast("Failed to delete conversation", "error");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Chat button */}
      <div className="p-3 shrink-0">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {loading ? (
          <ConversationListSkeleton count={4} />
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center">
            <MessageSquare size={32} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">
              No conversations yet.
              <br />
              Start chatting!
            </p>
          </div>
        ) : (
          <>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full flex items-center justify-between p-2.5 rounded-lg text-left group transition-colors",
                  activeConversationId === conv.id
                    ? "bg-zinc-800 border-l-2 border-blue-500"
                    : "hover:bg-zinc-800/60 border-l-2 border-transparent"
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  <MessageSquare
                    size={14}
                    className="text-zinc-500 shrink-0"
                  />
                  <div className="overflow-hidden min-w-0">
                    <p className="text-sm text-zinc-300 truncate">
                      {conv.title || "New Chat"}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {timeAgo(conv.updated_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                  className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0"
                >
                  <X size={14} />
                </button>
              </button>
            ))}
            {hasMore && (
              <button
                onClick={() => fetchConversations(page + 1, true)}
                disabled={loadingMore}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="inline animate-spin" />
                ) : (
                  "Load more..."
                )}
              </button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Conversation"
        message="This will permanently delete this conversation and all its messages. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
