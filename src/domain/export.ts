import * as XLSX from "xlsx";
import type { CheckIn, Winner } from "../types/guestbook";
import { formatWib } from "./time";

export const EXPORT_HEADERS = [
  "Waktu Check-in (WIB)",
  "Nama",
  "Nomor Telepon",
  "E-mail",
  "Alamat",
  "Latitude",
  "Longitude",
  "Berkas",
  "Tanggal Check In",
  "Tanggal Check Out",
  "Hadiah",
  "Waktu Undian (WIB)",
];

export function exportRows(checkins: CheckIn[], winners: Winner[]): string[][] {
  const byCheckin = new Map(winners.map((winner) => [winner.checkin_id, winner]));
  const sorted = [...checkins].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return [
    EXPORT_HEADERS,
    ...sorted.map((row) => {
      const winner = byCheckin.get(row.id);
      return [
        formatWib(row.created_at),
        row.name,
        row.phone,
        row.email,
        row.address,
        row.latitude == null ? "" : String(row.latitude),
        row.longitude == null ? "" : String(row.longitude),
        row.file_path ?? "",
        row.check_in_date,
        row.check_out_date,
        winner?.prize ?? "",
        winner ? formatWib(winner.drawn_at) : "",
      ];
    }),
  ];
}

// Text starting like a formula is prefixed with an apostrophe (OWASP CSV injection
// guidance); signed numbers such as phones and coordinates stay readable.
const neutralise = (value: string) =>
  /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d\s(]/.test(value)) ? `'${value}` : value;
const quote = (value: string) => {
  const safe = neutralise(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// UTF-8 BOM so Excel reads accents; every value stays text.
export const toCsv = (rows: string[][]) =>
  "﻿" + rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n";

export function toXlsx(rows: string[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Check-in");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function exportFileName(eventName: string, ext: "csv" | "xlsx", date = new Date()): string {
  const slug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "acara";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `check-in-${slug}-${get("year")}${get("month")}${get("day")}.${ext}`;
}
