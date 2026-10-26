import type { Page } from "@playwright/test";

export async function signInAsAdmin(page: Page, password = "rahasia123") {
  await page.getByLabel("E-mail", { exact: true }).fill("admin@bawaslu.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}
