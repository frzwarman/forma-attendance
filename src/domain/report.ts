// Laporan: the event's story from the database. The database keeps each person's first and latest check-in
// and how many there were, so attendance per session (every visit) comes from the Google Sheet's Check-in
// tab, which the admin can drop onto the page (parseSheetVisits).
import type { CheckIn } from "../types/guestbook";

export type Tally = { label: string; count: number }[];

const WIB_OFFSET_MS = 7 * 3600 * 1000;
const inWib = (iso: string) => new Date(Date.parse(iso) + WIB_OFFSET_MS);
// The Jakarta calendar day, "YYYY-MM-DD".
export const wibDay = (iso: string) => inWib(iso).toISOString().slice(0, 10);
export const wibHour = (iso: string) => inWib(iso).getUTCHours();

// The demo seed's rows (supabase/seed/demo-checkins.sql) use this reserved domain.
export const DEMO_DOMAIN = "@example.com";
export const isDemo = (row: Pick<CheckIn, "email">) => row.email.trim().toLowerCase().endsWith(DEMO_DOMAIN);
// Trial check-ins made while setting up: "test", "Peserta Uji 9276", "coba"... as whole words, so Fujianthy stays.
const TEST_NAME = /(^|[^\p{L}])(test|testing|tes|uji|dummy|coba|percobaan|contoh|demo)(?![\p{L}])/iu;
export const isTestRow = (row: Pick<CheckIn, "email" | "name">) => isDemo(row) || TEST_NAME.test(row.name);

// WIB days, inclusive; either end may be left open.
export type DateRange = { from?: string; to?: string };

// The attendees the report is about: no trial rows, first check-in within the range, in check-in order (so a
// tally keeps the spelling of whoever came first).
export function eventRows(checkins: CheckIn[], range: DateRange = {}): CheckIn[] {
  return checkins
    .filter((row) => {
      if (isTestRow(row)) return false;
      const day = wibDay(row.created_at);
      return (!range.from || day >= range.from) && (!range.to || day <= range.to);
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export type Summary = {
  attendees: number;
  // Every check-in, repeat visits included.
  visits: number;
  days: number;
  perPerson: number;
  checkedOut: number;
  rooms: number;
  files: number;
  firstDay: string | null;
  lastDay: string | null;
};

export function summary(rows: CheckIn[]): Summary {
  const visits = rows.reduce((sum, row) => sum + (row.checkin_count ?? 1), 0);
  const days = [...new Set(rows.flatMap((row) => [wibDay(row.created_at), ...(row.last_checked_in_at ? [wibDay(row.last_checked_in_at)] : [])]))].sort();
  return {
    attendees: rows.length,
    visits,
    days: days.length,
    perPerson: rows.length ? Math.round((visits / rows.length) * 10) / 10 : 0,
    checkedOut: rows.filter((row) => row.checked_out_at).length,
    rooms: rows.filter((row) => row.room_number).length,
    files: rows.filter((row) => row.file_path).length,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null,
  };
}

// First check-ins (new attendees) and latest check-ins per WIB day.
export function perDay(rows: CheckIn[]): { day: string; first: number; last: number }[] {
  const days = new Map<string, { first: number; last: number }>();
  const at = (day: string) => days.get(day) ?? days.set(day, { first: 0, last: 0 }).get(day)!;
  for (const row of rows) {
    at(wibDay(row.created_at)).first += 1;
    if (row.last_checked_in_at) at(wibDay(row.last_checked_in_at)).last += 1;
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, counts]) => ({ day, ...counts }));
}

// The check-ins the database keeps (first and latest), by WIB hour.
export function arrivalHours(rows: CheckIn[]): { hour: number; count: number }[] {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const row of rows) {
    hours[wibHour(row.created_at)].count += 1;
    if (row.last_checked_in_at) hours[wibHour(row.last_checked_in_at)].count += 1;
  }
  return hours;
}

