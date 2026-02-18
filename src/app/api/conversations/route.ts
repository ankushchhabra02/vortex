import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const knowledgeBaseId = req.nextUrl.searchParams.get("knowledgeBaseId");

  let query = supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (knowledgeBaseId) {
    query = query.eq("knowledge_base_id", knowledgeBaseId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}
