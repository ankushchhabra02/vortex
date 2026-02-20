import { NextRequest, NextResponse } from 'next/server';
import { modelsLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

let cachedModels: { data: { id: string; name: string; contextWindow: number | null; free: boolean }[]; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const rl = modelsLimiter.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.resetMs);

  const search = req.nextUrl.searchParams.get('q')?.toLowerCase() || '';

  try {
    // Return cached if fresh
    if (cachedModels && Date.now() - cachedModels.timestamp < CACHE_TTL) {
      const filtered = search
        ? cachedModels.data.filter(
          (m) =>
            m.id.toLowerCase().includes(search) ||
            m.name.toLowerCase().includes(search)
        )
        : cachedModels.data;
      return NextResponse.json({ models: filtered });
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 502 });
    }

    const json = await res.json();
    const models = (json.data || [])
      .map((m: OpenRouterModel) => {
        const promptPrice = parseFloat(m.pricing?.prompt || '0');
        const isFree = promptPrice === 0;
        return {
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.context_length || null,
          free: isFree,
        };
      })
      .sort((a: { id: string; name: string; free: boolean }, b: { id: string; name: string; free: boolean }) => {
        // Priority order: major providers first, then free, then alphabetical
        const providerOrder = [
          'openai/',
          'anthropic/',
          'google/',
          'meta-llama/',
          'x-ai/',
          'mistralai/',
          'deepseek/',
          'qwen/',
        ];

        const getProviderRank = (id: string) => {
          const idx = providerOrder.findIndex((p) => id.startsWith(p));
          return idx === -1 ? providerOrder.length : idx;
        };

        const rankA = getProviderRank(a.id);
        const rankB = getProviderRank(b.id);

        if (rankA !== rankB) return rankA - rankB;
        if (a.free && !b.free) return -1;
        if (!a.free && b.free) return 1;
        return a.name.localeCompare(b.name);
      });

    cachedModels = { data: models, timestamp: Date.now() };

    const filtered = search
      ? models.filter(
        (m: { id: string; name: string }) =>
          m.id.toLowerCase().includes(search) ||
          m.name.toLowerCase().includes(search)
      )
      : models;

    return NextResponse.json({ models: filtered });
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
