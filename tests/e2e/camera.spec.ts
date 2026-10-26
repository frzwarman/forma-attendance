import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { installSupabaseStub } from "./supabase-stub";

test("a photo taken with the camera can be retaken, attached and sent with the check-in", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["camera"], { origin: new URL(baseURL!).origin });
  const state = await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ambil foto", exact: true }).click();
  const shutter = page.getByRole("button", { name: "Potret", exact: true });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await shutter.click();
  const preview = page.getByRole("img", { name: "Pratinjau foto" });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Ulangi", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await page.getByRole("button", { name: "Gunakan foto", exact: true }).click();
  await expect(page.getByRole("img", { name: "Foto terlampir" })).toBeVisible();
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Terima kasih/ })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].contentType).toBe("image/jpeg");
  expect(state.uploads[0].path).toMatch(/^checkins\/[0-9a-f-]+\.jpg$/);
  expect(state.rpcCalls[0].body.p_file_path).toBe(state.uploads[0].path);
});

test("a denied camera explains how to continue and keeps the file picker", async ({ page, context, baseURL }) => {
  await context.grantPermissions([], { origin: new URL(baseURL!).origin });
  await installSupabaseStub(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Ambil foto", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Akses kamera ditolak", { timeout: 15000 });
  await expect(page.getByRole("img", { name: "Pratinjau foto" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tutup kamera", exact: true }).click();
  await expect(page.getByLabel("Pilih berkas", { exact: true })).toBeAttached();
});
