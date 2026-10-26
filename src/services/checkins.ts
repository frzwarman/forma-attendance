import { useQuery } from "@tanstack/react-query";
import type { CheckInInput } from "../domain/checkin";
import type { CheckIn, CheckInResult, Winner } from "../types/guestbook";
import { getSupabase } from "./supabase";

export type CheckInExtra = {
  file_path: string | null;
  honeypot: string;
  latitude: number | null;
  longitude: number | null;
};

// The only write path for attendees: the security-definer RPC.
export async function submitCheckIn(input: CheckInInput, extra: CheckInExtra): Promise<CheckInResult> {
  const { data, error } = await getSupabase().rpc("guestbook_check_in", {
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_jabatan: input.jabatan,
    p_address: input.address,
    p_latitude: extra.latitude,
    p_longitude: extra.longitude,
    p_file_path: extra.file_path,
    p_check_in_date: input.check_in_date,
    p_check_out_date: input.check_out_date,
    p_honeypot: extra.honeypot || null,
  });
  if (error) throw new Error(error.message);
  return data as CheckInResult;
}

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

export const useCheckIns = () =>
  useQuery({ queryKey: ["checkins"], queryFn: fetchAllCheckIns, refetchInterval: 10_000 });
export const useWinners = () =>
  useQuery({ queryKey: ["winners"], queryFn: fetchWinners, refetchInterval: 10_000 });
