import type { Poll } from "../domain/evote";
import { getSupabase } from "./supabase";

// The vote under way, how many phones voted, and per option (in order) how many picked it.
export type PollResults = { poll: Poll | null; voters: number; counts: number[] };

// PostgREST names a function or table the database does not have: migration 20261111000000 is pending.
function failure(error: { code?: string; message: string }) {
  if (error.code === "PGRST202" || error.code === "PGRST205")
    return new Error("Database belum siap: E-Vote belum ada. Jalankan migrasi terbaru (npm run db:push).");
  return new Error(error.message);
}

export async function fetchPollResults(): Promise<PollResults> {
  const { data, error } = await getSupabase().rpc("guestbook_poll_results");
  if (error) throw failure(error);
  return data as PollResults;
}

// Simpan & buka voting: the same options carry on the vote (opened again), others start a new one.
export async function savePoll(options: string[], maxPicks: number): Promise<Poll> {
  const { data, error } = await getSupabase().rpc("guestbook_save_poll", { p_options: options, p_max_picks: maxPicks });
  if (error) throw failure(error);
  return data as Poll;
}

export async function closePoll(): Promise<Poll | null> {
  const { data, error } = await getSupabase().rpc("guestbook_close_poll");
  if (error) throw failure(error);
  return (data as Poll | null) ?? null;
}
