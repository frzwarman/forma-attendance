// Undian: a spin wheel over the list an admin uploads (Nama, with Kesan & Pesan to show beside the winner).
// Reading the uploaded sheet, where the wheel stops, and how its segments look; the rows live in
// guestbook_wheel_entries (see src/services/draw.ts).
export type WheelRow = { name: string; note: string };

export const WHEEL_MAX = 2000;
export const WHEEL_NAME_MAX = 120;
export const WHEEL_NOTE_MAX = 2000;

const cell = (value: unknown) => String(value ?? "").trim();

// The sheet's rows as XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) gives them. Row 1
// names the columns: Nama, and Kesan & Pesan if the file has it, in either order. Errors name 1-based file rows.
export function parseWheelFile(rows: unknown[][]): { entries: WheelRow[]; withNotes: boolean } {
  let nameAt = -1;
  let noteAt = -1;
  let unknown = "";
  Array.from(rows[0] ?? [], cell).forEach((header, i) => {
    const kind = header.toLowerCase() === "nama" ? "name" : /kesan|pesan/i.test(header) ? "note" : header ? "unknown" : "";
    if ((kind === "name" && nameAt >= 0) || (kind === "note" && noteAt >= 0)) throw new Error(`Kolom "${header}" muncul dua kali.`);
    if (kind === "name") nameAt = i;
    else if (kind === "note") noteAt = i;
    else if (kind === "unknown") unknown ||= header;
  });
  if (nameAt < 0) throw new Error('Kolom "Nama" tidak ditemukan di baris pertama file.');
  if (unknown) throw new Error(`File hanya boleh berisi kolom Nama dan Kesan & Pesan; kolom "${unknown}" tidak dikenal.`);

  const entries: WheelRow[] = [];
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const cells = Array.from(row, cell);
    if (cells.every((value) => !value)) return;
    if (cells.some((value, j) => value && j !== nameAt && j !== noteAt))
      throw new Error(`Baris ${line} berisi kolom tambahan; file hanya boleh berisi kolom Nama dan Kesan & Pesan.`);
    const name = cells[nameAt] ?? "";
    const note = noteAt >= 0 ? (cells[noteAt] ?? "") : "";
    if (!name) throw new Error(`Nama di baris ${line} kosong.`);
    if (name.length > WHEEL_NAME_MAX) throw new Error(`Nama di baris ${line} terlalu panjang (maksimal ${WHEEL_NAME_MAX} karakter).`);
    if (note.length > WHEEL_NOTE_MAX) throw new Error(`Kesan & pesan di baris ${line} terlalu panjang (maksimal ${WHEEL_NOTE_MAX} karakter).`);
    entries.push({ name, note });
  });
  if (entries.length === 0) throw new Error("Tidak ada nama di file.");
  if (entries.length > WHEEL_MAX) throw new Error(`Maksimal ${WHEEL_MAX.toLocaleString("id-ID")} peserta.`);
  return { entries, withNotes: noteAt >= 0 };
}

// Geometry: the SVG viewBox is "-500 -500 1000 1000", the wheel's radius 480 and the pointer sits at 12 o'clock.
// Unrotated, segment i of n (the entries still on the wheel, in position order) covers [i, i + 1) * 360/n
// clockwise from the top. CSS rotate(R deg) turns the wheel clockwise, so the pointer reads the wheel at -R.
export const SPIN_MS = 5000;

export function segmentAt(rotation: number, count: number): number {
  return Math.floor((((-rotation % 360) + 360) % 360) / (360 / count)) % count;
}

// Five to six more turns on, stopping at a random point in the middle 60% of segment index: never on an edge.
export function spinTo(rotation: number, index: number, count: number, random: () => number = Math.random): number {
  const target = ((index + 0.2 + 0.6 * random()) * 360) / count;
  const base = rotation + 5 * 360;
  return base + ((((-target - base) % 360) + 360) % 360);
}

// Read well under white text on the navy stage.
export const WHEEL_COLORS = ["#ec1c24", "#1f6feb", "#2e9e5b", "#d1aa67", "#8e44ad", "#e67e22", "#0097a7", "#c2185b"];

// Cycles the palette; a last segment that would repeat the first one's colour takes the second instead.
export function segmentColor(index: number, count: number): string {
  if (count > 1 && index === count - 1 && index % WHEEL_COLORS.length === 0) return WHEEL_COLORS[1];
  return WHEEL_COLORS[index % WHEEL_COLORS.length];
}

// A label runs along its segment's bisector from 0.26 to 0.94 of the radius: 326 viewBox units.
const LABEL_LENGTH = 326;
const CHAR_WIDTH = 0.56; // of the font size, for a bold sans

// Font size in viewBox units: 80% of the segment's width at 0.42 of the radius (a lone entry's disc counts as
// a half), the longest name fitting the label, at most 36. 0 hides the labels: too small to read, or too many.
export function labelSize(count: number, longest: number): number {
  if (count > 80) return 0;
  const size = Math.min(
    36,
    Math.round(0.8 * 2 * 0.42 * 480 * Math.sin(Math.PI / Math.max(2, count))),
    Math.floor(LABEL_LENGTH / (CHAR_WIDTH * Math.max(1, longest))),
  );
  return size < 11 ? 0 : size;
}

// The name when it fits the label at this size, otherwise cut to fit with an ellipsis.
export function wheelLabel(name: string, size: number): string {
  const fit = Math.floor(LABEL_LENGTH / (CHAR_WIDTH * size));
  return name.length <= fit ? name : `${name.slice(0, fit - 1)}…`;
}
