"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X, Loader2, Save, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ProviderSelector } from "@/components/settings/provider-selector";
import { APIKeyManager } from "@/components/settings/api-key-manager";
import { EmbeddingSelector } from "@/components/settings/embedding-selector";
import { useToast } from "@/components/toast";

interface Settings {
  llm_provider: string;
  llm_model: string;
  embedding_provider: string;
  embedding_model: string;
  temperature: number;
}

interface ProviderKey {
  provider: string;
  has_key: boolean;
  key_hint: string;
}

export default function SettingsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<{ id: string; name: string }[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
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
      const [settingsRes, providersRes, kbRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/settings/providers"),
        fetch("/api/knowledge-bases"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
      }
      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || []);
      }
      if (kbRes.ok) {
        const data = await kbRes.json();
        setKnowledgeBases(
          (data.knowledgeBases || []).map((kb: { id: string; name: string }) => ({
            id: kb.id,
            name: kb.name,
          }))
        );
      }
    } catch {
      // Error handled by loading state
    } finally {
      setLoading(false);
    }
  }, []);

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

  const updateSettings = (key: keyof Settings, value: string | number | boolean) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      setDirty(false);
      toast("Settings saved", "success");
    } catch {
      toast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKey = async (provider: string, apiKey: string) => {
    const res = await fetch("/api/settings/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    if (!res.ok) {
      toast("Failed to save API key", "error");
      throw new Error("Failed to save");
    }
    toast("API key saved", "success");
    // Refresh providers list
    const provRes = await fetch("/api/settings/providers");
    if (provRes.ok) {
      const data = await provRes.json();
      setProviders(data.providers || []);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    const res = await fetch("/api/settings/providers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      toast("Failed to delete API key", "error");
      return;
    }
    toast("API key removed", "info");
    setProviders((prev) => prev.filter((p) => p.provider !== provider));
  };

  const handleVerifyKey = async (provider: string) => {
    const res = await fetch("/api/settings/providers/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      return { valid: false, message: "Verification failed" };
    }
    return res.json();
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
          knowledgeBases={knowledgeBases}
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
            <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/ankushchhabra02/vortex"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700 mr-2"
            >
              <Github size={18} />
              <span className="text-sm font-medium hidden sm:inline">GitHub</span>
            </a>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save Changes
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="text-zinc-500 animate-spin" />
              </div>
            ) : settings ? (
              <>
                {/* AI Provider */}
                <section>
                  <h3 className="text-base font-semibold text-zinc-200 mb-4">
                    AI Provider
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <ProviderSelector
                      provider={settings.llm_provider}
                      model={settings.llm_model}
                      temperature={settings.temperature}
                      onProviderChange={(v) => updateSettings("llm_provider", v)}
                      onModelChange={(v) => updateSettings("llm_model", v)}
                      onTemperatureChange={(v) => updateSettings("temperature", v)}
                      configuredProviders={providers.map((p) => p.provider)}
                    />
                  </div>
                </section>

                {/* API Keys */}
                <section>
                  <h3 className="text-base font-semibold text-zinc-200 mb-4">
                    API Keys
                  </h3>
                  <APIKeyManager
                    providers={providers}
                    onSave={handleSaveKey}
                    onDelete={handleDeleteKey}
                    onVerify={handleVerifyKey}
                  />
                </section>

                {/* Embedding Model */}
                <section>
                  <h3 className="text-base font-semibold text-zinc-200 mb-4">
                    Default Embedding Model
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <EmbeddingSelector
                      provider={settings.embedding_provider}
                      model={settings.embedding_model}
                      onProviderChange={(v) =>
                        updateSettings("embedding_provider", v)
                      }
                      onModelChange={(v) =>
                        updateSettings("embedding_model", v)
                      }
                    />
                  </div>
                </section>

                {/* Profile */}
                <section>
                  <h3 className="text-base font-semibold text-zinc-200 mb-4">
                    Profile
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-medium">
                        {user?.email?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {user?.email || "Unknown"}
                        </p>
                        <p className="text-xs text-zinc-500">Logged in</p>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="text-center py-20 text-zinc-500">
                Failed to load settings
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
