import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const knowledgeBaseId = req.nextUrl.searchParams.get("knowledgeBaseId");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  let countQuery = supabaseAdmin
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  let query = supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (knowledgeBaseId) {
    countQuery = countQuery.eq("knowledge_base_id", knowledgeBaseId);
    query = query.eq("knowledge_base_id", knowledgeBaseId);
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, query]);

  if (error) {
    return NextResponse.json({ error: "An unexpected error occurred", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ conversations: data || [], total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const body = await req.json();
  const { knowledgeBaseId, title } = body;

  if (!knowledgeBaseId) {
    return NextResponse.json(
      { error: "knowledgeBaseId is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: user.id,
      knowledge_base_id: knowledgeBaseId,
      title: title || "New Chat",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "An unexpected error occurred", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}
