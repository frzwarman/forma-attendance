import type { CheckIn, Winner } from "../types/guestbook";
import { getSupabase } from "./supabase";

export const PAGE = 1000;

// PostgREST caps responses at 1,000 rows; page until a short page arrives.
export async function fetchAllCheckIns(): Promise<CheckIn[]> {
  const rows: CheckIn[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await getSupabase()
      .from("guestbook_checkins")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as CheckIn[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function fetchWinners(): Promise<Winner[]> {
  const { data, error } = await getSupabase()
    .from("guestbook_draw_winners")
    .select("*")
    .order("drawn_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Winner[];
}

export async function signedFileUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from("guestbook-uploads").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

