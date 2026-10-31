import { callFunction } from "./rest";

// Check-ins made on this phone, so the attendee can check out with one tap later.
const KEY = "guestbook.checkouts";
export type StoredCheckIn = { token: string; name: string; at: string };

export function storedCheckIns(): StoredCheckIn[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((entry) => typeof entry?.token === "string" && typeof entry?.name === "string" && typeof entry?.at === "string")
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
