import { expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("date fields fit a phone, stack vertically, and show a hint until a date is chosen", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const checkIn = page.getByLabel("Tanggal Check In", { exact: true });
  const checkOut = page.getByLabel("Tanggal Check Out", { exact: true });
  await checkOut.scrollIntoViewIfNeeded();
  const card = (await page.getByRole("button", { name: "Kirim", exact: true }).boundingBox())!;
  const first = (await checkIn.boundingBox())!;
  const second = (await checkOut.boundingBox())!;
  for (const box of [first, second]) {
    expect(box.x).toBeGreaterThanOrEqual(card.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 1);
  }
  expect(second.y).toBeGreaterThan(first.y + first.height);
  await expect(checkIn).toHaveCSS("appearance", "none");
  await expect(page.getByText("Pilih tanggal", { exact: true })).toHaveCount(2);
  await checkIn.fill("2026-11-02");
  await expect(page.getByText("Pilih tanggal", { exact: true })).toHaveCount(1);
  await expect(checkIn).toHaveValue("2026-11-02");
});

test("text fields use 16px type so phones do not zoom in on focus", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const label of ["Nama", "Nomor Telepon", "E-mail", "Alamat", "Tanggal Check In"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCSS("font-size", "16px");
  }
});
