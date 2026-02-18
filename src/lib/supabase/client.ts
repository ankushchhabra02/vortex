import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';

let _supabase: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Lazy singleton - only created when first accessed (not during SSR/build)
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient();
    }
    return (_supabase as any)[prop];
  },
});
