import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { finishIntro } from "./intro";
import { installSupabaseStub } from "./supabase-stub";

test("back on the same phone, the attendee sees they are checked in, with no check-out button", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Terima kasih, Budi Santoso!" })).toBeVisible();
  await expect(page.getByText(/Check out sekarang/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  // The page header names the page instead of asking to check in.
  await expect(page.getByRole("heading", { name: "Informasi acara", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buku Tamu" })).toHaveCount(0);
  await expect(page.getByText("Silakan isi data diri Anda untuk check-in.")).toHaveCount(0);
  await expect(page.getByText("Budi Santoso", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Check-in \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/)).toBeVisible();
  await expect(page.getByLabel("Nama", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /check/i })).toHaveCount(0);
});

test("the slideshow does not open again for an attendee returning to the page", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.goto("/");
  await finishIntro(page);
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Terima kasih/ })).toBeVisible();
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Informasi acara" })).toHaveCount(0);
});
