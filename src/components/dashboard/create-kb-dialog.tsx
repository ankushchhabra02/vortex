"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { EMBEDDING_PROVIDERS } from "@/lib/providers/types";
import type { EmbeddingProvider } from "@/lib/providers/types";

interface CreateKBDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description: string;
    embedding_provider: string;
    embedding_model: string;
  }) => void;
  currentEmbeddingProvider?: string;
  currentEmbeddingModel?: string;
}

export function CreateKBDialog({
  open,
  onClose,
  onCreate,
  currentEmbeddingProvider = "xenova",
  currentEmbeddingModel = "Xenova/all-MiniLM-L6-v2",
}: CreateKBDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [embProvider, setEmbProvider] = useState(currentEmbeddingProvider);
  const [embModel, setEmbModel] = useState(currentEmbeddingModel);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim(),
      embedding_provider: embProvider,
      embedding_model: embModel,
    });
    setName("");
    setDescription("");
    onClose();
  };

  const handleProviderChange = (provider: string) => {
    setEmbProvider(provider);
    const models = EMBEDDING_PROVIDERS[provider as EmbeddingProvider]?.models;
    if (models?.length) {
      setEmbModel(models[0].id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">
            Create Knowledge Base
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Research Papers"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this knowledge base is about..."
              rows={2}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Embedding Model
            </label>
            <select
              value={embProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors mb-2"
            >
              {Object.entries(EMBEDDING_PROVIDERS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.name}
                </option>
              ))}
            </select>
            <select
              value={embModel}
              onChange={(e) => setEmbModel(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
            >
              {EMBEDDING_PROVIDERS[embProvider as EmbeddingProvider]?.models.map(
                (model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.dimensions}d)
                    {model.free ? " - Free" : ""}
                  </option>
                )
              )}
            </select>
            <p className="text-[10px] text-zinc-500 mt-1.5">
              Cannot be changed after creation. All documents in this KB will use this embedding model.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
