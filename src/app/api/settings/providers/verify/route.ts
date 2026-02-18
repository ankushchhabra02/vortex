import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { decrypt } from '@/lib/providers/crypto';
import { verifyLimiter, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = verifyLimiter.check(user.id);
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  try {
    const { provider } = await req.json();

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from('user_providers')
      .select('api_key_encrypted')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (!data) {
      return NextResponse.json({ error: 'No API key found for this provider' }, { status: 404 });
    }

    let apiKey: string;
    try {
      apiKey = decrypt(data.api_key_encrypted);
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
    }

    let valid = false;
    let message = '';

    switch (provider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        valid = res.ok;
        message = valid ? 'OpenAI key is valid' : 'Invalid OpenAI API key';
        break;
      }
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        // 200 or 400 (bad request but auth worked) means valid key
        valid = res.status !== 401 && res.status !== 403;
        message = valid ? 'Anthropic key is valid' : 'Invalid Anthropic API key';
        break;
      }
      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        valid = res.ok;
        message = valid ? 'OpenRouter key is valid' : 'Invalid OpenRouter API key';
        break;
      }
      case 'xai': {
        const res = await fetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        valid = res.ok;
        message = valid ? 'xAI key is valid' : 'Invalid xAI API key';
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    return NextResponse.json({ valid, message });
  } catch (error) {
    console.error('Error verifying provider:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
