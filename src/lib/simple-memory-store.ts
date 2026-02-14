
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

interface MemoryVector {
    content: string;
    embedding: number[];
    metadata: Record<string, any>;
}

export class MemoryVectorStore extends VectorStore {
    memoryVectors: MemoryVector[] = [];

    _vectorstoreType(): string {
        return "memory";
    }

    constructor(embeddings: Embeddings) {
        super(embeddings, {});
    }

    async addDocuments(documents: Document[]): Promise<void> {
        const texts = documents.map(({ pageContent }) => pageContent);
        const embeddings = await this.embeddings.embedDocuments(texts);
        for (let i = 0; i < documents.length; i++) {
            this.memoryVectors.push({
                content: documents[i].pageContent,
                embedding: embeddings[i],
                metadata: documents[i].metadata,
            });
        }
    }

    async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
        for (let i = 0; i < documents.length; i++) {
            this.memoryVectors.push({
                content: documents[i].pageContent,
                embedding: vectors[i],
                metadata: documents[i].metadata,
            });
        }
    }

    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const results: { similarity: number; doc: Document }[] = [];

        for (const vector of this.memoryVectors) {
            const similarity = cosineSimilarity(query, vector.embedding);
            results.push({
                similarity,
                doc: new Document({
                    pageContent: vector.content,
                    metadata: vector.metadata,
                }),
            });
        }

        results.sort((a, b) => b.similarity - a.similarity);

        return results.slice(0, k).map((result) => [result.doc, result.similarity]);
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
