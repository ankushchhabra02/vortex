"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LLM_PROVIDERS } from "@/lib/providers/types";
import type { LLMProvider } from "@/lib/providers/types";
import { Search, Loader2, ChevronDown, X } from "lucide-react";

interface OpenRouterModel {
  id: string;
  name: string;
  contextWindow: number | null;
  free: boolean;
}

interface ProviderSelectorProps {
  provider: string;
  model: string;
  temperature: number;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onTemperatureChange: (temp: number) => void;
  configuredProviders: string[];
}

function OpenRouterModelPicker({
  model,
  onModelChange,
}: {
  model: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState(model);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchModels = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/models/openrouter${params}`);
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch {
      // Error handled by loading state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && models.length === 0) {
      fetchModels("");
    }
  }, [open, models.length, fetchModels]);

  useEffect(() => {
    const found = models.find((m) => m.id === model);
    if (found) {
      setSelectedName(found.name);
    }
  }, [models, model]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchModels(value);
    }, 300);
  };

  const handleSelect = (m: OpenRouterModel) => {
    onModelChange(m.id);
    setSelectedName(m.name);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm hover:border-zinc-600 transition-colors text-left"
      >
        <span className="truncate">
          {selectedName || model}
        </span>
        <ChevronDown
          size={14}
          className={`text-zinc-400 shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-80 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-zinc-700 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                autoFocus
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search models... (e.g. llama, gpt, claude)"
                className="w-full pl-8 pr-8 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    fetchModels("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="text-zinc-500 animate-spin" />
              </div>
            ) : models.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                No models found
              </div>
            ) : (
              models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-700/50 transition-colors ${m.id === model ? "bg-blue-600/10 border-l-2 border-blue-500" : "border-l-2 border-transparent"
                    }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-200 truncate">{m.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{m.id}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {m.contextWindow && (
                      <span className="text-[10px] text-zinc-500">
                        {(m.contextWindow / 1000).toFixed(0)}k
                      </span>
                    )}
                    {m.free && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/30">
                        Free
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {!loading && models.length > 0 && (
            <div className="px-3 py-1.5 border-t border-zinc-700 text-[10px] text-zinc-500 shrink-0">
              {models.length} models
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProviderSelector({
  provider,
  model,
  temperature,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  configuredProviders,
}: ProviderSelectorProps) {
  const handleProviderChange = (newProvider: string) => {
    onProviderChange(newProvider);
    if (newProvider === "openrouter") {
      onModelChange("openrouter/auto");
    } else {
      const models = LLM_PROVIDERS[newProvider as LLMProvider]?.models;
      if (models?.length) {
        onModelChange(models[0].id);
      }
    }
  };

  const currentModels = LLM_PROVIDERS[provider as LLMProvider]?.models || [];
  const isOpenRouter = provider === "openrouter";

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-3">
          AI Provider
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(LLM_PROVIDERS).map(([key, info]) => {
            const isActive = provider === key;
            const hasKey = configuredProviders.includes(key);
            return (
              <button
                key={key}
                onClick={() => handleProviderChange(key)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all ${isActive
                    ? "bg-blue-600/10 border-blue-500 text-blue-400"
                    : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600"
                  }`}
              >
                <span>{info.name}</span>
                {!info.requiresKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/30">
                    Free
                  </span>
                )}
                {info.requiresKey && hasKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/30">
                    Key set
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Model
        </label>
        {isOpenRouter ? (
          <OpenRouterModelPicker model={model} onModelChange={onModelChange} />
        ) : (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
          >
            {currentModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.free ? " (Free)" : ""}
                {m.contextWindow ? ` - ${(m.contextWindow / 1000).toFixed(0)}k ctx` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Temperature: {temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>
    </div>
  );
}
