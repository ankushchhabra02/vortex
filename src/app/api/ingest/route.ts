import { NextRequest, NextResponse } from "next/server";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { ragService } from "@/lib/rag-service";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const url = formData.get("url") as string;
        const file = formData.get("file") as File;

        let docs = [];

        console.log("Processing request...");

        if (url) {
            console.log("Processing URL:", url);
            const loader = new CheerioWebBaseLoader(url);
            docs = await loader.load();
        } else if (file) {
            console.log("Processing File:", file.name);

            if (file.name.endsWith(".pdf")) {
                const arrayBuffer = await file.arrayBuffer();
                const blob = new Blob([arrayBuffer]);
                const loader = new PDFLoader(blob);
                docs = await loader.load();
            } else {
                // Handle text/md files
                const text = await file.text();
                docs = [new Document({ pageContent: text, metadata: { source: file.name } })];
            }
        } else {
            return NextResponse.json({ error: "No URL or file provided" }, { status: 400 });
        }

        console.log(`Loaded ${docs.length} documents`);

        // Split text
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const splitDocs = await splitter.splitDocuments(docs);
        console.log(`Split into ${splitDocs.length} chunks`);

        // Add to vector store
        console.log("Adding to vector store...");
        await ragService.addDocuments(splitDocs);
        console.log("Added to vector store successfully");

        return NextResponse.json({ success: true, count: splitDocs.length });
    } catch (error) {
        console.error("Ingestion error:", error);
        return NextResponse.json({ error: "Failed to ingest content" }, { status: 500 });
    }
}
