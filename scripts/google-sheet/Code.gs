// Google Apps Script for the spreadsheet that mirrors the check-ins. The database posts to it
// (supabase/migrations/20261103000000_guestbook_sheet_sync.sql) within seconds of every change:
//   { secret, rows: [{ id, cells: [[header, value], ...] }] }      a person's current state
//   { secret, feedback: [{ id, cells: [[header, value], ...] }] }  Kesan & Pesan messages
//   { secret, delete: [id, ...] }                                  remove that person's rows
// The sheet is a log: a row per check-in, so someone who checks in three times has three rows,
// numbered by "Check-in ke-" and each with that visit's time (the database keeps one row per person
// and counts the visits). A check-out or prize updates the row of the latest visit; earlier rows stay.
// Each row goes to the Check-in tab (every check-in) and to the tab of its session, named in its Sesi
// column, e.g. "02-11-2026 Sesi 2" (the day it started), created when the session's first check-in
// arrives. Sessions start when an admin presses Mulai Sesi 1 or Mulai Sesi 2 and run until the next,
// past midnight too (20261109000000_guestbook_sessions.sql). Kesan & Pesan messages
// (20261106000000_guestbook_feedback.sql) go to their own tab, a row per message with its sender.
// Setup steps are in the README ("Google Sheet").

const ALL_TAB = "Check-in";
const ID_HEADER = "ID";
const VISIT_HEADER = "Check-in ke-";
const FEEDBACK_TAB = "Kesan & Pesan";
const FEEDBACK_ID_HEADER = "ID Pesan";

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
      const session = valueOf(row.cells, "Sesi");
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

// One-off repair for 02-11-2026 (supabase/migrations/20261110000000_guestbook_sesi1_continues.sql): the old
// rule started Sesi 2 at 12:00 that day while Sesi 1 was still running, and checked everyone out at 12:00.
// Every visit of the day goes to the "02-11-2026 Sesi 1" tab with that Sesi, also on the Check-in tab; a
// morning visit's 12:00 check-out is cleared; the "02-11-2026 Sesi 2" tab is deleted. Run it once from the
// editor (pick it in the list of functions, then Run) after deploying this version and applying the
// migration, before anyone presses Mulai Sesi 2 that day. Running it again changes nothing.
function repairSesi1On02Nov() {
  const day = "02/11/2026";
  const to = "02-11-2026 Sesi 1";
  const book = SpreadsheetApp.getActive();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const all = tab(ALL_TAB);
    const wrong = book.getSheetByName("02-11-2026 Sesi 2");
    const target = tab(to);
    const key = (row) => row[ID_HEADER] + "|" + row[VISIT_HEADER];
    // The day's visits from the Check-in tab, then any only the Sesi 2 tab has.
    const visits = new Map();
    [all, wrong].filter(Boolean).forEach((sheet) =>
      records(sheet).forEach((row) => {
        const time = String(row["Waktu Check-in (WIB)"] || "");
        if (!row[ID_HEADER] || time.indexOf(day + " ") !== 0 || visits.has(key(row))) return;
        row.Sesi = to;
        if (time.slice(11, 16) < "12:00" && row["Waktu Check-out (WIB)"] === day + " 12:00 WIB") row["Waktu Check-out (WIB)"] = "";
        visits.set(key(row), row);
      }),
    );
    const fix = (row) => Object.assign(row, visits.get(key(row)));
    write(all, records(all).map(fix));
    // The Sesi 1 tab keeps its rows, corrected, and gets the day's other visits after them.
    const there = records(target);
    const have = new Set(there.map(key));
    write(target, there.map(fix).concat([...visits.values()].filter((row) => !have.has(key(row)))));
    if (wrong) book.deleteSheet(wrong);
    Logger.log(visits.size + " check-in " + day + " sekarang di tab " + to + ".");
  } finally {
    lock.releaseLock();
  }
}

// A tab's rows as { header: value }.
function records(sheet) {
  const header = headers(sheet);
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, header.length)
    .getValues()
    .map((values) => header.reduce((row, name, i) => (name ? Object.assign(row, { [name]: values[i] }) : row), {}));
}

// Writes rows ({ header: value }) from the tab's second row on, in one go, adding missing columns.
function write(sheet, rows) {
  if (!rows.length) return;
  const header = columns(sheet, [...new Set([].concat(...rows.map(Object.keys)))]);
  const values = rows.map((row) => header.map((name) => asText(Object.prototype.hasOwnProperty.call(row, name) ? row[name] : "")));
  sheet.getRange(2, 1, rows.length, header.length).setNumberFormat("@").setValues(values);
}
