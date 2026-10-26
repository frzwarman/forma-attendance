import assert from "node:assert/strict";
import { it } from "node:test";
import { BAWASLU, contrastText, deriveTheme, isHexColor } from "./theme";

it("picks readable text for the brand colours", () => {
  assert.equal(contrastText("#ec1c24"), "#ffffff");
  assert.equal(contrastText("#d1aa67"), "#1e1e1e");
  assert.equal(contrastText("#00243f"), "#ffffff");
  assert.equal(contrastText("#ffffff"), "#1e1e1e");
});

it("derives the Bawaslu theme", () => {
  const t = deriveTheme(BAWASLU);
  assert.equal(t.accent, "#ec1c24");
  assert.equal(t.onAccent, "#ffffff");
  assert.equal(t.onBackground, "#ffffff");
  assert.equal(t.surface, "#ffffff");
  assert.equal(t.text, "#1e1e1e");
  assert.equal(t.gold, "#d1aa67");
  assert.equal(t.muted, "rgba(30, 30, 30, 0.65)");
  assert.equal(t.border, "rgba(30, 30, 30, 0.18)");
  assert.equal(t.overlay, "rgba(0, 36, 63, 0.72)");
});

it("validates hex colours", () => {
  assert.equal(isHexColor("#EC1C24"), true);
  assert.equal(isHexColor("#abc"), false);
  assert.equal(isHexColor("red"), false);
});
