"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X, Plus, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { KBCard } from "@/components/dashboard/kb-card";
import { RecentChats } from "@/components/dashboard/recent-chats";
import { CreateKBDialog } from "@/components/dashboard/create-kb-dialog";
import { KBGridSkeleton, ConversationListSkeleton } from "@/components/skeleton-loader";
import { useToast } from "@/components/toast";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  doc_count: number;
  conversation_count: number;
  embedding_provider: string;
  embedding_model: string;
  embedding_dimensions: number;
  created_at: string;
}

interface RecentConversation {
  id: string;
  title: string | null;
  knowledge_base_id: string;
  kb_name: string;
  updated_at: string;
}

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email ?? undefined });
      }
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kbRes, convRes] = await Promise.all([
        fetch("/api/knowledge-bases"),
        fetch("/api/conversations/recent"),
      ]);

      if (kbRes.ok) {
        const data = await kbRes.json();
        setKnowledgeBases(data.knowledgeBases || []);
      }
      if (convRes.ok) {
        const data = await convRes.json();
        setRecentConversations(data.conversations || []);
      }
    } catch {
      toast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleCreateKB = async (data: {
    name: string;
    description: string;
    embedding_provider: string;
    embedding_model: string;
  }) => {
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast("Knowledge base created", "success");
      fetchData();
    } catch {
      toast("Failed to create knowledge base", "error");
    }
  };

  const handleDeleteKB = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge-bases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      toast("Knowledge base deleted", "info");
    } catch {
      toast("Failed to delete knowledge base", "error");
    }
  };

  return (
    <main className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out",
          "lg:relative lg:translate-x-0 lg:z-auto",
          "bg-zinc-900 border-r border-zinc-800",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarNav
          user={user}
          knowledgeBases={knowledgeBases.map((kb) => ({ id: kb.id, name: kb.name }))}
          onClose={() => setIsSidebarOpen(false)}
        />
      </aside>

      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-14 border-b border-zinc-800 flex items-center px-4 sm:px-6 justify-between bg-zinc-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-lg font-semibold text-zinc-100">Dashboard</h2>
          </div>
          <a
            href="https://github.com/ankushchhabra02/vortex"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
          >
            <Github size={18} />
            <span className="text-sm font-medium hidden sm:inline">GitHub</span>
          </a>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            {loading ? (
              <>
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-zinc-200">
                      Your Knowledge Bases
                    </h3>
                  </div>
                  <KBGridSkeleton count={3} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-200 mb-4">
                    Recent Conversations
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <ConversationListSkeleton count={3} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* KB Section */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-zinc-200">
                      Your Knowledge Bases
                    </h3>
                    <button
                      onClick={() => setShowCreateDialog(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Plus size={16} />
                      Create
                    </button>
                  </div>

                  {knowledgeBases.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-10 text-center">
                      <p className="text-zinc-500 mb-4">
                        No knowledge bases yet. Create one to get started.
                      </p>
                      <button
                        onClick={() => setShowCreateDialog(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                        Create Knowledge Base
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {knowledgeBases.map((kb) => (
                        <KBCard
                          key={kb.id}
                          {...kb}
                          onDelete={handleDeleteKB}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Conversations */}
                <div>
                  <h3 className="text-lg font-semibold text-zinc-200 mb-4">
                    Recent Conversations
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <RecentChats conversations={recentConversations} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CreateKBDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateKB}
      />
    </main>
  );
}
