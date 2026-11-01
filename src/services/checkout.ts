import { formatWib } from "../domain/time";
import { callFunction } from "./rest";

// Check-ins made on this phone, so the attendee can check out with one tap later.
const KEY = "guestbook.checkouts";
export type StoredCheckIn = { token: string; name: string; at: string };

// The current session's only: Sesi 1 before 12:00 WIB, Sesi 2 from 12:00, as in the sheet. The database
// checks everyone out at 12:00 and 23:59, so the phone then starts on the form again.
const session = (iso: string) => {
  const wib = formatWib(iso); // "01/11/2026 13:05 WIB"
  return `${wib.slice(0, 10)} ${wib.slice(11, 13) < "12" ? 1 : 2}`;
};
const thisSession = (at: string) => session(at) === session(new Date().toISOString());

export function storedCheckIns(): StoredCheckIn[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((entry) => typeof entry?.token === "string" && typeof entry?.name === "string" && typeof entry?.at === "string" && thisSession(entry.at))
      : [];
  } catch {
    return [];
  }
}

function save(entries: StoredCheckIn[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable: the organisers can still check this attendee out */
  }
}

// A repeat check-in brings a new code that replaces the person's earlier one.
export const rememberCheckIn = (entry: StoredCheckIn) =>
  save([...storedCheckIns().filter((stored) => stored.token !== entry.token && stored.name !== entry.name), entry]);
// A repeat check-in without a code (the name typed differs from the stored one) moves the time on.
export const refreshCheckIn = (name: string, at: string) =>
  save(storedCheckIns().map((stored) => (stored.name === name ? { ...stored, at } : stored)));
export const forgetCheckIn = (token: string) => save(storedCheckIns().filter((stored) => stored.token !== token));

export type CheckOutResult = { status: "checked_out" | "already"; name: string; checked_out_at: string };
export const checkOut = (token: string) => callFunction<CheckOutResult>("guestbook_check_out", { p_token: token });
// Kesan & Pesan, stored under the check-in this code belongs to (migration 20261106000000_guestbook_feedback.sql).
export const sendFeedback = (token: string, message: string) =>
  callFunction<{ status: "sent"; created_at: string }>("guestbook_send_feedback", { p_token: token, p_message: message });
