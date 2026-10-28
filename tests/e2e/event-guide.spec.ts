import { expect, test, type Page } from "@playwright/test";
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
  await expect(guide.getByRole("list", { name: "Materi" }).getByRole("listitem")).toHaveCount(3);
  expect(await download(page, "Unduh Panduan peserta")).toEqual({ name: "panduan-peserta.pdf", head: "%PDF-" });
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
  await expect(page.getByLabel("Judul materi 4", { exact: true })).toHaveValue("paparan-narasumber");
  await page.getByLabel("Judul materi 4", { exact: true }).fill("Paparan narasumber");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Info acara disimpan di browser ini.", { exact: true })).toBeVisible();

  await page.evaluate(() =>
    localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "kode-1", name: "Budi Santoso", at: "2026-11-02T03:05:00Z" }])),
  );
  await page.goto("/");
  const guide = page.getByRole("region", { name: "Panduan acara" });
  await expect(guide.getByRole("link", { name: "Ikut polling di Mentimeter" })).toHaveAttribute("href", "https://www.menti.com/al1b2c3d4e5f");
  await expect(guide.getByRole("list", { name: "Materi" }).getByRole("listitem")).toHaveCount(4);
  expect(await download(page, "Unduh Paparan narasumber")).toEqual({ name: "paparan-narasumber.pdf", head: "%PDF-" });

  await page.goto("/admin/acara");
  await page.getByRole("button", { name: "Pakai data contoh", exact: true }).click();
  await expect(page.getByLabel("Tautan Mentimeter", { exact: true })).toHaveValue("https://www.menti.com/");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.goto("/");
  const materials = page.getByRole("region", { name: "Panduan acara" }).getByRole("list", { name: "Materi" });
  await expect(materials.getByRole("listitem")).toHaveCount(3);
  await expect(materials).not.toContainText("Paparan narasumber");
});
