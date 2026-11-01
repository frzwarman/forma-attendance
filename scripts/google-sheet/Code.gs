// Google Apps Script for the spreadsheet that mirrors the check-ins. The database posts to it
// (supabase/migrations/20261103000000_guestbook_sheet_sync.sql) within seconds of every change:
//   { secret, rows: [{ id, cells: [[header, value], ...] }] }      a person's current state
//   { secret, feedback: [{ id, cells: [[header, value], ...] }] }  Kesan & Pesan messages
//   { secret, delete: [id, ...] }                                  remove that person's rows
// The sheet is a log: a row per check-in, so someone who checks in three times has three rows,
// numbered by "Check-in ke-" and each with that visit's time (the database keeps one row per person
// and counts the visits). A check-out or prize updates the row of the latest visit; earlier rows stay.
// Each row goes to the Check-in tab (every check-in) and to the tab of its session, e.g.
// "02-11-2026 Sesi 2 Siang", created when that session's first check-in arrives. Everyone is checked
// out at the end of each day (20261104000000_guestbook_auto_checkout.sql). Kesan & Pesan messages
// (20261106000000_guestbook_feedback.sql) go to their own tab, a row per message with its sender.
// Setup steps are in the README ("Google Sheet").

const ALL_TAB = "Check-in";
const ID_HEADER = "ID";
const VISIT_HEADER = "Check-in ke-";
const FEEDBACK_TAB = "Kesan & Pesan";
const FEEDBACK_ID_HEADER = "ID Pesan";
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
    (body.rows || []).map(visit).forEach((row) => {
      upsert(tab(ALL_TAB), row.cells, row.key);
      const session = sessionTab(row.cells);
      if (session) upsert(tab(session), row.cells, row.key);
    });
    (body.feedback || []).forEach((message) =>
      upsert(tab(FEEDBACK_TAB), message.cells.concat([[FEEDBACK_ID_HEADER, message.id]]), [[FEEDBACK_ID_HEADER, message.id]]),
    );
    // On every tab with an ID column, the Kesan & Pesan tab included.
    (body.delete || []).forEach((id) =>
      SpreadsheetApp.getActive()
        .getSheets()
        .forEach((sheet) => {
          for (let at = findRow(sheet, [[ID_HEADER, id]]); at; at = findRow(sheet, [[ID_HEADER, id]])) sheet.deleteRow(at);
        }),
    );
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

const valueOf = (cells, header) => (cells.find((cell) => cell[0] === header) || [])[1] || "";

// The person's latest visit as a log row: "Check-in ke-" from Jumlah Check-in, and that visit's time
// as Waktu Check-in (the database sends the first and the latest check-in time).
function visit(row) {
  const number = valueOf(row.cells, "Jumlah Check-in") || "1";
  const at = valueOf(row.cells, "Check-in Terakhir (WIB)") || valueOf(row.cells, "Waktu Check-in (WIB)");
  const cells = row.cells
    .filter((cell) => cell[0] !== "Check-in Terakhir (WIB)" && cell[0] !== "Jumlah Check-in")
    .map((cell) => (cell[0] === "Waktu Check-in (WIB)" ? [cell[0], at] : cell));
  cells.splice(1, 0, [VISIT_HEADER, number]);
  return { cells: [[ID_HEADER, row.id]].concat(cells), key: [[ID_HEADER, row.id], [VISIT_HEADER, number]] };
}

// "02-11-2026 Sesi 2 Siang" from the visit's time ("02/11/2026 13:05 WIB").
function sessionTab(cells) {
  const time = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/.exec(valueOf(cells, "Waktu Check-in (WIB)"));
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
    sheet.setFrozenRows(1);
  }
  return sheet;
}

const headers = (sheet) => (sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : []);

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

// The first row whose cells match every [header, value] of key, e.g. a person's visit or a message,
// or 0; also 0 on a tab without those columns (one of your own).
function findRow(sheet, key) {
  const header = headers(sheet);
  const at = key.map((pair) => header.indexOf(pair[0]));
  if (at.indexOf(-1) !== -1 || sheet.getLastRow() < 2) return 0;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).getValues();
  const found = rows.findIndex((values) => key.every((pair, i) => String(values[at[i]]) === String(pair[1])));
  return found === -1 ? 0 : found + 2;
}

function upsert(sheet, cells, key) {
  const header = columns(sheet, cells.map((cell) => cell[0]));
  // A new visit or message gets a new row; a check-out or prize updates its visit's row.
  const at = findRow(sheet, key) || sheet.getLastRow() + 1;
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
