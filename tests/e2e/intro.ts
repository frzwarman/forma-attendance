import { expect, type Page } from "@playwright/test";

// The opening popup can only be left from its last slide: page through, then tap Mulai check-in.
export async function finishIntro(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Informasi acara" });
  const next = dialog.getByRole("button", { name: "Slide berikutnya" });
  await expect(next).toBeVisible();
  const track = dialog.locator(".intro-track");
  const atEnd = () => track.evaluate((el) => el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  while (!(await atEnd())) {
    const before = await track.evaluate((el) => el.scrollLeft);
    await next.click();
    // Wait until the slide has arrived, so the last tap is not sent while the arrow is being disabled.
    await expect.poll(() => track.evaluate((el, from) => el.scrollLeft - from >= el.clientWidth - 1, before)).toBe(true);
  }
  await expect(next).toHaveCount(0);
  await dialog.getByRole("button", { name: "Mulai check-in", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
