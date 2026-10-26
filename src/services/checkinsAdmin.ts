import type { CheckIn, Winner } from "../types/guestbook";
import { getSupabase } from "./supabase";

export const PAGE = 1000;

// PostgREST caps responses at 1,000 rows. Pages are read oldest first so rows that
// arrive while paging append at the end instead of shifting earlier pages; the
// loop stops on an empty page and the result is reversed to newest first.
export async function fetchAllCheckIns(): Promise<CheckIn[]> {
  const rows: CheckIn[] = [];
  for (let offset = 0; ; ) {
    const { data, error } = await getSupabase()
      .from("guestbook_checkins")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as CheckIn[];
    if (page.length === 0) break;
    rows.push(...page);
    offset += page.length;
  }
  return rows.reverse();
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


// Check one attendee out now (server time), or undo it. Returns the stored time.
export async function adminCheckOut(checkinId: string, undo = false): Promise<string | null> {
  const { data, error } = await getSupabase().rpc("guestbook_admin_check_out", { p_checkin_id: checkinId, p_undo: undo });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

// Closing time: check out everyone still present. Returns how many.
export async function checkOutAll(): Promise<number> {
  const { data, error } = await getSupabase().rpc("guestbook_check_out_all");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
