"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface RecentChat {
  id: string;
  title: string | null;
  knowledge_base_id: string;
  kb_name: string;
  updated_at: string;
}

interface RecentChatsProps {
  conversations: RecentChat[];
}

export function RecentChats({ conversations }: RecentChatsProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare size={32} className="text-zinc-700 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">No recent conversations</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          href={`/chat/${conv.knowledge_base_id}?conv=${conv.id}`}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <MessageSquare size={16} className="text-zinc-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-zinc-200 truncate">
                {conv.title || "New Chat"}
              </p>
              <p className="text-xs text-zinc-500">{conv.kb_name}</p>
            </div>
          </div>
          <span className="text-[10px] text-zinc-600 shrink-0 ml-2">
            {timeAgo(conv.updated_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}
