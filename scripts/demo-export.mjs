// Writes sample exports from the demo seed: the real migrations run in embedded
// Postgres and the rows go through the same export code as the admin page.
// Run: npm run demo:export
import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { exportRows, toCsv, toXlsx } from "../src/domain/export.ts";
import { guestbookDatabase } from "../tests/database/guestbook-db.mjs";

const iso = (value) => (value instanceof Date ? value.toISOString() : value);
const db = await guestbookDatabase();
await db.exec(await readFile(new URL("../supabase/seed/demo-checkins.sql", import.meta.url), "utf8"));
const checkins = (await db.query("select * from public.guestbook_checkins")).rows.map((row) => ({
  ...row,
  created_at: iso(row.created_at),
  checked_out_at: row.checked_out_at ? iso(row.checked_out_at) : null,
}));
const winners = (await db.query("select * from public.guestbook_draw_winners")).rows.map((row) => ({
  ...row,
  drawn_at: iso(row.drawn_at),
}));
await db.close();

const rows = exportRows(checkins, winners);
writeFileSync("artifacts/contoh-ekspor-check-in.csv", toCsv(rows));
writeFileSync("artifacts/contoh-ekspor-check-in.xlsx", Buffer.from(toXlsx(rows)));
console.log(
  `artifacts/contoh-ekspor-check-in.{xlsx,csv}: ${rows.length - 1} check-ins, ` +
    `${checkins.filter((row) => row.checked_out_at).length} checked out, ${winners.length} winners`,
);
