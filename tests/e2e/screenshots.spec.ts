import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("captures reference screenshots of the public form and the admin list", async ({ page }) => {
  await installSupabaseStub(page, {
    settings: { event_name: "Rakernas Bawaslu 2026", whatsapp_number: "0812-3456-7890" },
    checkins: [
      checkInRow({ name: "Budi Santoso" }),
      checkInRow({ name: "Siti Rahma", file_path: "checkins/abc.jpg" }),
      checkInRow({ name: "Agus Wijaya" }),
    ],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/public-390.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Total check-in: 3", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/admin-daftar-1280.png", fullPage: true });
});
