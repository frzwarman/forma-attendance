import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("an attendee can check in and sees a thank-you with the organiser WhatsApp button", async ({ page }) => {
  const state = await installSupabaseStub(page, { settings: { whatsapp_number: "0812-3456-7890" } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Jabatan", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tanggal Check In", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tanggal Check Out", { exact: true })).toHaveCount(0);
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Terima kasih, Budi Santoso!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hubungi Panitia via WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890");
  expect(state.rpcCalls[0].body.p_jabatan).toBeNull();
  expect(state.rpcCalls[0].body.p_check_in_date).toBeNull();
  expect(state.rpcCalls[0].body.p_check_out_date).toBeNull();
  await expect(page.getByText("Waktu check-in", { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/)).toBeVisible();
  expect(state.checkins).toHaveLength(1);
  expect(state.checkins[0].phone).toBe("0812 1111 2222");
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
    "Alamat wajib diisi",
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
