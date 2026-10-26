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

test("the public page scrolls to the bottom with the wheel while the background keeps covering the viewport", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const kirim = page.getByRole("button", { name: "Kirim", exact: true });
  await expect(kirim).toBeAttached();
  expect((await kirim.boundingBox())!.y).toBeGreaterThan(844);
  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, 5000);
  await expect
    .poll(async () => {
      const box = await kirim.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(844);
  const layer = await page.getByTestId("backdrop-image").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: window.innerHeight };
  });
  expect(layer.top).toBeLessThanOrEqual(0);
  expect(layer.bottom).toBeGreaterThanOrEqual(layer.height);
});
