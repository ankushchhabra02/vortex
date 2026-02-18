import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEmbeddingDimensions } from "@/lib/providers/types";
import type { EmbeddingProvider } from "@/lib/providers/types";
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    const { count } = await supabaseAdmin
      .from('knowledge_bases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { data: knowledgeBases, error } = await supabaseAdmin
      .from('knowledge_bases')
      .select('*, documents(count), conversations(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch knowledge bases" }, { status: 500 });
    }

    interface KBWithCounts {
      documents: { count: number }[];
      conversations: { count: number }[];
    }

    const formatted = (knowledgeBases || []).map((kb) => {
      const kbc = kb as unknown as KBWithCounts;
      return {
        ...kb,
        doc_count: kbc.documents?.[0]?.count ?? 0,
        conversation_count: kbc.conversations?.[0]?.count ?? 0,
        documents: undefined,
        conversations: undefined,
      };
    });

    return NextResponse.json({ knowledgeBases: formatted, total: count ?? 0, page, limit });
  } catch {
    return NextResponse.json({ error: "Failed to fetch knowledge bases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl2 = generalLimiter.check(user.id);
  if (!rl2.success) return rateLimitResponse(rl2.resetMs);

  try {
    const { name, description, embedding_provider, embedding_model } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    let embProvider = embedding_provider || 'xenova';
    let embModel = embedding_model || 'Xenova/all-MiniLM-L6-v2';

    if (!embedding_provider) {
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('embedding_provider, embedding_model')
        .eq('user_id', user.id)
        .single();

      if (settings) {
        embProvider = settings.embedding_provider;
        embModel = settings.embedding_model;
      }
    }

    const dimensions = getEmbeddingDimensions(embProvider as EmbeddingProvider, embModel);

    const { data, error } = await supabaseAdmin
      .from('knowledge_bases')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        embedding_provider: embProvider,
        embedding_model: embModel,
        embedding_dimensions: dimensions,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating knowledge base:", error);
      return NextResponse.json({ error: "Failed to create knowledge base" }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      description: data.description,
      embedding_provider: data.embedding_provider,
      embedding_model: data.embedding_model,
      embedding_dimensions: data.embedding_dimensions,
    });
  } catch (error) {
    console.error("Error creating knowledge base:", error);
    return NextResponse.json({ error: "Failed to create knowledge base" }, { status: 500 });
  }
}
