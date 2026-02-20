import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generalLimiter, rateLimitResponse } from '@/lib/rate-limit';
import { validateBody, settingsUpdateSchema } from '@/lib/validations';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    let { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!settings) {
      const { data: created } = await supabaseAdmin
        .from('user_settings')
        .insert({ user_id: user.id })
        .select()
        .single();
      settings = created;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    const body = await req.json();
    const validation = validateBody(settingsUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const updates = validation.data;

    // Ensure settings row exists
    const { data: existing } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      await supabaseAdmin
        .from('user_settings')
        .insert({ user_id: user.id, ...updates });
    } else {
      await supabaseAdmin
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);
    }

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
