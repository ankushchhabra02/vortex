import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generalLimiter, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select('id, title, knowledge_base_id, updated_at, knowledge_bases(name)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching recent conversations:', error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    const formatted = (conversations || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      knowledge_base_id: c.knowledge_base_id,
      kb_name: c.knowledge_bases?.name || 'Unknown',
      updated_at: c.updated_at,
    }));

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    console.error('Error fetching recent conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
