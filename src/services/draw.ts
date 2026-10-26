import type { CheckIn, Winner } from "../types/guestbook";
import { getSupabase } from "./supabase";

export type DrawResult =
  | { status: "empty" }
  | {
      status: "drawn";
      winner: Pick<Winner, "id" | "checkin_id" | "prize" | "drawn_at">;
      checkin: Pick<CheckIn, "id" | "name" | "jabatan" | "phone" | "email">;
    };

// Atomic server-side draw; the database never picks the same attendee twice.
export async function drawWinner(prize: string): Promise<DrawResult> {
  const { data, error } = await getSupabase().rpc("guestbook_draw_winner", { p_prize: prize });
  if (error) throw new Error(error.message);
  return data as DrawResult;
}

export async function removeWinner(id: string): Promise<void> {
  const { error } = await getSupabase().from("guestbook_draw_winners").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
