"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Database,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

interface KBItem {
  id: string;
  name: string;
}

interface SidebarNavProps {
  user: { id: string; email?: string } | null;
  knowledgeBases?: KBItem[];
  onClose?: () => void;
}

export function SidebarNav({ user, knowledgeBases = [], onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-full h-full bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Vortex
          </h1>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="p-2 space-y-1 shrink-0">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* KB quick list */}
      {knowledgeBases.length > 0 && (
        <div className="flex-1 overflow-y-auto border-t border-zinc-800">
          <div className="px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Knowledge Bases
            </span>
          </div>
          <div className="px-2 pb-2 space-y-0.5">
            {knowledgeBases.map((kb) => (
              <Link
                key={kb.id}
                href={`/chat/${kb.id}`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  pathname === `/chat/${kb.id}`
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                <Database size={14} className="shrink-0 text-blue-400/70" />
                <span className="truncate">{kb.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!knowledgeBases.length && <div className="flex-1" />}

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
    </div>
  );
}
