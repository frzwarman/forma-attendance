import { expect, type Page } from "@playwright/test";

// The opening popup can only be left from its last slide: page through, then tap Mulai check-in.
export async function finishIntro(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Informasi acara" });
  const track = dialog.locator(".intro-track");
  const next = dialog.getByRole("button", { name: "Slide berikutnya" });
  const start = dialog.getByRole("button", { name: "Mulai check-in", exact: true });
  // Not mid-scroll: on a slide boundary and still there a moment later. A tap sent while a slide
  // change is under way can hit the next arrow just as Mulai check-in replaces it.
  const settled = () =>
    track.evaluate(async (el) => {
      const at = el.scrollLeft;
      await new Promise((done) => setTimeout(done, 150));
      return el.scrollLeft === at && Math.abs(at / el.clientWidth - Math.round(at / el.clientWidth)) < 0.01;
    });
  await expect(dialog).toBeVisible();
  for (;;) {
    await expect.poll(settled).toBe(true);
    if (await start.isVisible()) break;
    await next.click();
  }
  await start.click();
  await expect(dialog).toHaveCount(0);
}
