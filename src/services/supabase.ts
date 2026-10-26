import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Only these two public values reach the browser; see .env.example.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export const CONFIG_ERROR =
  "Konfigurasi Supabase belum diisi: EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";
export const supabaseConfigured = () => Boolean(url && key);

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error(CONFIG_ERROR);
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
