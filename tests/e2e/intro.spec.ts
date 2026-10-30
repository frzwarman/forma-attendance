import { expect, test } from "@playwright/test";
import { finishIntro } from "./intro";
import { installSupabaseStub } from "./supabase-stub";

test("the event slideshow opens on a first visit, can be browsed, and stays closed on reload", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Informasi acara" });
  await expect(dialog).toBeVisible();
  // The banner first, then the speakers, each with only the name-and-photo part of their CV;
  // no picture after them.
  const loadedWidth = (image: ReturnType<typeof dialog.getByRole>) => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth);
  const opening = dialog.getByRole("img", { name: /Jakarta, 1 - 6 November 2026\. Bersama rakyat awasi pemilu/ });
  await expect(opening).toBeInViewport({ ratio: 0.9 });
  await expect.poll(() => loadedWidth(opening)).toBe(960);
  await expect(dialog.getByText("1 dari 10", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("img", { name: /halaman/ })).toHaveCount(0);
  // No way out before the last slide: no close button, and Mulai check-in waits there.
  await expect(dialog.getByRole("button", { name: "Tutup" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Mulai check-in", exact: true })).toHaveCount(0);
  const next = dialog.getByRole("button", { name: "Slide berikutnya" });
  const previous = dialog.getByRole("button", { name: "Slide sebelumnya" });
  // The arrows stay exactly where they are from slide to slide, so tap after tap lands on them.
  await page.waitForTimeout(500); // the popup's opening animation
  const arrowsAt = [(await previous.boundingBox())!, (await next.boundingBox())!];
  const stayed = async () => {
    await page.waitForTimeout(400); // the slide change and the sheet's height animation
    const box = (await previous.boundingBox())!;
    expect([box.x, box.y]).toEqual([arrowsAt[0].x, arrowsAt[0].y]);
    if (await next.count()) expect((await next.boundingBox())!.y).toBe(arrowsAt[1].y);
  };
  await next.click();
  await expect(dialog.getByRole("heading", { name: "Dr. Agus Canny" })).toBeInViewport();
  await expect(dialog.getByRole("img", { name: "Profil Dr. Agus Canny" })).toBeInViewport();
  await expect(dialog.getByText("2 dari 10", { exact: true })).toBeVisible();
  await stayed();
  // On a phone the arrows stay inside the popup.
  expect(arrowsAt[1].x + 44).toBeLessThanOrEqual((await dialog.boundingBox())!.x + (await dialog.boundingBox())!.width);
  for (let slide = 3; slide <= 9; slide++) {
    await next.click();
    await expect(dialog.getByText(`${slide} dari 10`, { exact: true })).toBeVisible();
    await stayed();
  }
  await next.click();
  await stayed();
  // The last speaker is the last slide, and Mulai check-in takes the place of the counter and the next arrow.
  await expect(dialog.getByRole("heading", { name: "Tim Positium" })).toBeInViewport();
  await expect(dialog.getByRole("img", { name: /Grand Sahid Jaya Hotel/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Mulai check-in", exact: true })).toBeInViewport();
  await expect(next).toHaveCount(0);
  await expect(dialog.getByText("10 dari 10", { exact: true })).toHaveCount(0);
  // The last slide lines up with the popup instead of stopping short of it.
  await expect
    .poll(() => dialog.locator(".intro-track").evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft))
    .toBeLessThan(1);
  // Escape and a tap on the dimmed page around the popup do not close it either.
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Mulai check-in", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Informasi acara" })).toHaveCount(0);
});

test("Mulai check-in closes the slideshow so the form can be filled", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.goto("/");
  await finishIntro(page);
  await page.getByLabel("Nama", { exact: true }).fill("Budi Santoso");
  await expect(page.getByLabel("Nama", { exact: true })).toHaveValue("Budi Santoso");
});

test("the network illustration sits to the right of the logo on a phone", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const logo = (await page.getByRole("img", { name: "Buku Tamu" }).first().boundingBox())!;
  const art = page.getByTestId("event-illustration");
  await expect(art).toBeVisible();
  const box = (await art.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(logo.x + logo.width - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeLessThan(logo.y + logo.height);
  expect(box.width).toBeGreaterThan(100);
});

test("on a laptop screen the slides share one height, so the arrows stay put", async ({ page }) => {
  await installSupabaseStub(page, { intro: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Informasi acara" });
  const previous = dialog.getByRole("button", { name: "Slide sebelumnya" });
  const next = dialog.getByRole("button", { name: "Slide berikutnya" });
  await expect(next).toBeVisible();
  await page.waitForTimeout(500); // the popup's opening animation
  const at = (await previous.boundingBox())!;
  for (let slide = 2; slide <= 10; slide++) {
    await next.click();
    // On the last slide Mulai check-in takes the place of the dots.
    if (slide < 10) await expect(dialog.getByRole("button", { name: `Ke slide ${slide}` })).toHaveAttribute("aria-current", "true");
    await page.waitForTimeout(400);
    const box = (await previous.boundingBox())!;
    expect([box.x, box.y], `slide ${slide}`).toEqual([at.x, at.y]);
  }
  await expect(dialog.getByRole("button", { name: "Mulai check-in", exact: true })).toBeVisible();
});
