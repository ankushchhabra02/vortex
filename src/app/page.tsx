"use client";

import { ChatInterface } from "@/components/chat-interface";
import { IngestPanel } from "@/components/ingest-panel";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <main className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Toggle */}
      <button
        className="lg:hidden absolute top-4 left-4 z-50 p-2 bg-neutral-800 rounded-md"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar (Ingest Panel) */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 w-80 bg-neutral-900 border-r border-neutral-800",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <IngestPanel />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="h-14 border-b border-neutral-800 flex items-center px-6 justify-between bg-neutral-900/50 backdrop-blur">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Vortex
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Powered by OpenRouter & Local Embeddings</span>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </main>
  );
}
