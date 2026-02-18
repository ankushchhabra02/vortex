import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const { id } = await params;

  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const msgLimit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)));
  const pageParam = req.nextUrl.searchParams.get("page");

  const { count } = await supabaseAdmin
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", id);

  const total = count ?? 0;

  let msgQuery = supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (pageParam) {
    const page = Math.max(1, parseInt(pageParam, 10));
    const offset = (page - 1) * msgLimit;
    msgQuery = msgQuery.range(offset, offset + msgLimit - 1);

    const { data: messages, error: msgError } = await msgQuery;
    if (msgError) {
      return NextResponse.json({ error: "Failed to fetch messages", code: "INTERNAL_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ conversation, messages: messages || [], total, page, limit: msgLimit });
  }

  // Default: return the most recent messages (backward compatible)
  const offset = Math.max(0, total - msgLimit);
  msgQuery = msgQuery.range(offset, offset + msgLimit - 1);

  const { data: messages, error: msgError } = await msgQuery;
  if (msgError) {
    return NextResponse.json({ error: "Failed to fetch messages", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ conversation, messages: messages || [], total });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const { id } = await params;
  const body = await req.json();
  const { title } = body;

  const { error } = await supabaseAdmin
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update conversation", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const { id } = await params;

  // Verify ownership
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Delete messages first (FK constraint)
  await supabaseAdmin.from("messages").delete().eq("conversation_id", id);

  // Delete conversation
  const { error } = await supabaseAdmin
    .from("conversations")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete conversation", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
