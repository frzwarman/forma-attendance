// Google Apps Script for the spreadsheet that mirrors the check-ins. The database posts to it
// (supabase/migrations/20261103000000_guestbook_sheet_sync.sql) within seconds of every change:
//   { secret, rows: [{ id, cells: [[header, value], ...] }] }  add or update a row per check-in
//   { secret, delete: [id, ...] }                              remove those rows
// Each row goes to the Check-in tab (everyone, one row per person) and to the tab of the session of
// its latest check-in, e.g. "02-11-2026 Sesi 2 Siang", created when that session's first check-in
// arrives. Everyone is checked out at the end of each day (20261104000000_guestbook_auto_checkout.sql).
// Setup steps are in the README ("Google Sheet").

const ALL_TAB = "Check-in";
const ID_HEADER = "ID";
// The sessions of each day of the rundown (Jadwal Kegiatan), by WIB start time, earliest first. A
// check-in belongs to the last session started by then, so one during a break (Ishoma 12.00-13.00,
// 17.00-19.00) counts for the session after it. Days not listed use DEFAULT_SESSIONS.
const SCHEDULE = {
  "01/11/2026": [["00:00", "Registrasi"]],
  "02/11/2026": [["00:00", "Sesi 1 Pagi"], ["12:00", "Sesi 2 Siang"], ["17:00", "Sesi 3 Malam"]],
  "03/11/2026": [["00:00", "Sesi 1 Pagi"], ["12:00", "Sesi 2 Siang"]],
  "04/11/2026": [["00:00", "Sesi 1 Pagi"], ["12:00", "Sesi 2 Siang"]],
  "05/11/2026": [["00:00", "Sesi 1 Pagi"], ["12:00", "Sesi 2 Siang"]],
  "06/11/2026": [["00:00", "Sesi 1 Pagi"]],
};
const DEFAULT_SESSIONS = [["00:00", "Sesi 1 Pagi"], ["12:00", "Sesi 2 Siang"]];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) return reply({ ok: false, error: "forbidden" });
  // One request at a time, so two check-ins arriving together never take the same new row.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    (body.rows || []).forEach((row) => {
      upsert(tab(ALL_TAB), row);
      const session = sessionTab(row.cells);
      if (session) upsert(tab(session), row);
    });
    (body.delete || []).forEach((id) =>
      SpreadsheetApp.getActive()
        .getSheets()
        .forEach((sheet) => {
          const at = findRow(sheet, id);
          if (at) sheet.deleteRow(at);
        }),
    );
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

// "02-11-2026 Sesi 2 Siang" from the latest check-in time ("02/11/2026 13:05 WIB").
function sessionTab(cells) {
  const value = (header) => (cells.find((cell) => cell[0] === header) || [])[1] || "";
  const time = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/.exec(value("Check-in Terakhir (WIB)") || value("Waktu Check-in (WIB)"));
  if (!time) return "";
  const sessions = SCHEDULE[`${time[1]}/${time[2]}/${time[3]}`] || DEFAULT_SESSIONS;
  const session = sessions.filter((start) => start[0] <= time[4]).pop();
  return `${time[1]}-${time[2]}-${time[3]} ${session[1]}`;
}

function tab(name) {
  const book = SpreadsheetApp.getActive();
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name, book.getNumSheets());
    sheet.getRange(1, 1).setValue(ID_HEADER).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

const headers = (sheet) => sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];

// Column numbers by header; a header the tab lacks (a new question on the form) becomes a new column.
function columns(sheet, wanted) {
  const existing = headers(sheet);
  wanted.forEach((header) => {
    if (existing.indexOf(header) === -1) {
      existing.push(header);
      sheet.getRange(1, existing.length).setValue(header).setFontWeight("bold");
    }
  });
  return existing;
}

// The row holding this check-in, or 0; also 0 on a tab without an ID column (one of your own).
function findRow(sheet, id) {
  const column = headers(sheet).indexOf(ID_HEADER) + 1;
  if (!column) return 0;
  const found = sheet.getRange(1, column, sheet.getLastRow(), 1).createTextFinder(id).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function upsert(sheet, row) {
  const cells = [[ID_HEADER, row.id]].concat(row.cells);
  const header = columns(sheet, cells.map((cell) => cell[0]));
  const at = findRow(sheet, row.id) || sheet.getLastRow() + 1;
  const range = sheet.getRange(at, 1, 1, header.length);
  // Columns the request does not mention (answers to a removed question) keep their values.
  const values = range.getValues()[0];
  cells.forEach((cell) => (values[header.indexOf(cell[0])] = asText(cell[1])));
  // Plain text, so phone numbers keep their leading 0 and times stay as written.
  range.setNumberFormat("@").setValues([values]);
}

// Attendee text starting like a formula (=IMPORTXML(...)) would run in the sheet; the leading
// apostrophe makes it text and does not show.
function asText(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
