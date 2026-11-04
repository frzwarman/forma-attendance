import { useQuery } from "@tanstack/react-query";
import type { Poll } from "../domain/evote";
import { callFunction, getSingleRow } from "./rest";

// The vote under way (the latest poll an admin saved), or null before the first.
export const fetchCurrentPoll = () => getSingleRow<Poll>("guestbook_polls", "order=created_at.desc&limit=1");

// staleTime 0: asked again whenever the page is looked at; every 10 s too, so a page waiting for
// voting to open shows the options by itself.
export const useCurrentPoll = () => useQuery({ queryKey: ["poll"], queryFn: fetchCurrentPoll, staleTime: 0, refetchInterval: 10_000 });

// recorded / already (this phone voted in this poll before: its first picks); closed; changed (the
// admin started a new vote: load it). See supabase/migrations/20261111000000_guestbook_evote.sql.
export type BallotResult = { status: "recorded" | "already"; picks: number[] } | { status: "closed" | "changed" };
export const castBallot = (pollId: string, picks: number[]) =>
  callFunction<BallotResult>("guestbook_cast_ballot", { p_poll_id: pollId, p_device_id: deviceId(), p_picks: picks });

// This phone's E-Vote ID (16 random bytes as hex) and its picks per poll, so it votes once per vote.
const KEY = "guestbook.evote";
type Stored = { device: string; votes: Record<string, number[]> };
let memo: Stored | undefined;

function stored(): Stored {
  if (memo) return memo;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (typeof value?.device === "string" && /^[0-9a-f]{32}$/.test(value.device) && value.votes && typeof value.votes === "object")
      return (memo = { device: value.device, votes: value.votes });
  } catch {
    /* unreadable: start afresh */
  }
  memo = { device: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""), votes: {} };
  save(memo);
  return memo;
}

function save(value: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable: the ID lasts while the page is open, and the server still counts one ballot per ID */
  }
}

export const deviceId = () => stored().device;

export function storedBallot(pollId: string): number[] | undefined {
  const picks = stored().votes[pollId];
  return Array.isArray(picks) && picks.length > 0 && picks.every(Number.isInteger) ? picks : undefined;
}

export function rememberBallot(pollId: string, picks: number[]) {
  const value = stored();
  memo = { ...value, votes: { ...value.votes, [pollId]: picks } };
  save(memo);
}
