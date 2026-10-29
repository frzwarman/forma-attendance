import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("an attendee checks in, sees a thank-you popup, then the event information page", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Jabatan", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tanggal Check In", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tanggal Check Out", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Lokasi", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Alamat", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Peta lokasi" })).toHaveCount(0);
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Check-in berhasil" });
  await expect(popup.getByRole("heading", { name: "Terima kasih, Budi Santoso!" })).toBeVisible();
  await expect(popup.getByText("Waktu check-in", { exact: true })).toBeVisible();
  await expect(popup.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Isi check-in lain" })).toHaveCount(0);
  expect(state.rpcCalls[0].body.p_jabatan).toBeNull();
  expect(state.rpcCalls[0].body.p_check_in_date).toBeNull();
  expect(state.rpcCalls[0].body.p_check_out_date).toBeNull();
  expect(state.rpcCalls[0].body.p_address).toBeNull();
  expect(state.rpcCalls[0].body.p_latitude).toBeNull();
  expect(state.checkins).toHaveLength(1);
  expect(state.checkins[0].phone).toBe("0812 1111 2222");
  await popup.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();
  await expect(popup).toHaveCount(0);
  const info = page.getByRole("region", { name: "Informasi acara" });
  await expect(info).toBeVisible();
  // The event theme picture alone, without the opening popup's key visual and speakers.
  await expect(info.getByRole("img", { name: /^Ekosistem Digitalisasi Pemilu 2029/ })).toBeVisible();
  await expect(info.getByRole("region", { name: /^Slide/ })).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check-in untuk orang lain" })).toHaveCount(0);
  await expect(page.getByLabel("Nama", { exact: true })).toHaveCount(0);
});

test("the organiser WhatsApp button stays at the bottom-right corner while scrolling", async ({ page }) => {
  await installSupabaseStub(page, { settings: { whatsapp_number: "0812-3456-7890" } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const help = page.getByRole("link", { name: "Hubungi Panitia via WhatsApp" });
  await expect(help).toHaveAttribute("href", "https://wa.me/6281234567890");
  const before = (await help.boundingBox())!;
  expect(before.x + before.width).toBeGreaterThan(390 - 40);
  expect(before.y + before.height).toBeGreaterThan(844 - 60);
  await page.getByRole("button", { name: "Kirim", exact: true }).scrollIntoViewIfNeeded();
  const after = (await help.boundingBox())!;
  expect(Math.round(after.y)).toBe(Math.round(before.y));
});

test("without an organiser number there is no WhatsApp button", async ({ page }) => {
  await installSupabaseStub(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hubungi Panitia via WhatsApp" })).toHaveCount(0);
});

test("a repeated phone number is reported with the earlier check-in time and not saved again", async ({ page }) => {
  const state = await installSupabaseStub(page, {
    checkins: [checkInRow({ phone: "081211112222", email: "budi@example.test", created_at: "2026-10-26T03:05:00Z" })],
  });
  await page.goto("/");
  await fillForm(page, { phone: "+62 812-1111-2222", email: "lain@example.test" });
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("sudah terdaftar pada 26/10/2026 10:05 WIB");
  expect(state.checkins).toHaveLength(1);
});

test("validation messages appear in Bahasa before anything is sent", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  for (const message of [
    "Nama wajib diisi",
    "Nomor telepon tidak valid",
    "E-mail tidak valid",
  ]) {
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  }
  expect(state.rpcCalls).toHaveLength(0);
});

test("the hidden honeypot blocks bots", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/");
  await fillForm(page);
  await page.locator('input[aria-label="Kosongkan kolom ini"]').fill("bot", { force: true });
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Pengiriman ditolak. Coba lagi.");
  expect(state.checkins).toHaveLength(0);
});
