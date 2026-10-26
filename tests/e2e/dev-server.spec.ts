import { expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("the development server bundles and serves the public page", async ({ page }) => {
  await installSupabaseStub(page);
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible({ timeout: 120000 });
  expect(failures).toEqual([]);
});
