import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import { signInAsAdmin } from "./admin";
import { fillForm } from "./form";
import { installSupabaseStub } from "./supabase-stub";

async function download(page: Page, name: string) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name, exact: true }).click()]);
  return { name: file.suggestedFilename(), head: fs.readFileSync((await file.path())!).subarray(0, 5).toString() };
}

test("after check-in the attendee finds the Mentimeter link and the materials", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Panduan acara" })).toHaveCount(0);
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await page.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();
  const guide = page.getByRole("region", { name: "Panduan acara" });
  const menti = guide.getByRole("link", { name: "Ikut polling di Mentimeter" });
  await expect(menti).toHaveAttribute("href", "https://www.menti.com/");
  await expect(menti).toHaveAttribute("target", "_blank");
  await expect(guide.getByRole("list", { name: "Ruangan" })).toHaveCount(0);
  await expect(guide.getByRole("list", { name: "Materi" }).getByRole("listitem")).toHaveCount(2);
  expect(await download(page, "Unduh Panduan peserta")).toEqual({ name: "panduan-peserta.pdf", head: "%PDF-" });
});

test("the rundown shows one page at a time with next and back, and each speaker's CV opens as images, with no download", async ({ page }) => {
  await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await page.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();
  const guide = page.getByRole("region", { name: "Panduan acara" });
  const loaded = (image: Locator) => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth);
  // One rundown page at a time; the arrows (or a swipe) move between them.
  const first = guide.getByRole("img", { name: "Rundown acara, halaman 1 dari 2" });
  const second = guide.getByRole("img", { name: "Rundown acara, halaman 2 dari 2" });
  await first.scrollIntoViewIfNeeded();
  await expect.poll(() => loaded(first)).toBe(1240);
  await expect(first).toBeInViewport({ ratio: 0.9 });
  await expect(second).not.toBeInViewport({ ratio: 0.05 });
  await expect(guide.getByText("Halaman 1 dari 2", { exact: true })).toBeVisible();
  await expect(guide.getByRole("button", { name: "Halaman sebelumnya" })).toBeDisabled();
  await guide.getByRole("button", { name: "Halaman berikutnya" }).click();
  await expect(guide.getByText("Halaman 2 dari 2", { exact: true })).toBeVisible();
  await expect(second).toBeInViewport({ ratio: 0.9 });
  await expect(first).not.toBeInViewport({ ratio: 0.05 });
  await expect(guide.getByRole("button", { name: "Halaman berikutnya" })).toBeDisabled();
  await guide.getByRole("button", { name: "Halaman sebelumnya" }).click();
  await expect(guide.getByText("Halaman 1 dari 2", { exact: true })).toBeVisible();
  // A swipe moves the track the same way.
  await guide.getByRole("region", { name: "Halaman 1 dari 2" }).evaluate((slide) => slide.parentElement!.scrollTo({ left: slide.parentElement!.clientWidth }));
  await expect(guide.getByText("Halaman 2 dari 2", { exact: true })).toBeVisible();
  // The slider fits the card instead of widening the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const speakers = guide.getByRole("list", { name: "Narasumber" });
  await expect(speakers.getByRole("listitem")).toHaveCount(9);
  await expect(speakers.getByRole("link")).toHaveCount(0);
  await speakers.getByRole("button", { name: "Lihat CV Dr. Agus Canny", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "CV Dr. Agus Canny" });
  const pages = viewer.getByRole("img", { name: /^Dr\. Agus Canny, halaman \d+ dari 9$/ });
  await expect(pages).toHaveCount(9);
  await expect.poll(() => loaded(pages.first())).toBe(1240);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
});

test("an admin's Mentimeter link and materials show on the attendee page in the same browser", async ({ page }) => {
  await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Info acara" }).click();
  await expect(page.getByRole("heading", { name: "Info acara", exact: true })).toBeVisible();
  await expect(page.getByText(/tersimpan di browser ini saja/)).toBeVisible();

  const link = page.getByLabel("Tautan Mentimeter", { exact: true });
  await link.fill("https://example.com/polling");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("menti.com");
  await link.fill("https://www.menti.com/al1b2c3d4e5f");

  await expect(page.getByRole("button", { name: "Tambah ruangan" })).toHaveCount(0);

  const upload = page.getByLabel("Tambah materi (PDF)", { exact: true });
  await upload.setInputFiles({ name: "besar.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(1100 * 1024)]) });
  await expect(page.getByRole("alert")).toContainText("1 MB");
  await upload.setInputFiles({ name: "paparan-narasumber.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% contoh\n") });
  await expect(page.getByLabel("Judul materi 3", { exact: true })).toHaveValue("paparan-narasumber");
  await page.getByLabel("Judul materi 3", { exact: true }).fill("Paparan narasumber");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Info acara disimpan di browser ini.", { exact: true })).toBeVisible();

  await page.evaluate(() =>
    localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "kode-1", name: "Budi Santoso", at: "2026-11-02T03:05:00Z" }])),
  );
  await page.goto("/");
  const guide = page.getByRole("region", { name: "Panduan acara" });
  await expect(guide.getByRole("link", { name: "Ikut polling di Mentimeter" })).toHaveAttribute("href", "https://www.menti.com/al1b2c3d4e5f");
  await expect(guide.getByRole("list", { name: "Materi" }).getByRole("listitem")).toHaveCount(3);
  expect(await download(page, "Unduh Paparan narasumber")).toEqual({ name: "paparan-narasumber.pdf", head: "%PDF-" });

  await page.goto("/admin/acara");
  await page.getByRole("button", { name: "Pakai data contoh", exact: true }).click();
  await expect(page.getByLabel("Tautan Mentimeter", { exact: true })).toHaveValue("https://www.menti.com/");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.goto("/");
  const materials = page.getByRole("region", { name: "Panduan acara" }).getByRole("list", { name: "Materi" });
  await expect(materials.getByRole("listitem")).toHaveCount(2);
  await expect(materials).not.toContainText("Paparan narasumber");
});
