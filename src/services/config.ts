// Only these two public values reach the browser; see .env.example.
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
export const CONFIG_ERROR =
  "Konfigurasi Supabase belum diisi: EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";
export const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
export const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
