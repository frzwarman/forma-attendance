import { expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("text fields use 16px type so phones do not zoom in on focus", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const label of ["Nama", "Nomor Telepon", "E-mail", "Nomor Kamar Hotel"]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveCSS("font-size", "16px");
  }
});
