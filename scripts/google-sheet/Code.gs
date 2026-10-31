// Google Apps Script for the spreadsheet that mirrors the check-ins. The database posts to it
// (supabase/migrations/20261103000000_guestbook_sheet_sync.sql) within seconds of every change:
//   { secret, rows: [{ id, cells: [[header, value], ...] }] }  add or update a row per check-in
//   { secret, delete: [id, ...] }                              remove those rows
// Setup steps are in the README ("Google Sheet").

const SHEET_NAME = "Check-in";
const ID_HEADER = "ID";

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) return reply({ ok: false, error: "forbidden" });
  // One request at a time, so two check-ins arriving together never take the same new row.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = checkInSheet();
    (body.rows || []).forEach((row) => upsert(sheet, row));
    (body.delete || []).forEach((id) => {
      const at = findRow(sheet, id);
      if (at) sheet.deleteRow(at);
    });
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

function checkInSheet() {
  const book = SpreadsheetApp.getActive();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1).setValue(ID_HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Column numbers by header; a header the sheet lacks (a new question on the form) becomes a new column.
function columns(sheet, headers) {
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((header) => {
    if (existing.indexOf(header) === -1) {
      existing.push(header);
      sheet.getRange(1, existing.length).setValue(header).setFontWeight("bold");
    }
  });
  return existing;
}

function findRow(sheet, id) {
  const ids = sheet.getRange(1, columns(sheet, [ID_HEADER]).indexOf(ID_HEADER) + 1, sheet.getLastRow(), 1);
  const found = ids.createTextFinder(id).matchEntireCell(true).findNext();
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
