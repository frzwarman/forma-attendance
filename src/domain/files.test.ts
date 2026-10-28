import assert from "node:assert/strict";
import { it } from "node:test";
import { formatFileSize } from "./files";

it("shows sizes in KB below a megabyte and in MB with a decimal comma above", () => {
  assert.equal(formatFileSize(300), "1 KB");
  assert.equal(formatFileSize(48 * 1024), "48 KB");
  assert.equal(formatFileSize(1.5 * 1024 * 1024), "1,5 MB");
});
