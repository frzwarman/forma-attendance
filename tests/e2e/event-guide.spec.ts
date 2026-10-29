import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import { signInAsAdmin } from "./admin";
import { fillForm } from "./form";
import { pdfWithPages } from "./pdf";
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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("an admin uploads the rundown, a speaker's CV and profile picture, and a material; attendees see them", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Info acara" }).click();
  await expect(page.getByRole("heading", { name: "Info acara", exact: true })).toBeVisible();
  // Nothing saved yet: the tab starts from the rundown and CVs built into the site.
  await expect(page.getByLabel("Nama narasumber 9", { exact: true })).toHaveValue("Tim Positium");

  const link = page.getByLabel("Tautan Mentimeter", { exact: true });
  await link.fill("https://example.com/polling");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("menti.com");
  await link.fill("https://www.menti.com/al1b2c3d4e5f");

  const idle = () => expect(page.getByRole("status")).toHaveCount(0);
  await page.getByLabel("Ganti rundown (PDF)", { exact: true }).setInputFiles({ name: "rundown.pdf", mimeType: "application/pdf", buffer: pdfWithPages(2) });
  await idle();
  await expect(page.getByText("2 halaman", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hapus narasumber 9", exact: true }).click();
  await page.getByLabel("Tambah narasumber (CV PDF)", { exact: true }).setInputFiles({ name: "Budi Narasumber.pdf", mimeType: "application/pdf", buffer: pdfWithPages(3) });
  await idle();
  await expect(page.getByLabel("Nama narasumber 9", { exact: true })).toHaveValue("Budi Narasumber");
  await page.getByRole("button", { name: "Naikkan narasumber 9", exact: true }).click();
  await expect(page.getByLabel("Nama narasumber 8", { exact: true })).toHaveValue("Budi Narasumber");
  await page.getByLabel("Foto profil narasumber 8", { exact: true }).setInputFiles({ name: "budi.png", mimeType: "image/png", buffer: PNG });
  await idle();
  await expect(page.getByText("CV 3 halaman", { exact: true })).toBeVisible();
  // The eight built-in speakers kept have their cropped profile pictures, and the new one now has one too.
  await expect(page.getByText("Foto profil diunggah", { exact: true })).toHaveCount(9);
  await expect(page.getByText("Tanpa foto profil", { exact: true })).toHaveCount(0);

  const material = page.getByLabel("Tambah materi (PDF)", { exact: true });
  await material.setInputFiles({ name: "besar.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(21 * 1024 * 1024)]) });
  await expect(page.getByRole("alert")).toContainText("20 MB");
  await page.getByLabel("Tambah materi (PDF)", { exact: true }).setInputFiles({ name: "paparan.pdf", mimeType: "application/pdf", buffer: pdfWithPages(1) });
  await expect(page.getByLabel("Judul materi 3", { exact: true })).toHaveValue("paparan");
  await page.getByLabel("Judul materi 3", { exact: true }).fill("Paparan narasumber");

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Info acara disimpan. HP peserta menampilkannya saat halaman dibuka lagi.", { exact: true })).toBeVisible();
  // Every page became a JPEG in the public event bucket; the material stays a PDF.
  const uploads = state.uploads.filter((u) => u.bucket === "guestbook-event");
  expect(uploads.map((u) => [u.path.split("/")[0], u.contentType])).toEqual(
    expect.arrayContaining([["docs", "image/jpeg"], ["profiles", "image/jpeg"], ["materials", "application/pdf"]]),
  );
  expect(uploads.filter((u) => u.path.startsWith("docs/"))).toHaveLength(5);
  const saved = state.settings.event_content as { rundown: { path: string }[]; speakers: { name: string; profile: unknown }[] };
  expect(saved.rundown).toHaveLength(2);
  expect(saved.speakers.map((s) => s.name).slice(-2)).toEqual(["Budi Narasumber", "Karen Grace Sutoto"]);

  await page.evaluate(() =>
    localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "kode-1", name: "Budi Santoso", at: "2026-11-02T03:05:00Z" }])),
  );
  await page.goto("/");
  const guide = page.getByRole("region", { name: "Panduan acara" });
  await expect(guide.getByRole("link", { name: "Ikut polling di Mentimeter" })).toHaveAttribute("href", "https://www.menti.com/al1b2c3d4e5f");
  await expect(guide.getByRole("img", { name: "Rundown acara, halaman 1 dari 2" })).toHaveAttribute("src", /\/storage\/v1\/object\/public\/guestbook-event\/docs\/.+\/1\.jpg$/);
  const speakers = guide.getByRole("list", { name: "Narasumber" }).getByRole("listitem");
  await expect(speakers).toHaveCount(9);
  await expect(speakers.nth(7)).toContainText("Budi Narasumber");
  await expect(speakers.nth(7)).toContainText("3 halaman");
  await expect(guide.getByRole("link", { name: "Unduh Paparan narasumber" })).toHaveAttribute("href", /guestbook-event\/materials\/.+\.pdf\?download=paparan\.pdf$/);
  expect(await download(page, "Unduh Paparan narasumber")).toEqual({ name: "paparan.pdf", head: "%PDF-" });

  // "Pakai data contoh" brings back the built-in rundown and CVs.
  await page.goto("/admin/acara");
  await page.getByRole("button", { name: "Pakai data contoh", exact: true }).click();
  await expect(page.getByLabel("Tautan Mentimeter", { exact: true })).toHaveValue("https://www.menti.com/");
  await expect(page.getByLabel("Nama narasumber 9", { exact: true })).toHaveValue("Tim Positium");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText(/^Info acara disimpan/)).toBeVisible();
  await page.goto("/");
  const materials = page.getByRole("region", { name: "Panduan acara" }).getByRole("list", { name: "Materi" });
  await expect(materials.getByRole("listitem")).toHaveCount(2);
  await expect(materials).not.toContainText("Paparan narasumber");
});

