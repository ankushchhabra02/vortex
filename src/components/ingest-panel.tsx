"use client";

import { useState } from "react";
import { Link as LinkIcon, FileText, Upload, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function IngestPanel() {
    const [url, setUrl] = useState("");
    const [isIngesting, setIsIngesting] = useState(false);
    const [items, setItems] = useState<{ type: "url" | "file"; name: string; id: string }[]>([]);

    const handleUrlSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || isIngesting) return;

        setIsIngesting(true);
        try {
            const formData = new FormData();
            formData.append("url", url);

            const res = await fetch("/api/ingest", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Failed to ingest URL");

            await res.json();
            setItems((prev) => [...prev, { type: "url", name: url, id: Date.now().toString() }]);
            setUrl("");
        } catch (error) {
            console.error(error);
            alert("Failed to ingest URL");
        } finally {
            setIsIngesting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsIngesting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/ingest", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Failed to upload file");

            setItems((prev) => [...prev, { type: "file", name: file.name, id: Date.now().toString() }]);
            e.target.value = ""; // Reset input
        } catch (error) {
            console.error(error);
            alert("Failed to upload file");
        } finally {
            setIsIngesting(false);
        }
    };

    return (
        <div className="w-80 border-r border-neutral-800 bg-neutral-900 flex flex-col h-full">
            <div className="p-4 border-b border-neutral-800">
                <h2 className="text-lg font-semibold text-white mb-2">Knowledge Base</h2>
                <p className="text-xs text-neutral-400">Add content for Vortex to learn.</p>
            </div>

            <div className="p-4 border-b border-neutral-800 space-y-4">
                {/* URL Input */}
                <form onSubmit={handleUrlSubmit} className="space-y-2">
                    <label className="text-xs font-medium text-neutral-300 flex items-center gap-2">
                        <LinkIcon size={14} /> Add Website
                    </label>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="https://..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isIngesting}
                        />
                        <button
                            disabled={isIngesting || !url}
                            type="submit"
                            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded p-1.5 transition-colors disabled:opacity-50"
                        >
                            <Plus size={16} className="text-blue-400" />
                        </button>
                    </div>
                </form>

                {/* File Upload */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-neutral-300 flex items-center gap-2">
                        <FileText size={14} /> Add Document
                    </label>
                    <label className="flex items-center justify-center w-full p-2 border border-dashed border-neutral-700 rounded bg-neutral-800/50 hover:bg-neutral-800/80 cursor-pointer transition-colors group">
                        <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} disabled={isIngesting} />
                        <div className="flex items-center gap-2 text-neutral-400 group-hover:text-blue-400 transition-colors">
                            <Upload size={14} />
                            <span className="text-xs">Upload PDF or Text</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded hover:bg-neutral-800 group">
                        <div className="flex items-center gap-2 overflow-hidden">
                            {item.type === "url" ? <LinkIcon size={14} className="text-blue-400 flex-shrink-0" /> : <FileText size={14} className="text-orange-400 flex-shrink-0" />}
                            <span className="text-xs text-neutral-300 truncate">{item.name}</span>
                        </div>
                        <button
                            onClick={() => setItems(items.filter(i => i.id !== item.id))}
                            className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="p-4 text-center">
                        <p className="text-xs text-neutral-500">No knowledge added yet.</p>
                    </div>
                )}
            </div>

            {/* Profile Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
                    <img
                        src="https://avatars.githubusercontent.com/u/245355885?v=4"
                        alt="Ankush"
                        className="w-16 h-16 rounded-full border border-neutral-700 p-0.5"
                    />
                    <div className="flex flex-col">
                        <span className="text-lg font-medium text-white">Ankush Chhabra</span>
                        <span className="text-sm text-neutral-500">xanny.me</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
