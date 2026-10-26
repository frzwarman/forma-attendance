import assert from "node:assert/strict";
import { it } from "node:test";
import { checkInSchema } from "./checkin";

const valid = {
  name: "Budi Santoso",
  phone: "0812 1111 2222",
  email: "budi@example.test",
  jabatan: "Staf",
  address: "Jl. MH Thamrin 14",
  check_in_date: "2026-11-02",
  check_out_date: "2026-11-04",
};

it("accepts a complete check-in", () => {
  assert.equal(checkInSchema.safeParse(valid).success, true);
});

it("reports every invalid field in Bahasa", () => {
  const result = checkInSchema.safeParse({ ...valid, name: "A", phone: "12", email: "x", check_out_date: "2026-11-01" });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error!.issues.map((issue) => issue.message).sort(),
    ["E-mail tidak valid", "Nama wajib diisi", "Nomor telepon tidak valid", "Tanggal check out tidak boleh sebelum tanggal check in"],
  );
});

it("requires both dates", () => {
  const result = checkInSchema.safeParse({ ...valid, check_in_date: "", check_out_date: "" });
  assert.deepEqual(
    result.error!.issues.map((issue) => issue.message).sort(),
    ["Tanggal check in wajib diisi", "Tanggal check out wajib diisi"],
  );
});
