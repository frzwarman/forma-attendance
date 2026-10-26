const wib = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatWib(iso: string): string {
  const parts = wib.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} WIB`;
}

const dayMonth = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const parse = (date: string) => new Date(`${date}T00:00:00Z`);

// "2–4 Nov 2026", "30 Des 2026 – 2 Jan 2027", or a single day.
export function formatDateRange(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  if (start === end) return full.format(a);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${a.getUTCDate()}–${full.format(b)}`;
  if (start.slice(0, 4) === end.slice(0, 4)) return `${dayMonth.format(a)} – ${full.format(b)}`;
  return `${full.format(a)} – ${full.format(b)}`;
}
