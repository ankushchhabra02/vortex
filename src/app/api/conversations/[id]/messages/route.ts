import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(
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
  const { role, content } = body;

  if (!role || !content) {
    return NextResponse.json(
      { error: "role and content are required" },
      { status: 400 }
    );
  }

  // Verify conversation ownership
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

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: id,
      role,
      content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save message", code: "INTERNAL_ERROR" }, { status: 500 });
  }

  // Update conversation timestamp
  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ message: data });
}
