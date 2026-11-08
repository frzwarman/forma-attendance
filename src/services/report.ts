import type { Poll } from "../domain/evote";
import type { Feedback } from "../types/guestbook";
import { getSupabase } from "./supabase";

// Laporan reads what the other admin pages do not: every message and every vote held.
export async function fetchFeedback(): Promise<Feedback[]> {
  const { data, error } = await getSupabase().from("guestbook_feedback").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Feedback[];
}

// Every poll, newest first, with how many phones voted and the count per option.
export type PollHistory = { poll: Poll; voters: number; counts: number[] };

// 20261120000000_guestbook_poll_history.sql.
export async function fetchPollHistory(): Promise<PollHistory[]> {
  const { data, error } = await getSupabase().rpc("guestbook_poll_history");
  if (error) {
    if (error.code === "PGRST202") throw new Error("Database belum siap untuk Laporan. Jalankan migrasi terbaru (npm run db:push).");
    throw new Error(error.message);
  }
  return (data ?? []) as PollHistory[];
}
