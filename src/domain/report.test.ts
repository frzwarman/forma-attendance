import assert from "node:assert/strict";
import { test } from "node:test";
import type { CheckIn } from "../types/guestbook";
import { answerTallies, arrivalHours, eventRows, formQuotes, isDemo, parseSheetVisits, perDay, summary, tally, wibDay, wibHour } from "./report";

let n = 0;
function row(overrides: Partial<CheckIn> = {}): CheckIn {
  n += 1;
  return {
    id: `id-${n}`,
    created_at: "2026-11-02T01:00:00.000Z",
    name: `Peserta ${n}`,
    phone: `0812000000${n}`,
    email: `p${n}@bawaslu.test`,
    jabatan: null,
    address: null,
    latitude: null,
    longitude: null,
    file_path: null,
    check_in_date: "2026-11-02",
    check_out_date: null,
    checked_out_at: null,
    ...overrides,
  };
}

test("WIB day and hour: 17:30 UTC is the next day 00:30 in Jakarta", () => {
  assert.equal(wibDay("2026-11-02T17:30:00.000Z"), "2026-11-03");
  assert.equal(wibHour("2026-11-02T17:30:00.000Z"), 0);
  assert.equal(wibDay("2026-11-02T01:15:00.000Z"), "2026-11-02");
  assert.equal(wibHour("2026-11-02T01:15:00.000Z"), 8);
});

test("event rows leave out the demo seed and keep attendees whose first check-in is in the chosen days", () => {
  const rows = [
    row({ email: "demo@example.com" }),
    row({ created_at: "2026-10-31T02:00:00.000Z" }),
    row({ created_at: "2026-11-02T02:00:00.000Z" }),
    row({ created_at: "2026-11-05T16:59:00.000Z" }), // 23:59 WIB on the 5th
  ];
  assert.equal(isDemo(rows[0]), true);
  assert.deepEqual(eventRows(rows).map((r) => r.id), [rows[1].id, rows[2].id, rows[3].id]);
  // Newest first in, oldest first out.
  assert.deepEqual(eventRows([...rows].reverse()).map((r) => r.id), [rows[1].id, rows[2].id, rows[3].id]);
  assert.deepEqual(eventRows(rows, { from: "2026-11-01" }).map((r) => r.id), [rows[2].id, rows[3].id]);
  assert.deepEqual(eventRows(rows, { from: "2026-11-01", to: "2026-11-05" }).map((r) => r.id), [rows[2].id, rows[3].id]);
  assert.deepEqual(eventRows(rows, { to: "2026-11-04" }).map((r) => r.id), [rows[1].id, rows[2].id]);
});

test("the summary counts attendees, every check-in, the days, check-outs, hotel rooms and uploads", () => {
  const rows = [
    row({ created_at: "2026-11-02T01:00:00.000Z", last_checked_in_at: "2026-11-04T06:00:00.000Z", checkin_count: 5, checked_out_at: "2026-11-04T09:00:00.000Z", room_number: "1204" }),
    row({ created_at: "2026-11-02T02:00:00.000Z", file_path: "checkins/a.jpg" }),
    row({ created_at: "2026-11-03T02:00:00.000Z", last_checked_in_at: "2026-11-03T07:00:00.000Z", checkin_count: 2 }),
  ];
  assert.deepEqual(summary(rows), { attendees: 3, visits: 8, days: 3, perPerson: 2.7, checkedOut: 1, rooms: 1, files: 1, firstDay: "2026-11-02", lastDay: "2026-11-04" });
  assert.deepEqual(summary([]), { attendees: 0, visits: 0, days: 0, perPerson: 0, checkedOut: 0, rooms: 0, files: 0, firstDay: null, lastDay: null });
});

test("per day: first check-ins and latest check-ins by WIB day, in order", () => {
  const rows = [
    row({ created_at: "2026-11-02T01:00:00.000Z", last_checked_in_at: "2026-11-04T06:00:00.000Z", checkin_count: 3 }),
    row({ created_at: "2026-11-02T02:00:00.000Z" }),
    row({ created_at: "2026-11-03T16:59:00.000Z", last_checked_in_at: "2026-11-04T01:00:00.000Z", checkin_count: 2 }),
  ];
  assert.deepEqual(perDay(rows), [
    { day: "2026-11-02", first: 2, last: 0 },
    { day: "2026-11-03", first: 1, last: 0 },
    { day: "2026-11-04", first: 0, last: 2 },
  ]);
});

