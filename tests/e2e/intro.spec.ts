import { expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("the event slideshow opens on a first visit, can be browsed, and stays closed on reload", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Informasi acara" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Jakarta, 2 - 6 November 2029", { exact: true })).toBeInViewport();
  await dialog.getByRole("button", { name: "Slide berikutnya" }).click();
  await expect(dialog.getByRole("heading", { name: "Lima hari sesi panel dan lokakarya" })).toBeInViewport();
  await dialog.getByRole("button", { name: "Ke slide 4" }).click();
  await expect(dialog.getByRole("heading", { name: "Lokasi acara di Jakarta" })).toBeInViewport();
  await expect(dialog.getByRole("img", { name: "Bundaran HI dan gedung-gedung di Jakarta" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Informasi acara" })).toHaveCount(0);
});

test("Mulai check-in closes the slideshow so the form can be filled", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai check-in", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Informasi acara" })).toHaveCount(0);
  await page.getByLabel("Nama", { exact: true }).fill("Budi Santoso");
  await expect(page.getByLabel("Nama", { exact: true })).toHaveValue("Budi Santoso");
});

test("the network illustration sits to the right of the logo on a phone", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const logo = (await page.getByRole("img", { name: "Buku Tamu" }).first().boundingBox())!;
  const art = page.getByTestId("event-illustration");
  await expect(art).toBeVisible();
  const box = (await art.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(logo.x + logo.width - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeLessThan(logo.y + logo.height);
  expect(box.width).toBeGreaterThan(100);
});
