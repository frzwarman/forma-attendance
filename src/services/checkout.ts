// Check-ins made on this phone, so it opens on the checked-in page. The key and the token (the
// check-out code) date from when attendees checked themselves out.
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
    /* storage unavailable: the phone opens on the form, which checks the attendee in again */
  }
}

export const rememberCheckIn = (entry: StoredCheckIn) =>
  save([...storedCheckIns().filter((stored) => stored.token !== entry.token), entry]);
// A repeat check-in comes without a code; it moves this person's time on instead.
export const refreshCheckIn = (name: string, at: string) =>
  save(storedCheckIns().map((stored) => (stored.name === name ? { ...stored, at } : stored)));
