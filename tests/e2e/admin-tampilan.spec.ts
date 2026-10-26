import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { signInAsAdmin } from "./admin";
import { installSupabaseStub } from "./supabase-stub";

test("theme changes are saved and reflected on the public page", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Tampilan" }).click();
  await expect(page.getByRole("heading", { name: "Tampilan" })).toBeVisible();
  await page.getByLabel("Nama acara", { exact: true }).fill("Rakernas Bawaslu 2026");
  await page.getByLabel("Warna aksen", { exact: true }).fill("#005bbb");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tampilan disimpan.", { exact: true })).toBeVisible();
  expect(state.settings.event_name).toBe("Rakernas Bawaslu 2026");
  expect(state.settings.accent_color).toBe("#005bbb");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rakernas Bawaslu 2026" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toHaveCSS("background-color", "rgb(0, 91, 187)");
});

test("the Bawaslu preset restores the defaults and a logo upload is stored in the brand bucket", async ({ page }) => {
  const fixture = path.resolve("tests/fixtures/sample-2400.png");
  if (!fs.existsSync(fixture)) execSync("node scripts/make-test-fixtures.cjs", { stdio: "ignore" });
  const state = await installSupabaseStub(page, { settings: { accent_color: "#005bbb", logo_path: "logo-1.png" } });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Tampilan" }).click();
  await expect(page.getByLabel("Warna aksen", { exact: true })).toHaveValue("#005bbb");
  await page.getByRole("button", { name: "Gunakan preset Bawaslu", exact: true }).click();
  await expect(page.getByLabel("Warna aksen", { exact: true })).toHaveValue("#ec1c24");
  await page.getByLabel("Logo", { exact: true }).setInputFiles(fixture);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tampilan disimpan.", { exact: true })).toBeVisible();
  expect(state.uploads.at(-1)?.bucket).toBe("guestbook-brand");
  expect(state.settings.logo_path).toMatch(/^logo-\d+\.(png|jpg)$/);
  expect(state.settings.accent_color).toBe("#ec1c24");
});