// How a tally groups spellings: trimmed, single spaces, case ignored. The report filters by the same key.
export const tallyKey = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const key = tallyKey;

// Counts per distinct value, spellings differing only in case or spacing grouped under the first one seen,
// most common first. Blanks are dropped, or counted under blankLabel when given.
export function tally(values: (string | null | undefined)[], blankLabel?: string): Tally {
  const counts = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const value = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!value && !blankLabel) continue;
    const label = value || blankLabel!;
    const entry = counts.get(key(label)) ?? counts.set(key(label), { label, count: 0 }).get(key(label))!;
    entry.count += 1;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Questions asking for impressions are free text: shown as quotes, not counted.
export const isMessageQuestion = (label: string) => /kesan|pesan/i.test(label);

// Each extra question with how many answered and the answer counts; most answered first.
export function answerTallies(rows: CheckIn[]): { label: string; answers: number; tally: Tally }[] {
  const byLabel = new Map<string, string[]>();
  for (const row of rows)
    for (const [label, answer] of Object.entries(row.answers ?? {})) {
      if (isMessageQuestion(label) || !answer?.trim()) continue;
      byLabel.set(label, [...(byLabel.get(label) ?? []), answer]);
    }
  return [...byLabel]
    .map(([label, answers]) => ({ label, answers: answers.length, tally: tally(answers) }))
    .sort((a, b) => b.answers - a.answers || a.label.localeCompare(b.label));
}

export type Quote = { name: string; text: string; at: string; source: string };

// Answers to the Kesan & Pesan questions on the form, skipping blanks and dashes.
export function formQuotes(rows: CheckIn[]): Quote[] {
  const quotes: Quote[] = [];
  for (const row of rows)
    for (const [label, answer] of Object.entries(row.answers ?? {})) {
      const text = (answer ?? "").trim();
      if (!isMessageQuestion(label) || !text || /^[-–—.]+$/.test(text)) continue;
      quotes.push({ name: row.name, text, at: row.last_checked_in_at ?? row.created_at, source: label });
    }
  return quotes;
}

// The Google Sheet's Check-in tab (a row per visit with its Sesi, e.g. "02-11-2026 Sesi 1"), as
// XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) returns it. people: distinct
// attendees in the session, by e-mail when the export has it, else by name.
export function parseSheetVisits(rows: unknown[][]): { visits: number; sessions: { label: string; visits: number; people: number }[] } {
  const cell = (value: unknown) => String(value ?? "").trim();
  const header = Array.from(rows[0] ?? [], (value) => cell(value).toLowerCase());
  const sesiAt = header.indexOf("sesi");
  if (sesiAt < 0) throw new Error('Kolom "Sesi" tidak ditemukan. Unggah ekspor tab Check-in dari Google Sheet.');
  const emailAt = header.indexOf("e-mail");
  const nameAt = header.indexOf("nama");
  const sessions = new Map<string, { visits: number; people: Set<string> }>();
  let visits = 0;
  for (const row of rows.slice(1)) {
    const cells = Array.from(row, cell);
    const label = cells[sesiAt] ?? "";
    if (!label) continue;
    visits += 1;
    const session = sessions.get(label) ?? sessions.set(label, { visits: 0, people: new Set() }).get(label)!;
    session.visits += 1;
    const person = (emailAt >= 0 && cells[emailAt]) || (nameAt >= 0 && cells[nameAt]) || `#${visits}`;
    session.people.add(key(person));
  }
  if (!visits) throw new Error("Tidak ada baris check-in di file.");
  // "DD-MM-YYYY Sesi N" sorts by day then session; anything else after, alphabetically.
  const order = (label: string) => {
    const m = /^(\d{2})-(\d{2})-(\d{4}) Sesi (\d+)$/.exec(label);
    return m ? `0 ${m[3]}-${m[2]}-${m[1]} ${m[4]}` : `1 ${label}`;
  };
  return {
    visits,
    sessions: [...sessions]
      .sort(([a], [b]) => order(a).localeCompare(order(b)))
      .map(([label, { visits: count, people }]) => ({ label, visits: count, people: people.size })),
  };
}

