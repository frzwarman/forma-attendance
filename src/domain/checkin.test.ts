import assert from "node:assert/strict";
import { it } from "node:test";
import { checkInSchemaFor, sampleCheckIn, splitAnswers } from "./checkin";
import { BUILTIN_FIELDS, type FormField } from "./formFields";

const valid = {
  name: "Budi Santoso",
  phone: "0812 1111 2222",
  email: "budi@example.test",
  answers: { divisi: "Divisi Hukum", room_number: "" },
};
// Divisi plus the hotel room question, which admins can add back in Formulir.
const schema = checkInSchemaFor([BUILTIN_FIELDS.divisi, BUILTIN_FIELDS.room_number]);
const messages = (result: { error?: { issues: { message: string }[] } }) => result.error?.issues.map((issue) => issue.message).sort();

it("accepts a complete check-in", () => {
  assert.equal(schema.safeParse(valid).success, true);
});

it("reports every invalid field in Bahasa", () => {
  const result = schema.safeParse({ ...valid, name: "A", phone: "12", email: "x", answers: { divisi: " ", room_number: "" } });
  assert.deepEqual(messages(result), ["Divisi wajib diisi", "E-mail tidak valid", "Nama wajib diisi", "Nomor telepon tidak valid"]);
});

it("takes an optional hotel room number of at most 20 characters", () => {
  assert.equal(schema.safeParse({ ...valid, answers: { ...valid.answers, room_number: " 1205 " } }).data?.answers.room_number, "1205");
  const long = schema.safeParse({ ...valid, answers: { ...valid.answers, room_number: "x".repeat(21) } });
  assert.deepEqual(messages(long), ["Nomor Kamar Hotel maksimal 20 karakter"]);
});

const shirt: FormField = { id: "f_kaos", label: "Ukuran kaos", type: "select", required: true, options: ["S", "M", "L"] };
const origin: FormField = { id: "f_asal", label: "Asal instansi", type: "textarea", required: false, options: [] };

it("follows the questions the admin set up: removed ones are not asked, added ones are checked", () => {
  const custom = checkInSchemaFor([shirt, origin]);
  assert.deepEqual(messages(custom.safeParse({ ...valid, answers: { f_kaos: "", f_asal: "" } })), ["Ukuran kaos wajib diisi"]);
  assert.deepEqual(messages(custom.safeParse({ ...valid, answers: { f_kaos: "XXL", f_asal: "" } })), ["Pilih salah satu Ukuran kaos"]);
  assert.deepEqual(messages(custom.safeParse({ ...valid, answers: { f_kaos: "M", f_asal: "x".repeat(1001) } })), ["Asal instansi maksimal 1000 karakter"]);
  // Divisi is no longer on this form, so leaving it out is fine.
  assert.equal(custom.safeParse({ ...valid, answers: { f_kaos: "M", f_asal: "" } }).success, true);
});

it("stores Divisi and the room in their columns and other answers under their labels", () => {
  const fields = [BUILTIN_FIELDS.divisi, shirt, origin, BUILTIN_FIELDS.room_number];
  assert.deepEqual(splitAnswers(fields, { divisi: " Divisi Hukum ", f_kaos: "M", f_asal: "  ", room_number: "" }), {
    divisi: "Divisi Hukum",
    room_number: "",
    answers: { "Ukuran kaos": "M" },
  });
});

it("makes up a valid, never-duplicate check-in for the questions on the form", () => {
  const fields = [BUILTIN_FIELDS.divisi, shirt, origin, BUILTIN_FIELDS.room_number];
  const one = sampleCheckIn(fields, 1761800000123);
  assert.equal(checkInSchemaFor(fields).safeParse(one).success, true);
  assert.equal(one.answers.f_kaos, "S");
  assert.match(one.email, /@example\.com$/);
  const other = sampleCheckIn(fields, 1761800000999);
  assert.notEqual(other.phone, one.phone);
  assert.notEqual(other.email, one.email);
});
