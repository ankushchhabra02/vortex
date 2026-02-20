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

  const now = new Date().toISOString();

  // Soft delete the KB and related records
  const { error } = await supabaseAdmin
    .from('knowledge_bases')
    .update({ deleted_at: now })
    .eq('id', id);

  if (error) {
    console.error("Error deleting knowledge base:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  // Soft delete related documents and conversations
  await supabaseAdmin
    .from('documents')
    .update({ deleted_at: now })
    .eq('knowledge_base_id', id);
  await supabaseAdmin
    .from('conversations')
    .update({ deleted_at: now })
    .eq('knowledge_base_id', id);

  return NextResponse.json({ success: true });
}
