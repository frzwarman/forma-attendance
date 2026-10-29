import assert from "node:assert/strict";
import { it } from "node:test";
import { DEFAULT_FORM_FIELDS, formFieldsFrom, formFieldsProblem, parseFormFields, type FormField } from "./formFields";

it("uses Divisi and Nomor Kamar Hotel until an admin saves a form", () => {
  for (const raw of [null, undefined, {}, "x"]) assert.equal(formFieldsFrom(raw), DEFAULT_FORM_FIELDS);
  // An admin who removed every question saved an empty form, which is not the default.
  assert.deepEqual(formFieldsFrom([]), []);
});

it("reads saved questions and leaves out malformed ones", () => {
  const fields = parseFormFields([
    { id: "divisi", builtin: "divisi", label: " Satuan kerja ", type: "select", required: false, options: ["x"] },
    { id: "f_kaos", label: "Ukuran kaos", type: "select", required: true, options: [" S ", "M", "M", "", 3] },
    { id: "Bad Id", label: "Asal", type: "text" },
    { id: "f_kosong", label: "Pilihan kosong", type: "select", options: [] },
    { id: "f_dua", label: "ukuran KAOS", type: "text" },
    { id: "f_catatan", label: "Catatan", type: "weird", required: "yes" },
  ]);
  assert.deepEqual(fields, [
    // A built-in question stays plain text whatever is stored.
    { id: "divisi", builtin: "divisi", label: "Satuan kerja", type: "text", required: false, options: [] },
    { id: "f_kaos", label: "Ukuran kaos", type: "select", required: true, options: ["S", "M"] },
    { id: "f_catatan", label: "Catatan", type: "text", required: false, options: [] },
  ]);
});

it("explains what to fix before saving", () => {
  const field = (label: string, extra: Partial<FormField> = {}): FormField => ({ id: label.toLowerCase().replace(/\W/g, "_") || "x", label, type: "text", required: false, options: [], ...extra });
  assert.equal(formFieldsProblem([field("Divisi"), field("Ukuran kaos", { type: "select", options: ["S"] })]), "");
  assert.equal(formFieldsProblem([field("  ")]), "Pertanyaan 1 belum punya judul.");
  assert.equal(formFieldsProblem([field("e-mail")]), 'Judul "e-mail" dipakai lebih dari sekali.');
  assert.equal(formFieldsProblem([field("Asal"), field("asal ")]), 'Judul "asal" dipakai lebih dari sekali.');
  assert.equal(formFieldsProblem([field("Ukuran kaos", { type: "select", options: [" "] })]), '"Ukuran kaos" butuh minimal satu pilihan.');
});
