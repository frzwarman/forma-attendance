import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG_ERROR, SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

// Admin pages only; the public page uses rest.ts so it never downloads this client.
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error(CONFIG_ERROR);
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