test("the opening popup shows the speakers the admin saved", async ({ page }) => {
  const event_content = {
    mentimeter_url: null,
    rundown: [],
    speakers: [
      { name: "Sari Narasumber", pages: [{ path: "docs/s/1.jpg", width: 1240, height: 1754 }], profile: { path: "profiles/s.jpg", width: 800, height: 300 } },
    ],
    materials: [],
  };
  await installSupabaseStub(page, { intro: true, settings: { event_content } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const popup = page.getByRole("dialog", { name: "Informasi acara" });
  await expect(popup.getByRole("heading", { name: "Sari Narasumber" })).toBeVisible();
  await expect(popup.getByRole("img", { name: "Profil Sari Narasumber" })).toHaveAttribute("src", /guestbook-event\/profiles\/s\.jpg$/);
  await expect(popup.getByRole("region", { name: /^Slide \d dari 2$/ })).toHaveCount(2);
  await popup.getByRole("button", { name: "Mulai check-in" }).click();
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await page.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();
  // An empty rundown and no materials hide those sections.
  const guide = page.getByRole("region", { name: "Panduan acara" });
  await expect(guide.getByText("Rundown acara", { exact: true })).toHaveCount(0);
  await expect(guide.getByRole("list", { name: "Materi" })).toHaveCount(0);
  await expect(guide.getByRole("list", { name: "Narasumber" }).getByRole("listitem")).toHaveCount(1);
});

test("before migration 20261030000000 is applied, saving explains what to run and attendees keep the built-in content", async ({ page }) => {
  await installSupabaseStub(page, { legacyEventContent: true });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Info acara" }).click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("kolom event_content belum ada");
  await expect(page.getByRole("alert")).toContainText("npm run db:push");
});

test("when the settings cannot be loaded the opening popup shows the built-in speakers without waiting for retries", async ({ page }) => {
  await installSupabaseStub(page, { intro: true, failSettings: true });
  await page.goto("/");
  // TanStack Query retries for several seconds; the popup must not appear later over a half-filled form.
  await expect(page.getByRole("dialog", { name: "Informasi acara" }).getByRole("heading", { name: "Dr. Agus Canny" })).toBeVisible({ timeout: 900 });
});
