import assert from "node:assert/strict";
import { it } from "node:test";
import { checkInSchema } from "./checkin";

const valid = {
  name: "Budi Santoso",
  phone: "0812 1111 2222",
  email: "budi@example.test",
  address: "Jl. MH Thamrin 14",
};

it("accepts a complete check-in", () => {
  assert.equal(checkInSchema.safeParse(valid).success, true);
});

it("reports every invalid field in Bahasa", () => {
  const result = checkInSchema.safeParse({ ...valid, name: "A", phone: "12", email: "x" });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error!.issues.map((issue) => issue.message).sort(),
    ["E-mail tidak valid", "Nama wajib diisi", "Nomor telepon tidak valid"],
  );
});