test("arrival hours count first and latest check-ins by WIB hour", () => {
  const rows = [
    row({ created_at: "2026-11-02T01:10:00.000Z", last_checked_in_at: "2026-11-04T06:00:00.000Z", checkin_count: 2 }),
    row({ created_at: "2026-11-02T01:50:00.000Z" }),
  ];
  const hours = arrivalHours(rows);
  assert.equal(hours.length, 24);
  assert.deepEqual(hours.filter((h) => h.count), [
    { hour: 8, count: 2 },
    { hour: 13, count: 1 },
  ]);
});

test("a tally groups spellings that differ only in case or spacing, keeps the first spelling, and can name the blanks", () => {
  assert.deepEqual(tally(["Biro Hukum", "biro  hukum", "Puslitbang", "", null, "Biro Hukum"]), [
    { label: "Biro Hukum", count: 3 },
    { label: "Puslitbang", count: 1 },
  ]);
  assert.deepEqual(tally(["A", "", "B", "  ", "A"], "Tidak diisi"), [
    { label: "A", count: 2 },
    { label: "Tidak diisi", count: 2 },
    { label: "B", count: 1 },
  ]);
});

test("answer tallies cover the extra questions except the ones asking for Kesan & Pesan, most answered first", () => {
  const rows = [
    row({ answers: { "TYPE LAYOUT": "ROUNDTABLE", "Tulis pesan dan kesan": "Mantap", Jabatan: "Staf" } }),
    row({ answers: { "TYPE LAYOUT": "Class room", Jabatan: "staf" } }),
    row({ answers: { "TYPE LAYOUT": "roundtable" } }),
    row({ answers: null }),
  ];
  assert.deepEqual(answerTallies(rows), [
    { label: "TYPE LAYOUT", answers: 3, tally: [{ label: "ROUNDTABLE", count: 2 }, { label: "Class room", count: 1 }] },
    { label: "Jabatan", answers: 2, tally: [{ label: "Staf", count: 2 }] },
  ]);
});

test("form quotes are the non-empty answers to Kesan & Pesan questions, with who and when", () => {
  const rows = [
    row({ name: "Budi", created_at: "2026-11-02T01:00:00.000Z", last_checked_in_at: "2026-11-04T06:00:00.000Z", answers: { "Tulis pesan dan kesan": " Mantap! " } }),
    row({ name: "Siti", answers: { "Kesan dan Pesan": "-" } }),
    row({ name: "Agus", answers: { "Kesan dan Pesan": "" } }),
    row({ name: "Dewi", created_at: "2026-11-03T01:00:00.000Z", answers: { "Kesan dan Pesan": "Seru", "TYPE LAYOUT": "ROUNDTABLE" } }),
  ];
  assert.deepEqual(formQuotes(rows), [
    { name: "Budi", text: "Mantap!", at: "2026-11-04T06:00:00.000Z", source: "Tulis pesan dan kesan" },
    { name: "Dewi", text: "Seru", at: "2026-11-03T01:00:00.000Z", source: "Kesan dan Pesan" },
  ]);
});

test("the sheet's Check-in tab gives check-ins and people per session, in time order", () => {
  const rows = [
    ["Waktu Check-in (WIB)", "Sesi", "Nama", "E-mail", "Check-in ke-"],
    ["02/11/2026 08:10 WIB", "02-11-2026 Sesi 1", "Budi", "budi@x.id", "1"],
    ["02/11/2026 08:12 WIB", "02-11-2026 Sesi 1", "Siti", "siti@x.id", "1"],
    ["02/11/2026 13:40 WIB", "02-11-2026 Sesi 2", "Budi", "budi@x.id", "2"],
    ["02/11/2026 13:41 WIB", "02-11-2026 Sesi 2", "Budi", "BUDI@x.id", "3"], // the same person twice in one session
    ["01/11/2026 09:00 WIB", "01-11-2026 Sesi 1", "Agus", "agus@x.id", "1"],
    ["", "", "", "", ""],
  ];
  assert.deepEqual(parseSheetVisits(rows), {
    visits: 5,
    sessions: [
      { label: "01-11-2026 Sesi 1", visits: 1, people: 1 },
      { label: "02-11-2026 Sesi 1", visits: 2, people: 2 },
      { label: "02-11-2026 Sesi 2", visits: 2, people: 1 },
    ],
  });
  assert.throws(() => parseSheetVisits([["Nama", "Divisi"], ["Budi", "Hukum"]]), /Kolom "Sesi" tidak ditemukan/);
  assert.throws(() => parseSheetVisits([["Sesi", "Nama"]]), /Tidak ada baris check-in/);
});
