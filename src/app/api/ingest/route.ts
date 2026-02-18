import { NextRequest, NextResponse } from "next/server";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { ragService } from "@/lib/rag-service-supabase";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { decrypt } from "@/lib/providers/crypto";
import type { EmbeddingConfig } from "@/lib/providers/types";
import { getEmbeddingDimensions } from "@/lib/providers/types";
import { ingestLimiter, rateLimitResponse } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
];

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname === '0.0.0.0'
    ) {
      return process.env.NODE_ENV === 'development';
    }
    return true;
  } catch {
    return false;
  }
}

async function getKBEmbeddingConfig(kbId: string, userId: string): Promise<EmbeddingConfig | undefined> {
  const { data: kb } = await supabaseAdmin
    .from('knowledge_bases')
    .select('embedding_provider, embedding_model, embedding_dimensions')
    .eq('id', kbId)
    .single();

  if (!kb || kb.embedding_provider === 'xenova') {
    return undefined;
  }

  let apiKey = '';
  if (kb.embedding_provider === 'openai') {
    const { data: providerData } = await supabaseAdmin
      .from('user_providers')
      .select('api_key_encrypted')
      .eq('user_id', userId)
      .eq('provider', 'openai')
      .single();

    if (providerData) {
      try { apiKey = decrypt(providerData.api_key_encrypted); } catch { }
    }
  }

  return {
    provider: kb.embedding_provider as 'xenova' | 'openai',
    model: kb.embedding_model,
    dimensions: kb.embedding_dimensions || getEmbeddingDimensions(kb.embedding_provider as 'xenova' | 'openai', kb.embedding_model),
    apiKey,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = ingestLimiter.check(user.id);
    if (!rl.success) return rateLimitResponse(rl.resetMs);

    const userId = user.id;

    const formData = await req.formData();
    const url = formData.get("url") as string;
    const file = formData.get("file") as File;
    const knowledgeBaseId = formData.get("knowledgeBaseId") as string;

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: "Knowledge base ID is required" }, { status: 400 });
    }

    let docs: Document[] = [];
    const metadata = {
      title: '',
      sourceUrl: undefined as string | undefined,
      filePath: undefined as string | undefined,
      fileType: undefined as string | undefined,
    };

    if (url) {
      if (!isValidUrl(url)) {
        return NextResponse.json({ error: "Invalid or unsafe URL" }, { status: 400 });
      }

      try {
        const loader = new CheerioWebBaseLoader(url);
        docs = await loader.load();
        metadata.title = new URL(url).hostname;
        metadata.sourceUrl = url;
        metadata.fileType = 'url';
      } catch (error) {
        console.error("URL loading error:", error);
        return NextResponse.json({ error: "Failed to load content from URL" }, { status: 400 });
      }
    } else if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }

      if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: PDF, TXT, MD, HTML" },
          { status: 400 }
        );
      }

      try {
        if (file.name.endsWith(".pdf") || file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          const loader = new PDFLoader(blob);
          docs = await loader.load();
          metadata.fileType = 'pdf';
        } else {
          const text = await file.text();
          if (text.length > 1000000) {
            return NextResponse.json({ error: "File content too large" }, { status: 400 });
          }
          docs = [new Document({
            pageContent: text,
            metadata: { source: file.name }
          })];
          metadata.fileType = file.type;
        }
        metadata.title = file.name;
        metadata.filePath = file.name;
      } catch (error) {
        console.error("File processing error:", error);
        return NextResponse.json({ error: "Failed to process file" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "No URL or file provided" }, { status: 400 });
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: "No content extracted from source" }, { status: 400 });
    }

    const embeddingConfig = await getKBEmbeddingConfig(knowledgeBaseId, userId);

    const documentId = await ragService.addDocuments(
      userId,
      knowledgeBaseId,
      docs,
      metadata,
      embeddingConfig
    );

    return NextResponse.json({
      success: true,
      documentId,
      title: metadata.title,
      chunksCount: docs.length,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to ingest content", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
