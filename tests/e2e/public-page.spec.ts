import { expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("the public page shows the event name, welcome text and logo from settings", async ({ page }) => {
  await installSupabaseStub(page, { settings: { event_name: "Rakernas Bawaslu 2026", welcome_text: "Selamat datang, silakan check-in." } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rakernas Bawaslu 2026" })).toBeVisible();
  await expect(page.getByText("Selamat datang, silakan check-in.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Rakernas Bawaslu 2026" })).toBeVisible();
  await expect(page.getByText("Formulir Check-in")).toBeVisible();
});

test("the public page renders the Bawaslu defaults when settings cannot be loaded", async ({ page }) => {
  await installSupabaseStub(page, { failSettings: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Buku Tamu" })).toBeVisible();
  await expect(page.getByText("Formulir Check-in")).toBeVisible();
});

test("the background image keeps covering the viewport when a long form is scrolled", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await page.getByTestId("backdrop-image").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: window.innerHeight, scrollY: window.scrollY };
  });
  expect(box.scrollY).toBeGreaterThan(200);
  expect(box.top).toBeLessThanOrEqual(0);
  expect(box.bottom).toBeGreaterThanOrEqual(box.height);
});
