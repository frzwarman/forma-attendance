import { expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("the event slideshow opens on a first visit, can be browsed, and stays closed on reload", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Informasi acara" });
  await expect(dialog).toBeVisible();
  // Speakers come first, each with only the name-and-photo part of their CV, then the Bawaslu title card.
  await expect(dialog.getByRole("heading", { name: "Dr. Agus Canny" })).toBeInViewport();
  await expect(dialog.getByRole("img", { name: "Profil Dr. Agus Canny" })).toBeVisible();
  await expect(dialog.getByRole("img", { name: /halaman/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Mulai check-in", exact: true })).toBeInViewport();
  const next = dialog.getByRole("button", { name: "Slide berikutnya" });
  await next.click();
  await expect(dialog.getByRole("heading", { name: "Muhammad Juan Al Qausar" })).toBeInViewport();
  await expect(dialog.getByText("2 dari 10", { exact: true })).toBeVisible();
  // On a phone the arrows stay inside the popup.
  expect((await next.boundingBox())!.x + 44).toBeLessThanOrEqual((await dialog.boundingBox())!.x + (await dialog.boundingBox())!.width);
  for (let slide = 3; slide <= 10; slide++) {
    await next.click();
    await expect(dialog.getByText(`${slide} dari 10`, { exact: true })).toBeVisible();
  }
  await expect(dialog.getByText("Jakarta, 2 - 6 November 2029", { exact: true })).toBeInViewport();
  await expect(next).toBeDisabled();
  // The title card lines up with the popup instead of stopping short of it.
  await expect
    .poll(() => dialog.locator(".intro-track").evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft))
    .toBeLessThan(1);
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
