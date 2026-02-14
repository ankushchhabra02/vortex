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

        if (url) {
            const loader = new CheerioWebBaseLoader(url);
            docs = await loader.load();
        } else if (file) {
            if (file.name.endsWith(".pdf")) {
                const arrayBuffer = await file.arrayBuffer();
                const blob = new Blob([arrayBuffer]);
                const loader = new PDFLoader(blob);
                docs = await loader.load();
            } else {
                const text = await file.text();
                docs = [new Document({ pageContent: text, metadata: { source: file.name } })];
            }
        } else {
            return NextResponse.json({ error: "No URL or file provided" }, { status: 400 });
        }

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const splitDocs = await splitter.splitDocuments(docs);

        await ragService.addDocuments(splitDocs);

        return NextResponse.json({ success: true, count: splitDocs.length });
    } catch (error) {
        console.error("Ingestion error:", error);
        return NextResponse.json({ error: "Failed to ingest content" }, { status: 500 });
    }
}
