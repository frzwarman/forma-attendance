import { useQuery } from "@tanstack/react-query";
import { formatWib } from "../domain/time";
import { getSingleRow } from "./rest";

// The session under way: the latest one an admin started with Mulai Sesi 1 or Mulai Sesi 2 (Daftar
// Check-in), or null before the first. It runs until the next, past midnight too
// (supabase/migrations/20261109000000_guestbook_sessions.sql).
export type EventSession = { label: "Sesi 1" | "Sesi 2"; started_at: string };
export const SESSION_LABELS: EventSession["label"][] = ["Sesi 1", "Sesi 2"];

export const fetchCurrentSession = () => getSingleRow<EventSession>("guestbook_sessions", "order=started_at.desc&limit=1");

// staleTime 0: whenever the page is looked at again (visibilitychange), it asks again, so a session
// started meanwhile shows.
export const useCurrentSession = (refetchInterval?: number) =>
  useQuery({ queryKey: ["session"], queryFn: fetchCurrentSession, staleTime: 0, refetchInterval });

// The sheet tab of a session started at that time: "02-11-2026 Sesi 2", the WIB day it started.
export const sessionTab = (label: string, startedAt: string) => `${formatWib(startedAt).slice(0, 10).replace(/\//g, "-")} ${label}`;

// A check-in made at or after the session's start belongs to it.
export const inSession = (at: string, session: EventSession | null | undefined) => !session || Date.parse(at) >= Date.parse(session.started_at);
