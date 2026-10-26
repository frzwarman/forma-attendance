import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fillForm } from "./form";
import { installSupabaseStub } from "./supabase-stub";

test("the map pin and typed address are saved with the check-in", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -6.1754, longitude: 106.8272 });
  const state = await installSupabaseStub(page);
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Gunakan lokasi saya", exact: true }).click();
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Terima kasih/ })).toBeVisible();
  const call = state.rpcCalls[0].body;
  expect(call.p_latitude as number).toBeCloseTo(-6.1754, 3);
  expect(call.p_longitude as number).toBeCloseTo(106.8272, 3);
  expect(call.p_address).toBe("Jl. MH Thamrin 14");
});

test("an image upload is compressed to JPEG and attached; unsupported files are refused", async ({ page }) => {
  const fixture = path.resolve("tests/fixtures/sample-2400.png");
  if (!fs.existsSync(fixture)) execSync("node scripts/make-test-fixtures.cjs", { stdio: "ignore" });
  const fixtureBytes = fs.statSync(fixture).size;
  const state = await installSupabaseStub(page);
  await page.goto("/");
  await page.getByLabel("Unggah Berkas (opsional)", { exact: true }).setInputFiles(fixture);
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Terima kasih/ })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].contentType).toBe("image/jpeg");
  expect(state.uploads[0].path).toMatch(/^checkins\/[0-9a-f-]+\.jpg$/);
  expect(state.uploads[0].bytes).toBeLessThan(fixtureBytes);
  expect(state.rpcCalls[0].body.p_file_path).toBe(state.uploads[0].path);
  await page.getByRole("button", { name: "Isi check-in lain", exact: true }).click();
  await page.getByLabel("Unggah Berkas (opsional)", { exact: true }).setInputFiles({
    name: "surat.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByText("Berkas harus berupa gambar atau PDF", { exact: true })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
});
