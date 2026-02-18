"use client";

import { EMBEDDING_PROVIDERS } from "@/lib/providers/types";
import type { EmbeddingProvider } from "@/lib/providers/types";

interface EmbeddingSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}

export function EmbeddingSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: EmbeddingSelectorProps) {
  const handleProviderChange = (newProvider: string) => {
    onProviderChange(newProvider);
    const models = EMBEDDING_PROVIDERS[newProvider as EmbeddingProvider]?.models;
    if (models?.length) {
      onModelChange(models[0].id);
    }
  };

  const currentModels = EMBEDDING_PROVIDERS[provider as EmbeddingProvider]?.models || [];
  const currentModel = currentModels.find((m) => m.id === model);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Embedding Provider
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(EMBEDDING_PROVIDERS).map(([key, info]) => (
            <button
              key={key}
              onClick={() => handleProviderChange(key)}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left ${
                provider === key
                  ? "bg-blue-600/10 border-blue-500 text-blue-400"
                  : "bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <div>{info.name}</div>
              {!info.requiresKey && (
                <span className="text-[10px] text-green-400">No API key needed</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Model
        </label>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
        >
          {currentModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.dimensions}d){m.free ? " - Free" : ""}
            </option>
          ))}
        </select>
      </div>

      {currentModel && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
          <div className="text-xs text-zinc-400 space-y-1">
            <div>
              <span className="text-zinc-500">Dimensions:</span>{" "}
              {currentModel.dimensions}
            </div>
            <div>
              <span className="text-zinc-500">Cost:</span>{" "}
              {currentModel.free ? "Free (runs locally)" : "API costs apply"}
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-500">
        This setting applies to new knowledge bases only. Existing KBs keep their
        original embedding model.
      </p>
    </div>
  );
}
