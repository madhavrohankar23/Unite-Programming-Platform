import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const AUTH_MODE: 'supabase' | 'local' =
  import.meta.env.VITE_AUTH_MODE === 'supabase' ? 'supabase' : 'local';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (AUTH_MODE !== 'supabase') return null;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set when VITE_AUTH_MODE=supabase',
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

