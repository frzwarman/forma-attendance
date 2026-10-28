import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fillForm } from "./form";
import { installSupabaseStub } from "./supabase-stub";

test("unsupported files are refused and block Kirim; an image is compressed to JPEG and attached", async ({ page }) => {
  const fixture = path.resolve("tests/fixtures/sample-2400.png");
  if (!fs.existsSync(fixture)) execSync("node scripts/make-test-fixtures.cjs", { stdio: "ignore" });
  const fixtureBytes = fs.statSync(fixture).size;
  const state = await installSupabaseStub(page);
  await page.goto("/");
  const picker = page.getByLabel("Pilih berkas", { exact: true });
  await picker.setInputFiles({
    name: "surat.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByText("Berkas harus berupa gambar atau PDF", { exact: true })).toBeVisible();
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText("Berkas harus berupa gambar atau PDF", { exact: true })).toBeVisible();
  expect(state.rpcCalls).toHaveLength(0);
  expect(state.uploads).toHaveLength(0);
  await picker.setInputFiles(fixture);
  await expect(page.getByText("Berkas harus berupa gambar atau PDF", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Terima kasih/ })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].contentType).toBe("image/jpeg");
  expect(state.uploads[0].path).toMatch(/^checkins\/[0-9a-f-]+\.jpg$/);
  expect(state.uploads[0].bytes).toBeLessThan(fixtureBytes);
  expect(state.rpcCalls[0].body.p_file_path).toBe(state.uploads[0].path);
  expect(state.checkins).toHaveLength(1);
});
