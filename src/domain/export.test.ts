import assert from "node:assert/strict";
import { it } from "node:test";
import * as XLSX from "xlsx";
import { EXPORT_HEADERS, exportFileName, exportRows, toCsv, toXlsx } from "./export";
import type { CheckIn, Winner } from "../types/guestbook";
import { BUILTIN_FIELDS } from "./formFields";

const checkin = (overrides: Partial<CheckIn> = {}): CheckIn => ({
  id: "c1",
  created_at: "2026-10-26T03:05:00Z",
  name: "Budi Santoso",
  phone: "081234567890",
  email: "budi@example.test",
  jabatan: "Staf",
  divisi: "Divisi Hukum",
  room_number: "1205",
  address: "Jl. MH Thamrin 14",
  latitude: -6.1754,
  longitude: 106.8272,
  file_path: "checkins/abc.jpg",
  checked_out_at: "2026-10-26T10:30:00Z",
  check_in_date: "2026-11-02",
  check_out_date: "2026-11-04",
  ...overrides,
});
const winner = (overrides: Partial<Winner> = {}): Winner => ({
  id: "w1",
  checkin_id: "c1",
  prize: "Hadiah 1",
  drawn_at: "2026-10-26T04:00:00Z",
  drawn_by: null,
  ...overrides,
});

it("writes RFC 4180 CSV with a BOM and CRLF line ends", () => {
  assert.equal(toCsv([["a", "b"], ["0812,1", 'say "hi"']]), '﻿a,b\r\n"0812,1","say ""hi"""\r\n');
});

it("maps check-ins and winners to export rows", () => {
  const rows = exportRows([checkin()], [winner()]);
  assert.deepEqual(rows[0], EXPORT_HEADERS);
  assert.equal(EXPORT_HEADERS.includes("Jabatan"), false);
  // The form no longer asks for an address or map pin; older rows keep theirs in the database.
  for (const dropped of ["Alamat", "Latitude", "Longitude"]) assert.equal(EXPORT_HEADERS.includes(dropped), false, dropped);
  assert.equal(rows[1].includes("Jl. MH Thamrin 14"), false);
  assert.equal(EXPORT_HEADERS.some((header) => header.startsWith("Tanggal")), false);
  assert.equal(rows[1].includes("Staf"), false);
  assert.equal(rows[1][0], "26/10/2026 10:05 WIB");
  assert.equal(rows[0][3], "Waktu Check-out (WIB)");
  assert.equal(rows[1][3], "26/10/2026 17:30 WIB");
  assert.equal(rows[1][5], "081234567890");
  assert.equal(rows[0][7], "Divisi");
  assert.equal(rows[1][7], "Divisi Hukum");
  assert.equal(rows[0][8], "Nomor Kamar Hotel");
  assert.equal(rows[1][8], "1205");
  assert.equal(rows[1][9], "checkins/abc.jpg");
  assert.equal(rows[1][10], "Hadiah 1");
  assert.equal(rows[1][11], "26/10/2026 11:00 WIB");
  // Someone who came once has no later check-in.
  assert.deepEqual(rows[0].slice(1, 3), ["Check-in Terakhir (WIB)", "Jumlah Check-in"]);
  assert.deepEqual(rows[1].slice(1, 3), ["", "1"]);
  assert.deepEqual(exportRows([checkin({ last_checked_in_at: "2026-10-27T06:15:00Z", checkin_count: 3 })], [])[1].slice(1, 3), ["27/10/2026 13:15 WIB", "3"]);
  const none = exportRows([checkin({ divisi: null, room_number: null, address: null, file_path: null, checked_out_at: null })], []);
  assert.equal(none[1][3], "");
  assert.deepEqual(none[1].slice(7), ["", "", "", "", ""]);
  // Rows read before the room-number and division migrations have no such fields.
  const { room_number: _, divisi: __, ...older } = checkin();
  assert.deepEqual(exportRows([older as CheckIn], [])[1].slice(7, 9), ["", ""]);
});

it("keeps phone numbers as text cells in Excel", () => {
  const rows = exportRows([checkin()], [winner()]);
  const workbook = XLSX.read(toXlsx(rows), { type: "array" });
  const cell = workbook.Sheets["Check-in"]["F2"];
  assert.equal(cell.t, "s");
  assert.equal(cell.v, "081234567890");
});

it("names export files after the event and date", () => {
  assert.equal(
    exportFileName("Rakernas Bawaslu 2026", "xlsx", new Date("2026-10-26T00:00:00+07:00")),
    "check-in-rakernas-bawaslu-2026-20261026.xlsx",
  );
});

it("neutralises spreadsheet formulas in attendee text while keeping phones and coordinates", () => {
  assert.equal(toCsv([["=1+1", "@cmd", "-SUM(1)", "+62 812", "-6.1754", "\tx"]]), "﻿'=1+1,'@cmd,'-SUM(1),+62 812,-6.1754,'\tx\r\n");
});

it("gives each added question a column after the room, keeping answers to questions removed since", () => {
  const shirt = { id: "f_kaos", label: "Ukuran kaos", type: "select" as const, required: true, options: ["S", "M"] };
  const rows = exportRows(
    [checkin({ id: "a", answers: { "Ukuran kaos": "M" } }), checkin({ id: "b", created_at: "2026-10-26T02:00:00Z", answers: { "Asal instansi": "Bawaslu Jabar" } }), checkin({ id: "c", created_at: "2026-10-26T01:00:00Z" })],
    [],
    [BUILTIN_FIELDS.divisi, shirt],
  );
  assert.deepEqual(rows[0].slice(7, 12), ["Divisi", "Nomor Kamar Hotel", "Ukuran kaos", "Asal instansi", "Berkas"]);
  assert.deepEqual(rows.slice(1).map((row) => row.slice(9, 11)), [["M", ""], ["", "Bawaslu Jabar"], ["", ""]]);
});
