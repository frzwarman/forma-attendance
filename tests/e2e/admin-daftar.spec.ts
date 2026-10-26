import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("the list loads every page and shows the total", async ({ page }) => {
  const checkins = Array.from({ length: 2000 }, () => checkInRow());
  const state = await installSupabaseStub(page, { checkins });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Total check-in: 2.000", { exact: true })).toBeVisible();
  expect(state.rangeHeaders.slice(0, 3)).toEqual(["0-999", "1000-1999", "2000-2999"]);
});

test("search narrows the list by name, phone or e-mail", async ({ page }) => {
  await installSupabaseStub(page, {
    checkins: [
      checkInRow({ name: "Budi Santoso", phone: "0812 1111 2222", email: "budi@example.test" }),
      checkInRow({ name: "Siti Rahma", phone: "0813 3333 4444", email: "siti@example.test" }),
      checkInRow({ name: "Agus Wijaya", phone: "0815 5555 6666", email: "agus@example.test" }),
    ],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  const search = page.getByLabel("Cari nama, telepon, atau e-mail", { exact: true });
  await expect(page.getByText("Agus Wijaya", { exact: true })).toBeVisible();
  await search.fill("0813");
  await expect(page.getByText("Siti Rahma", { exact: true })).toBeVisible();
  await expect(page.getByText("Budi Santoso", { exact: true })).toHaveCount(0);
  await search.fill("SITI");
  await expect(page.getByText("Siti Rahma", { exact: true })).toBeVisible();
  await expect(page.getByText("Agus Wijaya", { exact: true })).toHaveCount(0);
  await search.fill("");
  await expect(page.getByText("Budi Santoso", { exact: true })).toBeVisible();
  await expect(page.getByText("Agus Wijaya", { exact: true })).toBeVisible();
});

test("an uploaded file opens through a signed link", async ({ page }) => {
  const state = await installSupabaseStub(page, {
    checkins: [checkInRow({ name: "Budi Santoso", file_path: "checkins/abc.jpg" })],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Lihat berkas", exact: true }).click();
  const opened = await popup;
  await opened.waitForURL(/checkins\/abc\.jpg/);
  expect(opened.url()).toContain("checkins/abc.jpg");
  expect(state.signedPaths).toEqual(["checkins/abc.jpg"]);
});
