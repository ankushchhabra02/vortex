"use client";

import { useState, useEffect } from "react";
import {
  Link as LinkIcon,
  FileText,
  Upload,
  Plus,
  X,
  LogOut,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { KnowledgeBaseSelector } from "./knowledge-base-selector";
import { ConversationList } from "./conversation-list";
import { useToast } from "./toast";

interface DocumentItem {
  type: "url" | "file";
  name: string;
  id: string;
}

interface IngestPanelProps {
  knowledgeBaseId: string | null;
  onKbChange: (kbId: string) => void;
  user: { id: string; email?: string } | null;
  onClose?: () => void;
  activeConversationId: string | null;
  onConversationChange: (conversationId: string | null) => void;
  conversationRefreshKey?: number;
}

type SidebarTab = "chats" | "documents";

export function IngestPanel({
  knowledgeBaseId,
  onKbChange,
  user,
  onClose,
  activeConversationId,
  onConversationChange,
  conversationRefreshKey,
}: IngestPanelProps) {
  const [url, setUrl] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docPage, setDocPage] = useState(1);
  const [hasMoreDocs, setHasMoreDocs] = useState(false);
  const [loadingMoreDocs, setLoadingMoreDocs] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");
  const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Fetch documents when KB changes
  useEffect(() => {
    if (!knowledgeBaseId) {
      setItems([]);
      return;
    }
    fetchDocuments(knowledgeBaseId);
  }, [knowledgeBaseId]);

  const fetchDocuments = async (kbId: string, pageNum = 1, append = false) => {
    if (append) {
      setLoadingMoreDocs(true);
    } else {
      setLoadingDocs(true);
    }
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/documents?page=${pageNum}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped = (data.documents || []).map((doc: { source_url?: string; title?: string; file_path?: string; id: string }) => ({
        type: doc.source_url ? "url" : "file",
        name: doc.title || doc.file_path || "Untitled",
        id: doc.id,
      }));
      if (append) {
        setItems((prev) => [...prev, ...mapped]);
      } else {
        setItems(mapped);
      }
      setDocPage(pageNum);
      setHasMoreDocs(pageNum * 20 < (data.total ?? 0));
    } catch {
      // Error handled by loading state
    } finally {
      setLoadingDocs(false);
      setLoadingMoreDocs(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isIngesting || !knowledgeBaseId) return;

    setIsIngesting(true);
    try {
      const formData = new FormData();
      formData.append("url", url);
      formData.append("knowledgeBaseId", knowledgeBaseId);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to ingest URL");
      }

      const data = await res.json();
      setItems((prev) => [
        ...prev,
        { type: "url", name: url, id: data.documentId },
      ]);
      setUrl("");
      toast("URL ingested successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to ingest URL";
      toast(msg, "error");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !knowledgeBaseId) return;

    setIsIngesting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("knowledgeBaseId", knowledgeBaseId);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload file");
      }

      const data = await res.json();
      setItems((prev) => [
        ...prev,
        { type: "file", name: file.name, id: data.documentId },
      ]);
      e.target.value = "";
      toast("File uploaded successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to upload file";
      toast(msg, "error");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((prev) => prev.filter((i) => i.id !== documentId));
      toast("Document deleted", "info");
    } catch {
      toast("Failed to delete document", "error");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="w-full h-full bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            Knowledge Base
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Add content for Vortex to learn.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* KB Selector */}
      <div className="p-4 border-b border-zinc-800 shrink-0">
        <KnowledgeBaseSelector
          activeKbId={knowledgeBaseId}
          onSelect={onKbChange}
        />
      </div>

      {/* Content - only show if KB selected */}
      {knowledgeBaseId ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            <button
              onClick={() => setActiveTab("chats")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2",
                activeTab === "chats"
                  ? "border-blue-500 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <MessageSquare size={14} />
              Chats
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2",
                activeTab === "documents"
                  ? "border-blue-500 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <FileText size={14} />
              Documents
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "chats" ? (
              <ConversationList
                knowledgeBaseId={knowledgeBaseId}
                activeConversationId={activeConversationId}
                onSelect={onConversationChange}
                refreshKey={conversationRefreshKey}
              />
            ) : (
              <>
                {/* Ingest controls */}
                <div className="p-4 border-b border-zinc-800 space-y-4 shrink-0">
                  {/* URL Input */}
                  <form onSubmit={handleUrlSubmit} className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                      <LinkIcon size={14} /> Add Website
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none placeholder-zinc-500 transition-colors"
                        placeholder="https://..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isIngesting}
                      />
                      <button
                        disabled={isIngesting || !url}
                        type="submit"
                        className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-2 transition-colors disabled:opacity-50"
                      >
                        <Plus size={16} className="text-blue-400" />
                      </button>
                    </div>
                  </form>

                  {/* File Upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-2">
                      <FileText size={14} /> Add Document
                    </label>
                    <label className="flex items-center justify-center w-full p-3 border border-dashed border-zinc-700 rounded-lg bg-zinc-800/50 hover:bg-zinc-800/80 cursor-pointer transition-colors group">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.txt,.md"
                        onChange={handleFileUpload}
                        disabled={isIngesting}
                      />
                      <div className="flex items-center gap-2 text-zinc-400 group-hover:text-blue-400 transition-colors">
                        <Upload size={14} />
                        <span className="text-xs">Upload PDF or Text</span>
                      </div>
                    </label>
                  </div>

                  {/* Ingesting indicator */}
                  {isIngesting && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-950/30 border border-blue-800/30 rounded-lg">
                      <Loader2
                        size={14}
                        className="text-blue-400 animate-spin"
                      />
                      <span className="text-xs text-blue-300">
                        Processing document...
                      </span>
                    </div>
                  )}
                </div>

                {/* Documents List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2
                        size={20}
                        className="text-zinc-500 animate-spin"
                      />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs text-zinc-500">
                        No documents added yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800 group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {item.type === "url" ? (
                              <LinkIcon
                                size={14}
                                className="text-blue-400 flex-shrink-0"
                              />
                            ) : (
                              <FileText
                                size={14}
                                className="text-orange-400 flex-shrink-0"
                              />
                            )}
                            <span className="text-xs text-zinc-300 truncate">
                              {item.name}
                            </span>
                          </div>
                          <button
                            onClick={() => setDeleteDocTarget(item.id)}
                            className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {hasMoreDocs && knowledgeBaseId && (
                        <button
                          onClick={() => fetchDocuments(knowledgeBaseId, docPage + 1, true)}
                          disabled={loadingMoreDocs}
                          className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                        >
                          {loadingMoreDocs ? (
                            <Loader2 size={14} className="inline animate-spin" />
                          ) : (
                            "Load more..."
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-sm text-zinc-500">
            Select or create a knowledge base to get started.
          </p>
        </div>
      )}

      {/* User footer */}
      <div className="p-3 border-t border-zinc-800 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "?"}
            </div>
            <span className="text-sm text-zinc-300 truncate">
              {user?.email || "Unknown"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDocTarget !== null}
        title="Delete Document"
        message="This will permanently delete this document and its indexed content. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteDocTarget) handleDeleteDocument(deleteDocTarget); setDeleteDocTarget(null); }}
        onCancel={() => setDeleteDocTarget(null)}
      />
    </div>
  );
}
