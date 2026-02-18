"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { ChatInterface } from "@/components/chat-interface";
import { IngestPanel } from "@/components/ingest-panel";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const kbId = params.kbId as string;
  const initialConvId = searchParams.get("conv");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConvId
  );
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
  const [kbName, setKbName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email ?? undefined });
      }
    });
  }, []);

  useEffect(() => {
    fetch(`/api/knowledge-bases`)
      .then((r) => r.json())
      .then((data) => {
        const kb = (data.knowledgeBases || []).find(
          (k: any) => k.id === kbId
        );
        if (kb) {
          setKbName(kb.name);
        } else {
          // Invalid or inaccessible KB — redirect to dashboard
          router.replace("/");
        }
      })
      .catch(() => {
        router.replace("/");
      });
  }, [kbId, router]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleConversationCreated = useCallback((id: string) => {
    setActiveConversationId(id);
    setConversationRefreshKey((k) => k + 1);
  }, []);

  const handleConversationChange = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

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
          "fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform transition-transform duration-200 ease-out",
          "lg:relative lg:translate-x-0 lg:z-auto",
          "bg-zinc-900 border-r border-zinc-800",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <IngestPanel
          knowledgeBaseId={kbId}
          onKbChange={(newKbId) => router.push(`/chat/${newKbId}`)}
          user={user}
          onClose={() => setIsSidebarOpen(false)}
          activeConversationId={activeConversationId}
          onConversationChange={handleConversationChange}
          conversationRefreshKey={conversationRefreshKey}
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
            <Link
              href="/"
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Vortex
              </h1>
            </div>
            {kbName && (
              <span className="text-xs text-zinc-500 hidden sm:inline ml-2 px-2 py-0.5 bg-zinc-800 rounded-full">
                {kbName}
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ChatInterface
            knowledgeBaseId={kbId}
            conversationId={activeConversationId}
            onConversationCreated={handleConversationCreated}
          />
        </div>
      </div>
    </main>
  );
}
