import assert from "node:assert/strict";
import { it } from "node:test";
import { formatWib } from "./time";

it("formats instants as Jakarta wall-clock time", () => {
  assert.equal(formatWib("2026-10-26T03:05:00Z"), "26/10/2026 10:05 WIB");
  assert.equal(formatWib("2026-12-31T17:30:00Z"), "01/01/2027 00:30 WIB");
});
