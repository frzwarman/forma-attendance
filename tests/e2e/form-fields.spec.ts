import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { signInAsAdmin } from "./admin";
import { fillForm } from "./form";
import { installSupabaseStub } from "./supabase-stub";

test("an admin adds and removes questions; attendees answer them and admins see and export the answers", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Formulir" }).click();
  await expect(page.getByRole("heading", { name: "Formulir", exact: true })).toBeVisible();
  // Nothing saved yet: Divisi only; the hotel room question can be brought back.
  await expect(page.getByLabel("Judul pertanyaan 1", { exact: true })).toHaveValue("Divisi");
  await expect(page.getByLabel("Judul pertanyaan 2", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kembalikan Nomor Kamar Hotel" })).toBeVisible();

  await page.getByRole("button", { name: "Tambah pertanyaan", exact: true }).click();
  await page.getByLabel("Judul pertanyaan 2", { exact: true }).fill("Ukuran kaos");
  await page.getByRole("radiogroup", { name: "Jenis jawaban pertanyaan 2" }).getByRole("radio", { name: "Pilihan" }).click();
  await page.getByLabel("Wajib diisi: pertanyaan 2", { exact: true }).check();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText('"Ukuran kaos" butuh minimal satu pilihan.');
  await page.getByLabel("Pilihan jawaban pertanyaan 2", { exact: true }).fill("S\nM\n\nL\nM");

  await page.getByRole("button", { name: "Tambah pertanyaan", exact: true }).click();
  await page.getByLabel("Judul pertanyaan 3", { exact: true }).fill("divisi");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText('Judul "divisi" dipakai lebih dari sekali.');
  await page.getByLabel("Judul pertanyaan 3", { exact: true }).fill("Asal instansi");
  await page.getByRole("radiogroup", { name: "Jenis jawaban pertanyaan 3" }).getByRole("radio", { name: "Teks panjang" }).click();
  // Asal instansi goes first.
  await page.getByRole("button", { name: "Naikkan pertanyaan 3", exact: true }).click();
  await page.getByRole("button", { name: "Naikkan pertanyaan 2", exact: true }).click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Formulir disimpan. Peserta melihatnya saat halaman dibuka lagi.", { exact: true })).toBeVisible();
  expect(state.settings.form_fields).toEqual([
    expect.objectContaining({ label: "Asal instansi", type: "textarea", required: false }),
    expect.objectContaining({ label: "Divisi", builtin: "divisi", required: true }),
    expect.objectContaining({ label: "Ukuran kaos", type: "select", required: true, options: ["S", "M", "L"] }),
  ]);

  await page.goto("/");
  // The questions in the admin's order, after E-mail; no room question.
  await expect(page.getByLabel("Ukuran kaos", { exact: true })).toBeVisible();
  const order = await page.getByLabel(/^(E-mail|Asal instansi|Divisi|Ukuran kaos)$/).evaluateAll((inputs) => inputs.map((input) => input.getAttribute("aria-label")));
  expect(order).toEqual(["E-mail", "Asal instansi", "Divisi", "Ukuran kaos"]);
  await expect(page.getByLabel("Nomor Kamar Hotel", { exact: true })).toHaveCount(0);
  const shirt = page.getByLabel("Ukuran kaos", { exact: true });
  await expect(shirt).toHaveJSProperty("tagName", "SELECT");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText("Ukuran kaos wajib diisi", { exact: true })).toBeVisible();
  expect(state.rpcCalls).toHaveLength(0);
  await page.getByLabel("Asal instansi", { exact: true }).fill("Bawaslu Provinsi Jawa Barat");
  await shirt.selectOption("M");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Check-in berhasil" });
  await expect(popup.getByText("Ukuran kaos", { exact: true })).toBeVisible();
  await expect(popup.getByText("M", { exact: true })).toBeVisible();
  const body = state.rpcCalls[0].body;
  expect(body.p_answers).toEqual({ "Asal instansi": "Bawaslu Provinsi Jawa Barat", "Ukuran kaos": "M" });
  expect(body.p_divisi).toBe("Divisi Hukum");
  expect("p_room_number" in body).toBe(false);

  await page.goto("/admin");
  const row = page.getByRole("table").getByRole("row").filter({ hasText: "Budi Santoso" });
  await expect(row).toContainText("Ukuran kaos: M");
  await expect(row).toContainText("Asal instansi: Bawaslu Provinsi Jawa Barat");
  await page.getByLabel("Cari nama, divisi, telepon, e-mail, atau kamar", { exact: true }).fill("jawa barat");
  await expect(page.getByRole("table").getByRole("row").filter({ hasText: "Budi Santoso" })).toHaveCount(1);
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV", exact: true }).click();
  const [header, first] = fs.readFileSync((await (await csvDownload).path())!, "utf8").replace(/^﻿/, "").split("\r\n");
  expect(header.split(",").slice(7, 12)).toEqual(["Divisi", "Nomor Kamar Hotel", "Asal instansi", "Ukuran kaos", "Berkas"]);
  expect(first).toContain("Bawaslu Provinsi Jawa Barat");
});

test("before migration 20261031000000 is applied, saving the form explains what to run and check-ins still go through", async ({ page }) => {
  const state = await installSupabaseStub(page, { legacyCheckIn: true });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.route("**/rest/v1/guestbook_settings*", (route, request) =>
    request.method() === "PATCH"
      ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "PGRST204", message: "Could not find the 'form_fields' column of 'guestbook_settings' in the schema cache" }) })
      : route.fallback(),
  );
  await page.getByRole("link", { name: "Formulir" }).click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("kolom form_fields belum ada");
  await page.goto("/");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Check-in berhasil" })).toBeVisible();
  expect(state.rpcCalls.at(-1)?.body.p_address).toBe("-");
});
