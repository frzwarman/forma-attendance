import { useQuery } from "@tanstack/react-query";
import { BAWASLU, isHexColor, type ThemeColors } from "../domain/theme";
import type { Settings } from "../types/guestbook";
import { getSupabase } from "./supabase";

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  event_name: "Buku Tamu",
  welcome_text: "Silakan isi data diri Anda untuk check-in.",
  logo_path: null,
  background_path: null,
  accent_color: BAWASLU.accent,
  background_color: BAWASLU.background,
  surface_color: BAWASLU.surface,
  text_color: BAWASLU.text,
  whatsapp_number: null,
  updated_at: "",
};

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await getSupabase().from("guestbook_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...DEFAULT_SETTINGS, ...(data as Settings) } : DEFAULT_SETTINGS;
}

export function useSettings() {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    placeholderData: DEFAULT_SETTINGS,
    staleTime: 60_000,
  });
  return { settings: query.data ?? DEFAULT_SETTINGS, isLoading: query.isLoading };
}

export function brandImageUrl(path: string | null): string | null {
  if (!path) return null;
  return getSupabase().storage.from("guestbook-brand").getPublicUrl(path).data.publicUrl;
}

// Any colour column that is not a six-digit hex falls back to the Bawaslu default.
export function settingsColors(settings: Settings): ThemeColors {
  const pick = (value: string, fallback: string) => (isHexColor(value) ? value.toLowerCase() : fallback);
  return {
    accent: pick(settings.accent_color, BAWASLU.accent),
    background: pick(settings.background_color, BAWASLU.background),
    surface: pick(settings.surface_color, BAWASLU.surface),
    text: pick(settings.text_color, BAWASLU.text),
  };
}
