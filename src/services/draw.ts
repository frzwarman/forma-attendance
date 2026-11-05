import type { WheelEntry } from "../types/guestbook";
import { getSupabase } from "./supabase";

export type SpinResult = { status: "empty" } | { status: "drawn"; entry: WheelEntry };

// PostgREST names a function or table the database does not have: the Undian migration is pending.
function failure(error: { code?: string; message: string }) {
  if (error.code === "PGRST202" || error.code === "PGRST205")
    return new Error("Database belum siap untuk Undian. Jalankan migrasi terbaru (npm run db:push).");
  return new Error(error.message);
}

// The whole list in file order, winners (won_at set) included.
export async function fetchWheel(): Promise<WheelEntry[]> {
  const { data, error } = await getSupabase().from("guestbook_wheel_entries").select("*").order("position");
  if (error) throw failure(error);
  return data as WheelEntry[];
}

// Replaces the list, winners included. Returns how many went in.
export async function importWheel(entries: { name: string; note: string }[]): Promise<number> {
  const { data, error } = await getSupabase().rpc("guestbook_wheel_import", { p_entries: entries });
  if (error) throw failure(error);
  return data as number;
}

// Atomic server-side draw among the entries still on the wheel; the database never picks one twice.
export async function spinWheel(prize: string): Promise<SpinResult> {
  const { data, error } = await getSupabase().rpc("guestbook_wheel_spin", { p_prize: prize });
  if (error) throw failure(error);
  return data as SpinResult;
}

export async function returnToWheel(id: string): Promise<void> {
  const { error } = await getSupabase().from("guestbook_wheel_entries").update({ won_at: null, prize: "" }).eq("id", id);
  if (error) throw failure(error);
}

// Hapus on the participant list: the name leaves the list for good (an upload brings it back).
export async function removeFromWheel(id: string): Promise<void> {
  const { error } = await getSupabase().from("guestbook_wheel_entries").delete().eq("id", id);
  if (error) throw failure(error);
}
