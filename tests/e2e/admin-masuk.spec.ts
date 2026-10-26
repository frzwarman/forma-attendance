import { expect, test, type Page } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

export async function signInAsAdmin(page: Page, password = "rahasia123") {
  await page.getByLabel("E-mail", { exact: true }).fill("admin@bawaslu.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test("admins must sign in and wrong passwords are explained", async ({ page }) => {
  await installSupabaseStub(page, { admin: { email: "admin@bawaslu.test", password: "rahasia123" } });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Masuk Admin" })).toBeVisible();
  await signInAsAdmin(page, "salah");
  await expect(page.getByRole("alert")).toContainText("E-mail atau kata sandi salah");
  await signInAsAdmin(page);
  await expect(page.getByRole("heading", { name: "Daftar Check-in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Undian" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tampilan" })).toBeVisible();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Masuk Admin" })).toBeVisible();
});

test("the admin area survives a reload while signed in", async ({ page }) => {
  await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByRole("heading", { name: "Daftar Check-in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Daftar Check-in" })).toBeVisible();
});
