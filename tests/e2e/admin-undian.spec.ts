import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { segmentAt } from "../../src/domain/wheel";
import { signInAsAdmin } from "./admin";
import { installSupabaseStub, wheelEntry } from "./supabase-stub";

const csv = (name: string, text: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(text) });

async function openUndian(page: Page) {
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Undian" }).click();
  await expect(page.getByRole("heading", { name: "Undian" })).toBeVisible();
}

test("an admin uploads a CSV with names and Kesan & Pesan, spins, the winner leaves the wheel and can be put back", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await installSupabaseStub(page);
  await openUndian(page);
  const status = page.getByTestId("wheel-status");
  const putar = page.getByRole("button", { name: "Putar", exact: true });
  const segments = page.getByTestId("wheel-segment");
  const labels = page.getByTestId("wheel-label");
  const panel = page.getByTestId("winner-panel");
  const winnerName = page.getByTestId("winner-name");
  const winnerNote = page.getByTestId("winner-note");
  const rows = page.getByTestId("winner-row");
  await expect(status).toHaveText("Belum ada daftar peserta.");
  await expect(putar).toBeDisabled();

  await page
    .getByLabel("Unggah daftar peserta")
    .setInputFiles(csv("peserta.csv", 'Nama,Kesan & Pesan\nBudi Santoso,"Acaranya seru, lanjutkan!"\nSiti Rahma,\nAgus Canny,Terima kasih panitia\n'));
  await expect(page.getByRole("status")).toHaveText("3 peserta diunggah, dengan Kesan & Pesan.");
  expect(state.wheel.map((entry) => [entry.name, entry.note])).toEqual([
    ["Budi Santoso", "Acaranya seru, lanjutkan!"],
    ["Siti Rahma", ""],
    ["Agus Canny", "Terima kasih panitia"],
  ]);
  await expect(segments).toHaveCount(3);
  await expect(labels).toHaveCount(3);
  await expect(labels).toContainText(["Budi Santoso", "Siti Rahma", "Agus Canny"]);
  await expect(status).toHaveText("Sisa 3 peserta");

  await page.getByLabel("Nama hadiah", { exact: true }).fill("Sepeda");
  await putar.click();
  await expect(panel).toBeVisible();
  await expect(winnerName).toHaveText(/^(Budi Santoso|Siti Rahma|Agus Canny)$/);
  // The stub draws at random: the winner is whoever it marked.
  const won = state.wheel.find((entry) => entry.won_at)!;
  await expect(winnerName).toHaveText(won.name);
  if (won.note) await expect(winnerNote).toContainText(won.note);
  else await expect(winnerNote).toHaveCount(0);
  await expect(panel).toContainText("Sepeda");
  await expect(panel).toContainText("tidak ikut putaran berikutnya");
  // No confetti with reduced motion.
  await expect(page.getByTestId("confetti")).toHaveCount(0);
  expect(state.wheel.filter((entry) => entry.won_at)).toEqual([expect.objectContaining({ name: won.name, prize: "Sepeda" })]);

  await panel.getByRole("button", { name: "Lanjut", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(segments).toHaveCount(2);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(won.name);
  await expect(rows).toContainText("Sepeda");
  if (won.note) await expect(rows).toContainText(won.note);
  await expect(status).toHaveText("Sisa 2 peserta");

  await page.getByRole("button", { name: `Kembalikan ${won.name} ke roda`, exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(segments).toHaveCount(3);
  expect(state.wheel.filter((entry) => entry.won_at)).toEqual([]);

  for (const left of [2, 1, 0]) {
    await putar.click();
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Lanjut", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(segments).toHaveCount(left);
  }
  await expect(status).toHaveText("Semua peserta sudah mendapat hadiah.");
  await expect(putar).toBeDisabled();
  await expect(rows).toHaveCount(3);
  await expect(segments).toHaveCount(0);
});

test("a file with an unknown column, without a Nama column, or with nothing but the header is refused and the list stays", async ({ page }) => {
  const entry = wheelEntry({ name: "Budi Santoso" });
  const state = await installSupabaseStub(page, { wheel: [entry] });
  await openUndian(page);
  const input = page.getByLabel("Unggah daftar peserta");
  const alert = page.getByRole("alert");
  await expect(page.getByTestId("wheel-segment")).toHaveCount(1);

  await input.setInputFiles(csv("telepon.csv", "Nama,Telepon\nBudi,0812\n"));
  await expect(alert).toContainText('kolom "Telepon" tidak dikenal');
  await input.setInputFiles(csv("peserta.csv", "Peserta\nBudi\n"));
  await expect(alert).toContainText('Kolom "Nama" tidak ditemukan');
  await input.setInputFiles(csv("kosong.csv", "Nama\n\n"));
  await expect(alert).toHaveText("Tidak ada nama di file.");

  expect(state.wheel).toEqual([entry]);
  await expect(page.getByTestId("wheel-segment")).toHaveCount(1);
  expect(state.rpcCalls.filter((call) => call.name === "guestbook_wheel_import")).toEqual([]);
});

test("an Excel file with only a NAMA column works, and replacing a list that has winners asks first", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["NAMA"], ["Dewi Lestari"], ["Rudi Hartono"]]), "Peserta");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const xlsx = (name: string) => ({ name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  const seeded = [wheelEntry({ name: "Budi Santoso" }), wheelEntry({ name: "Siti Rahma", prize: "Hadiah 1", won_at: "2026-11-04T03:00:00.000Z" })];
  const state = await installSupabaseStub(page, { wheel: seeded });
  await openUndian(page);
  const rows = page.getByTestId("winner-row");
  const input = page.getByLabel("Unggah daftar peserta");
  const dialog = page.getByRole("dialog", { name: "Ganti daftar peserta" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Siti Rahma");

  await input.setInputFiles(xlsx("peserta.xlsx"));
  await expect(dialog).toContainText("1 pemenang");
  await expect(dialog).toContainText("2 peserta");
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.wheel).toEqual(seeded);

  await input.setInputFiles(xlsx("peserta-baru.xlsx"));
  await dialog.getByRole("button", { name: "Ya, ganti", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("2 peserta diunggah.");
  await expect(rows).toHaveCount(0);
  await expect(page.getByTestId("wheel-segment")).toHaveCount(2);
  await expect(page.getByTestId("wheel-label")).toHaveText(["Dewi Lestari", "Rudi Hartono"]);
  expect(state.wheel).toEqual([
    expect.objectContaining({ position: 1, name: "Dewi Lestari", note: "", prize: "", won_at: null }),
    expect.objectContaining({ position: 2, name: "Rudi Hartono", note: "", prize: "", won_at: null }),
  ]);

  await page.getByRole("button", { name: "Putar", exact: true }).click();
  await expect(page.getByTestId("winner-panel")).toBeVisible();
  await expect(page.getByTestId("winner-name")).toHaveText(/^(Dewi Lestari|Rudi Hartono)$/);
  await expect(page.getByTestId("winner-note")).toHaveCount(0);
});

test("the wheel turns to the drawn name, and Layar penuh fills the screen with the stage, Putar and the panel inside it", async ({ page }) => {
  const names = ["Budi Santoso", "Siti Rahma", "Agus Canny", "Dewi Lestari"];
  await installSupabaseStub(page, { wheel: names.map((name) => wheelEntry({ name })) });
  await openUndian(page);
  const wheel = page.getByTestId("wheel");
  const panel = page.getByTestId("winner-panel");
  const putar = page.getByRole("button", { name: "Putar", exact: true });
  await putar.click();
  await expect(wheel).toHaveAttribute("style", /rotate\(/, { timeout: 2000 });
  // While the wheel turns there is no button in the hub.
  await expect(putar).toHaveCount(0);
  await expect(panel).toBeVisible({ timeout: 9000 });
  await expect(panel.getByTestId("confetti")).toHaveCount(1);
  const rotation = Number(/rotate\(([-\d.]+)deg\)/.exec((await wheel.getAttribute("style")) ?? "")?.[1]);
  expect(rotation).toBeGreaterThanOrEqual(1800);
  const winner = ((await page.getByTestId("winner-name").textContent()) ?? "").trim();
  expect(names).toContain(winner);
  expect(segmentAt(rotation, names.length)).toBe(names.indexOf(winner));
  await expect(wheel).not.toHaveAttribute("style", /transform 5000ms/);
  await panel.getByRole("button", { name: "Lanjut", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(putar).toBeVisible();

  await page.getByRole("button", { name: "Layar penuh", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute("data-testid") ?? null)).toBe("wheel-stage");
  const stage = page.getByTestId("wheel-stage");
  await expect(stage.getByRole("button", { name: "Putar", exact: true })).toBeVisible();
  await expect(stage.getByTestId("wheel-status")).toBeVisible();
});

test("the participant list shows names and notes, Ubah corrects them, Hapus takes one off the wheel after a confirmation, and a file can be dropped onto the uploader", async ({ page }) => {
  const seeded = [
    wheelEntry({ name: "Budi Santoso", note: "Acaranya seru!" }),
    wheelEntry({ name: "Siti Rahma" }),
    wheelEntry({ name: "Agus Canny", note: "Terima kasih panitia", prize: "Hadiah 1", won_at: "2026-11-04T03:00:00.000Z" }),
  ];
  const state = await installSupabaseStub(page, { wheel: seeded });
  await openUndian(page);
  const rows = page.getByTestId("participant-row");
  const dialog = page.getByRole("dialog", { name: "Hapus peserta" });
  // Only the names still on the wheel; the winner is in the Pemenang card.
  await expect(page.getByRole("heading", { name: "Peserta di roda (2)" })).toBeVisible();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Budi Santoso");
  await expect(rows.nth(0)).toContainText("Acaranya seru!");
  await expect(rows.nth(1)).toContainText("Siti Rahma");

  // Ubah: a corrected name and message, trimmed; an empty name is refused.
  await page.getByRole("button", { name: "Ubah Budi Santoso", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Ubah peserta" });
  await expect(edit.getByLabel("Nama", { exact: true })).toHaveValue("Budi Santoso");
  await expect(edit.getByLabel("Kesan & Pesan", { exact: true })).toHaveValue("Acaranya seru!");
  await edit.getByLabel("Nama", { exact: true }).fill("   ");
  await edit.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(edit.getByRole("alert")).toHaveText("Nama wajib diisi.");
  await edit.getByLabel("Nama", { exact: true }).fill(" Budi Santoso, S.H. ");
  await edit.getByLabel("Kesan & Pesan", { exact: true }).fill("Mantap, lanjutkan! ");
  await edit.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(rows.nth(0)).toContainText("Budi Santoso, S.H.");
  await expect(rows.nth(0)).toContainText("Mantap, lanjutkan!");
  await expect(page.getByTestId("wheel-label").first()).toHaveText("Budi Santoso, S.H.");
  expect(state.wheel[0]).toMatchObject({ name: "Budi Santoso, S.H.", note: "Mantap, lanjutkan!" });

  await page.getByRole("button", { name: "Hapus Siti Rahma", exact: true }).click();
  await expect(dialog).toContainText("Hapus Siti Rahma dari roda?");
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.wheel).toHaveLength(3);

  await page.getByRole("button", { name: "Hapus Siti Rahma", exact: true }).click();
  await dialog.getByRole("button", { name: "Ya, hapus", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("wheel-segment")).toHaveCount(1);
  await expect(page.getByTestId("wheel-status")).toHaveText("Sisa 1 peserta");
  expect(state.wheel.map((entry) => entry.name)).toEqual(["Budi Santoso, S.H.", "Agus Canny"]);
  await expect(page.getByTestId("winner-row")).toHaveCount(1);

  // Dropped on the box instead of picked: the same import (the list here has a winner, so it asks first).
  const dropped = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["Nama\nDewi Lestari\nRudi Hartono\n"], "tarik.csv", { type: "text/csv" }));
    return data;
  });
  await page.getByTestId("dropzone").dispatchEvent("drop", { dataTransfer: dropped });
  const replace = page.getByRole("dialog", { name: "Ganti daftar peserta" });
  await replace.getByRole("button", { name: "Ya, ganti", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("2 peserta diunggah.");
  await expect(rows).toHaveCount(2);
  await expect(rows).toContainText(["Dewi Lestari", "Rudi Hartono"]);
  expect(state.wheel.map((entry) => entry.name)).toEqual(["Dewi Lestari", "Rudi Hartono"]);
});

test("before the wheel migration the Undian page says what to run", async ({ page }) => {
  await installSupabaseStub(page, { legacyWheel: true });
  await openUndian(page);
  await expect(page.getByRole("alert")).toContainText("npm run db:push");
});
