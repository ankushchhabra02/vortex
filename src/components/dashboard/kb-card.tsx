"use client";

import Link from "next/link";
import { Database, FileText, MessageSquare, Trash2, Cpu } from "lucide-react";

interface KBCardProps {
  id: string;
  name: string;
  description: string | null;
  doc_count: number;
  conversation_count: number;
  embedding_provider: string;
  // embedding_model is not used in the UI, but was passed
  created_at: string;
  onDelete: (id: string) => void;
}

export function KBCard({
  id,
  name,
  description,
  doc_count,
  conversation_count,
  embedding_provider,
  // embedding_model, // removed unused
  created_at,
  onDelete,
}: KBCardProps) {
  const embeddingLabel = embedding_provider === 'xenova' ? 'Local' : 'OpenAI';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors group relative">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-blue-400" />
          <h3 className="font-semibold text-zinc-100 truncate">{name}</h3>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete(id);
          }}
          className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg hover:bg-zinc-800"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {description && (
        <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <FileText size={12} />
          {doc_count} docs
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare size={12} />
          {conversation_count} chats
        </span>
        <span className="flex items-center gap-1">
          <Cpu size={12} />
          {embeddingLabel}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          {new Date(created_at).toLocaleDateString()}
        </span>
        <Link
          href={`/chat/${id}`}
          className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          Chat →
        </Link>
      </div>
    </div>
  );
}
