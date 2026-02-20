import { supabaseAdmin } from './server';

/**
 * Verify that a knowledge base belongs to the specified user.
 * Returns true if the user owns the KB, false otherwise.
 */
export async function verifyKBOwnership(
  userId: string,
  kbId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_bases')
    .select('id')
    .eq('id', kbId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}
