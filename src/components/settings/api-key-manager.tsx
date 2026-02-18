"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, X, Loader2, Trash2, Shield } from "lucide-react";
import { LLM_PROVIDERS } from "@/lib/providers/types";

interface ProviderKey {
  provider: string;
  has_key: boolean;
  key_hint: string;
}

interface APIKeyManagerProps {
  providers: ProviderKey[];
  onSave: (provider: string, apiKey: string) => Promise<void>;
  onDelete: (provider: string) => Promise<void>;
  onVerify: (provider: string) => Promise<{ valid: boolean; message: string }>;
}

export function APIKeyManager({
  providers,
  onSave,
  onDelete,
  onVerify,
}: APIKeyManagerProps) {
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, { valid: boolean; message: string }>>({});

  const allProviders = Object.entries(LLM_PROVIDERS)
    .map(([key, info]) => {
      const existing = providers.find((p) => p.provider === key);
      let displayName = info.name;
      if (key === 'openrouter') displayName = "OpenRouter (Required for some LLMs)";
      if (key === 'google') displayName = "Google Gemini (Free tier available)";

      return {
        key,
        name: displayName,
        has_key: existing?.has_key || false,
        key_hint: existing?.key_hint || '',
      };
    })
    .sort((a, b) => {
      // Keep OpenRouter at top
      if (a.key === 'openrouter') return -1;
      if (b.key === 'openrouter') return 1;
      return a.name.localeCompare(b.name);
    });

  const handleSave = async (provider: string) => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await onSave(provider, keyInput.trim());
      setEditingProvider(null);
      setKeyInput("");
      setShowKey(false);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (provider: string) => {
    setVerifying(provider);
    try {
      const result = await onVerify(provider);
      setVerifyResult((prev) => ({ ...prev, [provider]: result }));
    } catch {
      setVerifyResult((prev) => ({
        ...prev,
        [provider]: { valid: false, message: "Verification failed" },
      }));
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="space-y-3">
      {allProviders.map((p) => (
        <div
          key={p.key}
          className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-200">{p.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {p.has_key && (
                <>
                  <span className="text-xs text-zinc-500">{p.key_hint}</span>
                  <button
                    onClick={() => handleVerify(p.key)}
                    disabled={verifying === p.key}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                  >
                    {verifying === p.key ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </button>
                  <button
                    onClick={() => onDelete(p.key)}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {verifyResult[p.key] && (
            <div
              className={`text-xs px-3 py-1.5 rounded mb-2 ${verifyResult[p.key].valid
                ? "bg-green-900/20 text-green-400 border border-green-800/30"
                : "bg-red-900/20 text-red-400 border border-red-800/30"
                }`}
            >
              {verifyResult[p.key].valid ? (
                <Check size={12} className="inline mr-1" />
              ) : (
                <X size={12} className="inline mr-1" />
              )}
              {verifyResult[p.key].message}
            </div>
          )}

          {editingProvider === p.key ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 pr-8 bg-zinc-900 border border-zinc-600 rounded-lg text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={() => handleSave(p.key)}
                disabled={saving || !keyInput.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingProvider(null);
                  setKeyInput("");
                  setShowKey(false);
                }}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingProvider(p.key);
                setKeyInput("");
                setVerifyResult((prev) => {
                  const next = { ...prev };
                  delete next[p.key];
                  return next;
                });
              }}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {p.has_key ? "Update Key" : "Add Key"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
