import assert from "node:assert/strict";
import { it } from "node:test";
import { formatDateRange, formatWib } from "./time";

it("formats instants as Jakarta wall-clock time", () => {
  assert.equal(formatWib("2026-10-26T03:05:00Z"), "26/10/2026 10:05 WIB");
  assert.equal(formatWib("2026-12-31T17:30:00Z"), "01/01/2027 00:30 WIB");
});

it("formats visit date ranges in Indonesian", () => {
  assert.equal(formatDateRange("2026-11-02", "2026-11-04"), "2–4 Nov 2026");
  assert.equal(formatDateRange("2026-12-30", "2027-01-02"), "30 Des 2026 – 2 Jan 2027");
  assert.equal(formatDateRange("2026-11-02", "2026-11-02"), "2 Nov 2026");
});
