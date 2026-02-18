import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";

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

  // Verify ownership before deleting
  const { data: kb } = await supabaseAdmin
    .from('knowledge_bases')
    .select()
    .eq('id', id)
    .single();

  if (!kb || kb.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // CASCADE delete will remove documents and chunks
  const { error } = await supabaseAdmin
    .from('knowledge_bases')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting knowledge base:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
