// E-Vote: one vote at a time with the options an admin sets and how many each person may pick
// (supabase/migrations/20261111000000_guestbook_evote.sql). Picks are option positions, 0-based. The title and
// subtitle are what the monitor and the attendee's page show over the options; blank means the defaults.
export type Poll = { id: string; created_at: string; options: string[]; max_picks: number; is_open: boolean; title: string; subtitle: string };

export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 20;
export const OPTION_LENGTH_MAX = 120;
export const TITLE_MAX = 120;
export const SUBTITLE_MAX = 200;

// Trimmed, blank lines dropped, repeats (ignoring case) dropped; the first spelling stays.
export function normalizeOptions(options: string[]): string[] {
  const seen = new Set<string>();
  return options
    .map((option) => option.trim())
    .filter((option) => {
      const key = option.toLowerCase();
      if (!option || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// What keeps these (normalised) options from being saved, or null.
export function pollProblem(options: string[], maxPicks: number): string | null {
  if (options.length < OPTIONS_MIN) return `Isi minimal ${OPTIONS_MIN} pilihan.`;
  if (options.length > OPTIONS_MAX) return `Maksimal ${OPTIONS_MAX} pilihan.`;
  if (options.some((option) => option.length > OPTION_LENGTH_MAX)) return `Setiap pilihan maksimal ${OPTION_LENGTH_MAX} karakter.`;
  if (!Number.isInteger(maxPicks) || maxPicks < 1 || maxPicks > options.length)
    return `Jumlah pilihan per orang harus 1 sampai ${options.length}.`;
  return null;
}

// A tap on option index. With one pick it replaces the choice; with more it adds, never past maxPicks.
// Tapping a picked option takes it back. Kept in the admin's order.
export function togglePick(picked: number[], index: number, maxPicks: number): number[] {
  if (picked.includes(index)) return picked.filter((i) => i !== index);
  if (maxPicks === 1) return [index];
  if (picked.length >= maxPicks) return picked;
  return [...picked, index].sort((a, b) => a - b);
}

// Saving these options carries on the current vote only when nothing about it changes; otherwise a
// new vote starts, counted from zero (picks are positions, so a new order is a new vote too).
export const sameVote = (poll: Pick<Poll, "options" | "max_picks"> | null, options: string[], maxPicks: number) =>
  !!poll && poll.max_picks === maxPicks && poll.options.length === options.length && poll.options.every((option, i) => option === options[i]);

// The ballot's heading; with several picks allowed, fewer is fine too.
export const pickInstruction = (maxPicks: number) =>
  maxPicks === 1 ? "Pilih 1 dari pilihan di bawah" : `Pilih maksimal ${maxPicks} dari pilihan di bawah`;

// The admin's title and subtitle, or the page's own words when they are blank.
export const voteTitle = (poll: Pick<Poll, "title">, fallback: string) => poll.title.trim() || fallback;
export const voteSubtitle = (poll: Pick<Poll, "subtitle" | "max_picks">) => poll.subtitle.trim() || pickInstruction(poll.max_picks);

// Each option's share of the people who voted, in whole percent.
export const shares = (counts: number[], voters: number) => counts.map((count) => (voters ? Math.round((count * 100) / voters) : 0));
