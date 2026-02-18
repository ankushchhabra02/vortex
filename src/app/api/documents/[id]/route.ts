import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { ragService } from "@/lib/rag-service-supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generalLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const { id } = await params;

  try {
    // Verify the document belongs to a KB owned by this user
    const supabase = await createServerSupabaseClient();
    const { data: doc } = await supabase
      .from("documents")
      .select("id, knowledge_base_id, knowledge_bases!inner(user_id)")
      .eq("id", id)
      .single();

    interface DocWithUser {
      knowledge_bases: { user_id: string };
    }

    if (!doc || (doc as unknown as DocWithUser).knowledge_bases?.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await ragService.deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
