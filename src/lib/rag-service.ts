
import { MemoryVectorStore } from "@/lib/simple-memory-store";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { Document } from "@langchain/core/documents";

class RAGService {
    private static instance: RAGService;
    private vectorStore: MemoryVectorStore | null = null;
    private embeddings: HuggingFaceTransformersEmbeddings | null = null;

    private constructor() { }

    public static getInstance(): RAGService {
        if (!RAGService.instance) {
            RAGService.instance = new RAGService();
        }
        return RAGService.instance;
    }

    public async init() {
        if (this.vectorStore) return;

        // Use a small, efficient model for local embeddings
        this.embeddings = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2",
        });

        this.vectorStore = new MemoryVectorStore(this.embeddings);
    }

    public async addDocuments(docs: Document[]) {
        if (!this.vectorStore) await this.init();
        await this.vectorStore?.addDocuments(docs);
    }

    public async search(query: string, k = 4): Promise<Document[]> {
        if (!this.vectorStore) await this.init();
        return (await this.vectorStore?.similaritySearch(query, k)) || [];
    }
}

export const ragService = RAGService.getInstance();