// "YYYY-MM-DD" moved by whole days.
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const dayLabel = (day: string) => day.split("-").reverse().join("/");
const num = (n: number) => n.toLocaleString("id-ID");

export type NarrativeInput = {
  total: Summary;
  days: { day: string; first: number; last: number }[];
  divisi: Tally;
  poll?: { title: string; options: string[]; counts: number[]; voters: number };
  sessions?: { label: string; visits: number; people: number }[];
  quotes: number;
  winners: number;
};
// One fact of the conclusion; **text** marks what to read first.
export type Fact = { label: string; text: string };
export type Narrative = { headline: string; facts: Fact[] };

// The conclusion in words from the same numbers the charts show: a headline and one fact per topic.
export function narrative({ total, days, divisi, poll, sessions, quotes, winners }: NarrativeInput): Narrative {
  if (!total.attendees) return { headline: "Belum ada check-in dalam rentang ini.", facts: [] };
  const headline = `**${num(total.attendees)} peserta** hadir selama **${num(total.days)} hari** (${dayLabel(total.firstDay!)}–${dayLabel(total.lastDay!)}) dengan **${num(total.visits)} check-in**, rata-rata ${num(total.perPerson)} per orang.`;
  const facts: Fact[] = [];
  const peak = days.reduce<(typeof days)[number] | undefined>((best, d) => (!best || d.first > best.first ? d : best), undefined);
  if (peak && days.length > 1) facts.push({ label: "Puncak kedatangan", text: `**${dayLabel(peak.day)}**, ${num(peak.first)} peserta baru` });
  const named = divisi.filter((d) => d.label !== "Tidak diisi");
  const blank = divisi.find((d) => d.label === "Tidak diisi");
  if (named.length) facts.push({ label: "Divisi terbesar", text: `**${named[0].label}**, ${num(named[0].count)} orang${blank ? `; ${num(blank.count)} tidak mengisi divisi` : ""}` });
  const busiest = sessions?.reduce<(typeof sessions)[number] | undefined>((best, s) => (!best || s.visits > best.visits ? s : best), undefined);
  if (busiest) facts.push({ label: "Sesi teramai", text: `**${busiest.label}**, ${num(busiest.visits)} check-in dari ${num(busiest.people)} orang` });
  if (poll && poll.voters > 0) {
    const lead = poll.counts.reduce((best, count, i) => (count > poll.counts[best] ? i : best), 0);
    const share = Math.round((poll.counts[lead] * 100) / poll.voters);
    facts.push({ label: "E-Vote", text: `**${poll.options[lead]}** unggul, **${share}%** dari ${num(poll.voters)} suara${poll.title && poll.title !== "E-Vote" ? ` (${poll.title})` : ""}` });
  }
  facts.push({ label: "Kesan & Pesan", text: `**${num(quotes)}** pesan masuk` });
  facts.push({ label: "Undian", text: `**${num(winners)}** pemenang` });
  return { headline, facts };
}

// The WIB days with a first check-in, oldest first: the only days worth picking.
export const availableDays = (rows: CheckIn[]) => [...new Set(rows.map((row) => wibDay(row.created_at)))].sort();

// A vote counts as real from this many voters; smaller ones are trials.
export const REAL_VOTERS = 10;
export type PollSummary = { poll: { id: string; created_at: string }; voters: number };
export const realPolls = <P extends PollSummary>(polls: P[]) => polls.filter((p) => p.voters >= REAL_VOTERS);
// The vote to show first: the latest real one (a reset makes a new, later poll; the real count is the last
// one people voted in), else whichever had most voters.
export function defaultPoll<P extends PollSummary>(polls: P[]): P | undefined {
  const real = realPolls(polls).sort((a, b) => b.poll.created_at.localeCompare(a.poll.created_at));
  return real[0] ?? [...polls].sort((a, b) => b.voters - a.voters)[0];
}
