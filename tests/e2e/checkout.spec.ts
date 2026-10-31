import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { finishIntro } from "./intro";
import { installSupabaseStub } from "./supabase-stub";

test("a returning attendee checks out with one tap on the same phone", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText(/Saat pulang, buka tautan ini lagi/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  // The page header names the page instead of asking to check in.
  await expect(page.getByRole("heading", { name: "Informasi acara", exact: true })).toBeVisible();
  await expect(page.getByText("Silakan isi data diri Anda untuk check-in.")).toHaveCount(0);
  await expect(page.getByText(/Budi Santoso/)).toBeVisible();
  await expect(page.getByLabel("Nama", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Check out sekarang", exact: true }).click();
  // A popup, over the registration form the page went back to (from the top).
  const popup = page.getByRole("dialog", { name: "Check-out berhasil" });
  await expect(popup.getByRole("heading", { name: "Sampai jumpa, Budi Santoso!" })).toBeVisible();
  await expect(popup.getByText(/Check-out tercatat pada \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB/)).toBeVisible();
  expect(state.checkins[0].checked_out_at).toBeTruthy();
  await popup.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Sampai jumpa/ })).toHaveCount(0);
  await expect(page.getByLabel("Nama", { exact: true })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Buku Tamu" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nama", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sampai jumpa/ })).toHaveCount(0);
});

test("checked out after the morning session, the attendee checks in again and can check out again", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await page.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();
  await page.getByRole("button", { name: "Check out sekarang", exact: true }).click();
  await page.getByRole("dialog", { name: "Check-out berhasil" }).getByRole("button", { name: "Selesai", exact: true }).click();
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText(/Saat pulang, buka tautan ini lagi/)).toBeVisible();
  await page.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();
  expect(state.checkins).toHaveLength(1);
  expect(state.checkins[0].checked_out_at).toBeNull();
  await page.getByRole("button", { name: "Check out sekarang", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Check-out berhasil" }).getByText(/^Check-out tercatat pada/)).toBeVisible();
  expect(state.checkins[0].checked_out_at).toBeTruthy();
});

test("the slideshow does not open again for an attendee returning to check out", async ({ page }) => {
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

test("an unknown check-out code is explained and can be removed from the phone", async ({ page }) => {
  await installSupabaseStub(page);
  await page.addInitScript(() =>
    localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "unknown-code", name: "Budi Santoso", at: "2026-10-26T03:05:00Z" }])),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Check out sekarang", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Kode check-out tidak dikenal");
  await page.getByRole("button", { name: "Hapus dari HP ini", exact: true }).click();
  await expect(page.getByLabel("Nama", { exact: true })).toBeVisible();
});
