import assert from "node:assert/strict";
import { it } from "node:test";
import { isMentimeterUrl } from "./mentimeter";

it("accepts https links on Mentimeter's own domains", () => {
  for (const url of [
    "https://www.menti.com/al1b2c3d4e5f",
    "https://menti.com/al1b2c3d4e5f",
    "https://www.mentimeter.com/app/presentation/al1b2c3d4e5f",
    "https://www.menti.com/",
  ])
    assert.equal(isMentimeterUrl(url), true, url);
});

it("rejects other sites, plain http and text that is not a link", () => {
  for (const url of [
    "http://www.menti.com/al1b2c3d4e5f",
    "https://menti.com.example.org/al1b2c3d4e5f",
    "https://evilmenti.com/al1b2c3d4e5f",
    "javascript:alert(1)",
    "www.menti.com/al1b2c3d4e5f",
    "",
  ])
    assert.equal(isMentimeterUrl(url), false, url);
});
