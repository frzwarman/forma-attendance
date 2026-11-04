import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { finishIntro } from "./intro";
import { installSupabaseStub } from "./supabase-stub";

test("a returning attendee checks out with one tap on the same phone", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/registrasi");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText(/Saat pulang, buka tautan ini lagi/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  // The page header names the page instead of asking to check in.
  await expect(page.getByRole("heading", { name: "Informasi acara", exact: true })).toBeVisible();
  await expect(page.getByText("Silakan isi data diri Anda untuk check-in.")).toHaveCount(0);
  await expect(page.getByText("Budi Santoso", { exact: true })).toBeVisible();
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
  await page.goto("/registrasi");
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
  await page.goto("/registrasi");
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
    localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "unknown-code", name: "Budi Santoso", at: new Date().toISOString() }])),
  );
  await page.goto("/registrasi");
  await page.getByRole("button", { name: "Check out sekarang", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Kode check-out tidak dikenal");
  await page.getByRole("button", { name: "Hapus dari HP ini", exact: true }).click();
  await expect(page.getByLabel("Nama", { exact: true })).toBeVisible();
});

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

test("a check-in from before the current session is forgotten: the attendee checks in again for this one", async ({ page }) => {
  await installSupabaseStub(page, { sessions: [{ label: "Sesi 2", started_at: hoursAgo(1) }] });
  await page.addInitScript((at) => localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "sesi-1", name: "Budi Santoso", at }])), hoursAgo(3));
  await page.goto("/registrasi");
  await expect(page.getByLabel("Nama", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toHaveCount(0);
});

test("midnight changes nothing: a check-in stays until the admin starts the next session", async ({ page }) => {
  await installSupabaseStub(page, { sessions: [{ label: "Sesi 2", started_at: hoursAgo(40) }] });
  await page.addInitScript((at) => localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "kemarin", name: "Budi Santoso", at }])), hoursAgo(36));
  await page.goto("/registrasi");
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  await expect(page.getByText(/check-in lagi untuk sesi itu/)).toBeVisible();
});

test("a page left open moves on to the form when looked at again after the admin starts the next session", async ({ page }) => {
  const state = await installSupabaseStub(page, { sessions: [{ label: "Sesi 1", started_at: hoursAgo(2) }] });
  await page.addInitScript((at) => {
    if (!localStorage.getItem("guestbook.checkouts")) localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "kode-1", name: "Budi Santoso", at }]));
  }, hoursAgo(1));
  await page.goto("/registrasi");
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toBeVisible();
  // Mulai Sesi 2 while the phone is locked; unlocked, the page asks again.
  state.sessions.push({ label: "Sesi 2", started_at: new Date().toISOString() });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
  await expect(page.getByLabel("Nama", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anda sudah check-in" })).toHaveCount(0);
  // Not checked out: the code stays on the phone, and checking in again brings a new one.
  expect(state.rpcCalls.filter((call) => call.name === "guestbook_check_out")).toEqual([]);
});
