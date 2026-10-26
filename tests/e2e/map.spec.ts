import { devices, expect, test } from "@playwright/test";
import { installSupabaseStub } from "./supabase-stub";

test("scrolling the form over the map moves the page instead of zooming the map", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const map = page.getByRole("img", { name: "Peta lokasi" });
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await expect.poll(async () => (await map.boundingBox())!.y).toBeLessThan(box.y - 150);
});

test.describe("on a phone", () => {
  const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("a one-finger swipe over the map scrolls the page", async ({ page }) => {
    await installSupabaseStub(page);
    await page.goto("/");
    const map = page.getByRole("img", { name: "Peta lokasi" });
    await expect(map).toHaveClass(/leaflet-container/);
    await expect(map).not.toHaveClass(/leaflet-touch-drag/);
    await expect(map).toHaveCSS("touch-action", "pan-x pan-y");
  });
});
