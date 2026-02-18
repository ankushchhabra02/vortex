"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, ChevronDown, Trash2, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface KnowledgeBaseSelectorProps {
  activeKbId: string | null;
  onSelect: (kbId: string) => void;
}

export function KnowledgeBaseSelector({ activeKbId, onSelect }: KnowledgeBaseSelectorProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-bases");
      if (!res.ok) return;
      const data = await res.json();
      setKnowledgeBases(data.knowledgeBases || []);
      if (!activeKbId && data.knowledgeBases?.length > 0) {
        onSelect(data.knowledgeBases[0].id);
      }
    } catch {
      // Error handled by loading state
    } finally {
      setLoading(false);
    }
  }, [activeKbId, onSelect]);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createKnowledgeBase = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const data = await res.json();
      const newKb = { id: data.id, name: data.name, description: data.description, created_at: new Date().toISOString() };
      setKnowledgeBases((prev) => [newKb, ...prev]);
      onSelect(data.id);
      setNewName("");
      setIsCreating(false);
      setIsOpen(false);
    } catch {
      // Silent fail
    }
  };

  const deleteKnowledgeBase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/knowledge-bases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      if (activeKbId === id) {
        const remaining = knowledgeBases.filter((kb) => kb.id !== id);
        onSelect(remaining.length > 0 ? remaining[0].id : "");
      }
    } catch {
      // Silent fail
    }
  };

  const activeKb = knowledgeBases.find((kb) => kb.id === activeKbId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
        <Loader2 size={16} className="text-zinc-500 animate-spin" />
        <span className="text-sm text-zinc-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Database size={16} className="text-blue-400 shrink-0" />
          <span className="text-sm text-zinc-200 truncate">
            {activeKb ? activeKb.name : "Select a knowledge base"}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cn("text-zinc-400 transition-transform shrink-0", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {knowledgeBases.length === 0 && !isCreating && (
            <div className="px-3 py-4 text-center text-sm text-zinc-500">
              No knowledge bases yet
            </div>
          )}

          {knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 hover:bg-zinc-700/50 cursor-pointer group",
                kb.id === activeKbId && "bg-blue-600/10 border-l-2 border-blue-500"
              )}
              onClick={() => {
                onSelect(kb.id);
                setIsOpen(false);
              }}
            >
              <span className="text-sm text-zinc-200 truncate">{kb.name}</span>
              <button
                onClick={(e) => deleteKnowledgeBase(kb.id, e)}
                className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {isCreating ? (
            <div className="p-2 border-t border-zinc-700">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createKnowledgeBase();
                  if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="Knowledge base name..."
                className="w-full px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-600 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-400 hover:bg-zinc-700/50 border-t border-zinc-700"
            >
              <Plus size={14} /> Create new knowledge base
            </button>
          )}
        </div>
      )}
    </div>
  );
}
