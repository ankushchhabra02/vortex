import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { ragService } from "@/lib/rag-service-supabase";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const knowledgeBases = await ragService.getKnowledgeBases(user.id);
    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    console.error("Error fetching knowledge bases:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge bases" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    const id = await ragService.createKnowledgeBase(user.id, name.trim(), description?.trim());
    return NextResponse.json({ id, name: name.trim(), description: description?.trim() });
  } catch (error) {
    console.error("Error creating knowledge base:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge base" },
      { status: 500 }
    );
  }
}
