import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/providers/crypto';
import { generalLimiter, rateLimitResponse } from '@/lib/rate-limit';
import { validateBody, providerSaveSchema, providerDeleteSchema } from '@/lib/validations';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    const { data: providers } = await supabaseAdmin
      .from('user_providers')
      .select('id, provider, is_active, api_key_encrypted, created_at')
      .eq('user_id', user.id);

    const safe = (providers || []).map((p) => {
      let lastFour = '';
      try {
        const key = decrypt(p.api_key_encrypted);
        lastFour = key.slice(-4);
      } catch (e) {
        console.error('[providers] Decrypt error:', e);
      }
      return {
        id: p.id,
        provider: p.provider,
        is_active: p.is_active,
        has_key: true,
        key_hint: lastFour ? `****${lastFour}` : '****',
        created_at: p.created_at,
      };
    });

    return NextResponse.json({ providers: safe });
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    const body = await req.json();
    const validation = validateBody(providerSaveSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { provider, api_key } = validation.data;

    const encrypted = encrypt(api_key);

    const { error } = await supabaseAdmin
      .from('user_providers')
      .upsert(
        {
          user_id: user.id,
          provider,
          api_key_encrypted: encrypted,
          is_active: false,
        },
        { onConflict: 'user_id,provider' }
      );

    if (error) {
      console.error('Error saving provider:', error);
      return NextResponse.json({ error: 'Failed to save provider' }, { status: 500 });
    }

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error('Error saving provider:', error);
    return NextResponse.json({ error: 'Failed to save provider' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = generalLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    const body = await req.json();
    const validation = validateBody(providerDeleteSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { provider } = validation.data;

    await supabaseAdmin
      .from('user_providers')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider:', error);
    return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
  }
}
