// Code.gs against an in-memory spreadsheet that counts reads (npm test).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const SECRET = "s".repeat(32);

function load() {
  class Range {
    constructor(sheet, r, c, nr, nc) {
      Object.assign(this, { sheet, r, c, nr, nc });
    }
    getValues() {
      this.sheet.reads++;
      return Array.from({ length: this.nr }, (_, i) =>
        Array.from({ length: this.nc }, (_, j) => this.sheet.data[this.r - 1 + i]?.[this.c - 1 + j] ?? ""),
      );
    }
    setValues(values) {
      values.forEach((row, i) =>
        row.forEach((value, j) => {
          // Sheets would run it as a formula; a leading apostrophe only marks text and does not show.
          assert.ok(!/^[=+\-@]/.test(value), `written as a formula: ${value}`);
          (this.sheet.data[this.r - 1 + i] ??= [])[this.c - 1 + j] = String(value).replace(/^'/, "");
        }),
      );
      return this;
    }
    setValue(value) {
      return this.setValues([[value]]);
    }
    setNumberFormat() {
      return this;
    }
    setFontWeight() {
      return this;
    }
  }
  const filled = (row) => (row || []).some((value) => value !== "" && value != null);
  class Sheet {
    constructor(name) {
      Object.assign(this, { name, data: [], reads: 0 });
    }
    getLastRow() {
      return this.data.findLastIndex(filled) + 1;
    }
    getLastColumn() {
      return Math.max(0, ...this.data.map((row) => (row || []).findLastIndex((value) => value !== "" && value != null) + 1));
    }
    getRange(r, c, nr = 1, nc = 1) {
      return new Range(this, r, c, nr, nc);
    }
    setFrozenRows() {}
    deleteRow(r) {
      this.data.splice(r - 1, 1);
    }
  }
  const book = {
    sheets: [],
    getSheetByName: (name) => book.sheets.find((sheet) => sheet.name === name) || null,
    insertSheet: (name, at) => book.sheets.splice(at, 0, new Sheet(name)) && book.sheets[at],
    getNumSheets: () => book.sheets.length,
    getSheets: () => book.sheets,
  };
  const context = vm.createContext({
    SpreadsheetApp: { getActive: () => book },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => SECRET }) },
    ContentService: { createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }), MimeType: { JSON: "json" } },
  });
  vm.runInContext(readFileSync(new URL("./Code.gs", import.meta.url), "utf8"), context);
  const post = (body) => context.doPost({ postData: { contents: JSON.stringify({ secret: SECRET, ...body }) } });
  const rows = (name) => {
    const [header, ...data] = book.getSheetByName(name).data;
    return data.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ""])));
  };
  return { book, post, rows };
}

// A person as the database sends them (private.guestbook_sheet_row).
const person = (id, { at = "02/11/2026 08:00 WIB", sesi = "02-11-2026 Sesi 1", last = "", count = "1", out = "", more = [] } = {}) => ({
  id,
  cells: [
    ["Waktu Check-in (WIB)", at],
    ["Sesi", sesi],
    ["Check-in Terakhir (WIB)", last],
    ["Jumlah Check-in", count],
    ["Waktu Check-out (WIB)", out],
    ["Nama", `Peserta ${id}`],
    ["Nomor Telepon", "0812 1111 2222"],
    ...more,
  ],
});
const visit = (row) => `${row.ID}#${row["Check-in ke-"]} ${row["Waktu Check-in (WIB)"]} out=${row["Waktu Check-out (WIB)"]}`;

test("Check out semua: every row of a 100-person request is updated in place, each tab read once", () => {
  const { book, post, rows } = load();
  const ids = Array.from({ length: 100 }, (_, i) => `p${i}`);
  ids.forEach((id, i) => post({ rows: [person(id, { sesi: i % 2 ? "02-11-2026 Sesi 1" : "01-11-2026 Sesi 2" })] }));
  book.sheets.forEach((sheet) => (sheet.reads = 0));
  post({ rows: ids.map((id, i) => person(id, { sesi: i % 2 ? "02-11-2026 Sesi 1" : "01-11-2026 Sesi 2", out: "02/11/2026 21:00 WIB" })) });
  for (const name of ["Check-in", "02-11-2026 Sesi 1", "01-11-2026 Sesi 2"]) {
    assert.ok(rows(name).every((row) => row["Waktu Check-out (WIB)"] === "02/11/2026 21:00 WIB"), name);
    assert.ok(book.getSheetByName(name).reads <= 2, `${name}: ${book.getSheetByName(name).reads} reads`);
  }
  assert.deepEqual(rows("Check-in").map((row) => row.ID), ids);
  assert.equal(rows("02-11-2026 Sesi 1").length, 50);
  assert.equal(book.getSheetByName("Kesan & Pesan"), null, "no tab until a message comes");
});

test("a repeat check-in adds a row, and the check-out after it updates that row, not the first", () => {
  const { post, rows } = load();
  post({ rows: [person("c", { at: "02/11/2026 09:30 WIB" })] });
  post({ rows: [person("c", { at: "02/11/2026 09:30 WIB", last: "02/11/2026 13:00 WIB", count: "2", sesi: "02-11-2026 Sesi 2" })] });
  post({
    rows: [person("c", { at: "02/11/2026 09:30 WIB", last: "02/11/2026 13:00 WIB", count: "2", sesi: "02-11-2026 Sesi 2", out: "02/11/2026 21:00 WIB" })],
  });
  assert.deepEqual(rows("Check-in").map(visit), ["c#1 02/11/2026 09:30 WIB out=", "c#2 02/11/2026 13:00 WIB out=02/11/2026 21:00 WIB"]);
  assert.deepEqual(rows("02-11-2026 Sesi 1").map(visit), ["c#1 02/11/2026 09:30 WIB out="]);
  assert.deepEqual(rows("02-11-2026 Sesi 2").map(visit), ["c#2 02/11/2026 13:00 WIB out=02/11/2026 21:00 WIB"]);
});

test("a column the request leaves out keeps its value, and text that looks like a formula stays text", () => {
  const { post, rows } = load();
  post({ rows: [person("a", { more: [["Ukuran kaos", "=IMPORTXML(x)"], ["Instansi", "+62 Bawaslu"]] })] });
  post({ rows: [person("a", { out: "02/11/2026 21:00 WIB" })] });
  const [row] = rows("Check-in");
  assert.equal(row["Ukuran kaos"], "=IMPORTXML(x)");
  assert.equal(row.Instansi, "+62 Bawaslu");
  assert.equal(row["Waktu Check-out (WIB)"], "02/11/2026 21:00 WIB");
});

test("a message is written once however often it comes; deleting a person removes their rows everywhere", () => {
  const { book, post, rows } = load();
  const message = { id: "f1", cells: [["Waktu (WIB)", "02/11/2026 10:00 WIB"], ["ID", "m"], ["Nama", "Peserta m"], ["Pesan", "Mantap"]] };
  post({ rows: [person("m"), person("n")] });
  post({ feedback: [message] });
  post({ feedback: [message] });
  assert.deepEqual(rows("Kesan & Pesan").map((row) => `${row["ID Pesan"]} ${row.Pesan}`), ["f1 Mantap"]);
  post({ delete: ["m"] });
  assert.deepEqual(book.sheets.map((sheet) => `${sheet.name}: ${rows(sheet.name).map((row) => row.ID).join()}`), [
    "Check-in: n",
    "02-11-2026 Sesi 1: n",
    "Kesan & Pesan: ",
  ]);
});
