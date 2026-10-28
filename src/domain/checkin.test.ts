import assert from "node:assert/strict";
import { it } from "node:test";
import { checkInSchema } from "./checkin";

const valid = {
  name: "Budi Santoso",
  phone: "0812 1111 2222",
  email: "budi@example.test",
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

it("takes an optional hotel room number of at most 20 characters", () => {
  assert.equal(checkInSchema.safeParse({ ...valid, room_number: "" }).success, true);
  assert.equal(checkInSchema.safeParse({ ...valid, room_number: " 1205 " }).data?.room_number, "1205");
  const long = checkInSchema.safeParse({ ...valid, room_number: "x".repeat(21) });
  assert.deepEqual(long.error?.issues.map((issue) => issue.message), ["Nomor kamar maksimal 20 karakter"]);
});
