
import { MemoryVectorStore } from "@/lib/simple-memory-store";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

// Simple deterministic embeddings to avoid onnxruntime issues
class SimpleEmbeddings extends Embeddings {
    constructor() {
        super({});
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        return texts.map(text => this.createEmbedding(text));
    }

    async embedQuery(document: string): Promise<number[]> {
        return this.createEmbedding(document);
    }

    private createEmbedding(text: string): number[] {
        // Create a simple 384-dimensional embedding using character codes and position
        const embedding = new Array(384).fill(0);
        const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

        for (let i = 0; i < normalized.length; i++) {
            const charCode = normalized.charCodeAt(i);
            const idx = (charCode * (i + 1)) % 384;
            embedding[idx] += Math.sin(charCode + i) * 0.1;
        }

        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
    }
}

// Use globalThis to persist across Next.js hot reloads and API route invocations
declare global {
    var __ragVectorStore: MemoryVectorStore | undefined;
    var __ragEmbeddings: SimpleEmbeddings | undefined;
}

class RAGService {
    private static instance: RAGService;

    private constructor() { }

    public static getInstance(): RAGService {
        if (!RAGService.instance) {
            RAGService.instance = new RAGService();
        }
        return RAGService.instance;
    }

    private getVectorStore(): MemoryVectorStore {
        if (!globalThis.__ragEmbeddings) {
            globalThis.__ragEmbeddings = new SimpleEmbeddings();
        }
        if (!globalThis.__ragVectorStore) {
            globalThis.__ragVectorStore = new MemoryVectorStore(globalThis.__ragEmbeddings);
        }
        return globalThis.__ragVectorStore;
    }

    public async addDocuments(docs: Document[]) {
        const vectorStore = this.getVectorStore();
        await vectorStore.addDocuments(docs);
    }

    public async search(query: string, k = 4): Promise<Document[]> {
        const vectorStore = this.getVectorStore();
        return (await vectorStore.similaritySearch(query, k)) || [];
    }
}

export const ragService = RAGService.getInstance();
