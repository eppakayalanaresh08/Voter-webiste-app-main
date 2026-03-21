import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export async function supabaseServer() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are missing. Please check your .env file.');
  }

  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { 
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (url, options) => {
            // Add a 60-second timeout to the fetch call
            return fetch(url, { 
              ...options, 
              next: { revalidate: 0 },
              signal: AbortSignal.timeout(60000)
            });
          }
        }
      }
    );
  }

  return supabase;
}
