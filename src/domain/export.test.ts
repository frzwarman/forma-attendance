import assert from "node:assert/strict";
import { it } from "node:test";
import * as XLSX from "xlsx";
import { EXPORT_HEADERS, exportFileName, exportRows, toCsv, toXlsx } from "./export";
import type { CheckIn, Winner } from "../types/guestbook";

const checkin = (overrides: Partial<CheckIn> = {}): CheckIn => ({
  id: "c1",
  created_at: "2026-10-26T03:05:00Z",
  name: "Budi Santoso",
  phone: "081234567890",
  email: "budi@example.test",
  jabatan: "Staf",
  address: "Jl. MH Thamrin 14",
  latitude: -6.1754,
  longitude: 106.8272,
  file_path: "checkins/abc.jpg",
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
  assert.equal(EXPORT_HEADERS.some((header) => header.startsWith("Tanggal")), false);
  assert.equal(rows[1].includes("Staf"), false);
  assert.equal(rows[1][0], "26/10/2026 10:05 WIB");
  assert.equal(rows[1][2], "081234567890");
  assert.equal(rows[1][5], "-6.1754");
  assert.equal(rows[1][7], "checkins/abc.jpg");
  assert.equal(rows[1][8], "Hadiah 1");
  assert.equal(rows[1][9], "26/10/2026 11:00 WIB");
  const none = exportRows([checkin({ latitude: null, longitude: null, file_path: null })], []);
  assert.deepEqual(none[1].slice(5), ["", "", "", "", ""]);
});

it("keeps phone numbers as text cells in Excel", () => {
  const rows = exportRows([checkin()], [winner()]);
  const workbook = XLSX.read(toXlsx(rows), { type: "array" });
  const cell = workbook.Sheets["Check-in"]["C2"];
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
