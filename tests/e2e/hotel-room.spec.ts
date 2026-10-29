import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { fillForm } from "./form";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("an attendee's hotel room number is saved, confirmed in the popup, and listed and searchable for admins", async ({ page }) => {
  const state = await installSupabaseStub(page, { checkins: [checkInRow({ name: "Siti Rahma", room_number: "0811" })] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await fillForm(page);
  await page.getByLabel("Nomor Kamar Hotel", { exact: true }).fill(" 1205 ");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Check-in berhasil" });
  await expect(popup.getByText("Kamar hotel", { exact: true })).toBeVisible();
  await expect(popup.getByText("1205", { exact: true })).toBeVisible();
  await expect(popup.getByText("Divisi Hukum", { exact: true })).toBeVisible();
  expect(state.rpcCalls[0].body.p_room_number).toBe("1205");
  expect(state.rpcCalls[0].body.p_divisi).toBe("Divisi Hukum");
  expect(state.checkins.at(-1)?.room_number).toBe("1205");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin");
  await signInAsAdmin(page);
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "Kamar" })).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: "Budi Santoso" })).toContainText("1205");
  await expect(table.getByRole("row").filter({ hasText: "Budi Santoso" })).toContainText("Divisi Hukum");
  await expect(table.getByRole("row").filter({ hasText: "Siti Rahma" })).toContainText("0811");
  await page.getByLabel("Cari nama, divisi, telepon, e-mail, atau kamar", { exact: true }).fill("1205");
  await expect(table.getByRole("row").filter({ hasText: "Siti Rahma" })).toHaveCount(0);
  await expect(table.getByRole("row").filter({ hasText: "Budi Santoso" })).toHaveCount(1);
});

test("without a room number the check-in request is the same as before", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Check-in berhasil" });
  await expect(popup).toBeVisible();
  await expect(popup.getByText("Kamar hotel", { exact: true })).toHaveCount(0);
  expect("p_room_number" in state.rpcCalls[0].body).toBe(false);
});

test("before migration 20261028000000 is applied, check-ins with and without a room number still go through", async ({ page }) => {
  const state = await installSupabaseStub(page, { legacyCheckIn: true });
  await page.goto("/");
  await fillForm(page);
  await page.getByLabel("Nomor Kamar Hotel", { exact: true }).fill("1205");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Check-in berhasil" })).toBeVisible();
  // The older function knows no room and requires an address: the retry leaves out the room and sends "-".
  expect(state.rpcCalls.map((call) => ["p_room_number" in call.body, call.body.p_address])).toEqual([
    [true, null],
    [false, "-"],
  ]);

  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await fillForm(page, { phone: "0812 3333 4444", email: "sari@example.test", name: "Sari Dewi" });
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Check-in berhasil" })).toBeVisible();
  expect(state.rpcCalls.slice(2).map((call) => ["p_room_number" in call.body, call.body.p_address])).toEqual([
    [false, null],
    [false, "-"],
  ]);
  expect(state.checkins.map((row) => row.address)).toEqual(["-", "-"]);
});
