import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("the list loads every page and shows the total", async ({ page }) => {
  const checkins = Array.from({ length: 2000 }, () => checkInRow());
  const state = await installSupabaseStub(page, { checkins });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Total check-in: 2.000", { exact: true })).toBeVisible();
  expect(state.rangeHeaders.slice(0, 3)).toEqual(["0-999", "1000-1999", "2000-2999"]);
});

test("search narrows the list by name, phone or e-mail", async ({ page }) => {
  await installSupabaseStub(page, {
    checkins: [
      checkInRow({ name: "Budi Santoso", phone: "0812 1111 2222", email: "budi@example.test" }),
      checkInRow({ name: "Siti Rahma", phone: "0813 3333 4444", email: "siti@example.test" }),
      checkInRow({ name: "Agus Wijaya", phone: "0815 5555 6666", email: "agus@example.test" }),
    ],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  const search = page.getByLabel("Cari nama, divisi, telepon, e-mail, atau kamar", { exact: true });
  await expect(page.getByText("Agus Wijaya", { exact: true })).toBeVisible();
  await search.fill("0813");
  await expect(page.getByText("Siti Rahma", { exact: true })).toBeVisible();
  await expect(page.getByText("Budi Santoso", { exact: true })).toHaveCount(0);
  await search.fill("SITI");
  await expect(page.getByText("Siti Rahma", { exact: true })).toBeVisible();
  await expect(page.getByText("Agus Wijaya", { exact: true })).toHaveCount(0);
  await search.fill("");
  await expect(page.getByText("Budi Santoso", { exact: true })).toBeVisible();
  await expect(page.getByText("Agus Wijaya", { exact: true })).toBeVisible();
});

test("an uploaded file opens through a signed link", async ({ page }) => {
  const state = await installSupabaseStub(page, {
    checkins: [checkInRow({ name: "Budi Santoso", file_path: "checkins/abc.jpg" })],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Lihat berkas", exact: true }).click();
  const opened = await popup;
  await opened.waitForURL(/checkins\/abc\.jpg/);
  expect(opened.url()).toContain("checkins/abc.jpg");
  expect(state.signedPaths).toEqual(["checkins/abc.jpg"]);
});

test("a check-in arriving between pages is neither skipped nor duplicated", async ({ page }) => {
  const checkins = Array.from({ length: 1000 }, () => checkInRow());
  await installSupabaseStub(page, { checkins, newRowAfterFirstPage: true });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Total check-in: 1.001", { exact: true })).toBeVisible();
  await expect(page.getByText("Peserta Baru", { exact: true })).toBeVisible();
});

test("admins check out one attendee, undo it, and check out everyone after confirming", async ({ page }) => {
  const state = await installSupabaseStub(page, {
    checkins: [
      checkInRow({ name: "Budi Santoso" }),
      checkInRow({ name: "Siti Rahma" }),
      checkInRow({ name: "Agus Wijaya", checked_out_at: "2026-10-26T09:00:00Z" }),
    ],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Total check-in: 3", { exact: true })).toBeVisible();
  const budi = page.getByRole("row").filter({ hasText: "Budi Santoso" });
  await budi.getByRole("button", { name: "Check out", exact: true }).click();
  await expect(budi.getByRole("button", { name: "Batalkan", exact: true })).toBeVisible();
  await budi.getByRole("button", { name: "Batalkan", exact: true }).click();
  await expect(budi.getByRole("button", { name: "Check out", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check out semua", exact: true }).click();
  await expect(page.getByText(/Check out 2 peserta yang belum check-out\?/)).toBeVisible();
  await page.getByRole("button", { name: "Ya, check out semua", exact: true }).click();
  await expect.poll(() => state.checkins.filter((c) => !c.checked_out_at).length).toBe(0);
  await expect(page.getByRole("row").filter({ hasText: "Siti Rahma" }).getByRole("button", { name: "Batalkan", exact: true })).toBeVisible();
});

test("at every screen width the check-out and file buttons are fully visible, never cut off", async ({ page }) => {
  const long = {
    name: "Muhammad Juan Al Qausar Siregar",
    email: "muhammad.juan.alqausar.siregar@bawaslu.go.id",
    divisi: "Divisi Penanganan Pelanggaran dan Data Informasi",
    answers: { "Asal instansi": "Bawaslu Provinsi Jawa Barat", "Ukuran kaos": "XL" },
  };
  await installSupabaseStub(page, {
    checkins: [
      checkInRow({ ...long, room_number: "1205", checked_out_at: "2026-10-26T10:30:00Z", file_path: "checkins/a.jpg" }),
      checkInRow({ ...long, name: "Budi Santoso" }),
    ],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  // Phones, the width where the sidebar appears, small laptops, and wide screens.
  for (const width of [360, 420, 900, 960, 1024, 1100, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "Batalkan" })).toBeVisible();
    // A button is cut off when any scrolling or clipping ancestor (or the window) ends before it does.
    const clipped = await page.getByRole("button", { name: /^(Check out|Check out semua|Batalkan|Lihat berkas)$/ }).evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const box = button.getBoundingClientRect();
          if (box.right > window.innerWidth + 0.5) return true;
          for (let el = button.parentElement; el; el = el.parentElement) {
            if (getComputedStyle(el).overflowX === "visible") continue;
            const clip = el.getBoundingClientRect();
            if (box.right > clip.right + 0.5 || box.left < clip.left - 0.5) return true;
          }
          return false;
        })
        .map((button) => button.textContent),
    );
    expect(clipped, `${width}px`).toEqual([]);
  }
});

// Today in WIB as the sheet's tab names write it: 02-11-2026.
const tabDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).split("-").reverse().join("-");

test("the admin starts Sesi 1 and Sesi 2 when they really begin, confirmed in a popup; nobody is checked out", async ({ page }) => {
  const state = await installSupabaseStub(page, { checkins: [checkInRow({ name: "Budi Santoso" })] });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Belum ada sesi", { exact: true })).toBeVisible();

  // Asked first in a popup; Batal, the close button and Escape start nothing.
  await page.getByRole("button", { name: "Mulai Sesi 1", exact: true }).click();
  const ask = page.getByRole("dialog", { name: "Mulai Sesi 1" });
  await expect(ask.getByRole("heading", { name: "Mulai Sesi 1 sekarang?" })).toBeVisible();
  await expect(ask.getByText(`Check-in sesudah ini masuk tab ${tabDay()} Sesi 1 di spreadsheet.`, { exact: false })).toBeVisible();
  // It covers the whole screen, the admin header too: rendered into <body>, outside the scroll view.
  expect(await ask.evaluate((dialog) => (dialog.parentElement as HTMLElement).getBoundingClientRect().toJSON())).toMatchObject({ top: 0, left: 0, height: await page.evaluate(() => innerHeight) });
  await ask.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(ask).toHaveCount(0);
  await page.getByRole("button", { name: "Mulai Sesi 1", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(ask).toHaveCount(0);
  await page.getByRole("button", { name: "Mulai Sesi 1", exact: true }).click();
  await ask.getByRole("button", { name: "Tutup", exact: true }).click();
  await expect(ask).toHaveCount(0);
  expect(state.sessions).toEqual([]);

  await page.getByRole("button", { name: "Mulai Sesi 1", exact: true }).click();
  await ask.getByRole("button", { name: "Ya, mulai Sesi 1", exact: true }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByText(/^Sesi 1 sejak \d{2}:\d{2} WIB$/)).toBeVisible();
  await expect(page.getByText(`Check-in sejak itu masuk tab ${tabDay()} Sesi 1 di spreadsheet.`, { exact: true })).toBeVisible();
  // Sesi 1 is under way: its button is disabled, Sesi 2 is next.
  await expect(page.getByRole("button", { name: "Mulai Sesi 1", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mulai Sesi 2", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Mulai Sesi 2", exact: true }).click();
  await page.getByRole("dialog", { name: "Mulai Sesi 2" }).getByRole("button", { name: "Ya, mulai Sesi 2", exact: true }).click();
  await expect(page.getByText(/^Sesi 2 sejak \d{2}:\d{2} WIB$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mulai Sesi 2", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mulai Sesi 1", exact: true })).toBeEnabled();
  expect(state.sessions.map((session) => session.label)).toEqual(["Sesi 1", "Sesi 2"]);
  expect(state.checkins[0].checked_out_at).toBeNull();
});

test("a start that fails is explained in the popup, which stays open to try again", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.route("**/rest/v1/rpc/guestbook_start_session", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Hanya admin yang dapat memulai sesi" }) }),
  );
  await page.getByRole("button", { name: "Mulai Sesi 1", exact: true }).click();
  const ask = page.getByRole("dialog", { name: "Mulai Sesi 1" });
  await ask.getByRole("button", { name: "Ya, mulai Sesi 1", exact: true }).click();
  await expect(ask.getByRole("alert")).toHaveText("Sesi 1 gagal dimulai: Hanya admin yang dapat memulai sesi");
  await expect(ask.getByRole("button", { name: "Ya, mulai Sesi 1", exact: true })).toBeEnabled();
  expect(state.sessions).toEqual([]);
});

test("past midnight the session keeps running until the admin starts Sesi 1, and the card says so", async ({ page }) => {
  // Yesterday 19:00 WIB: "20 hours ago" is still today when the suite runs in the evening.
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const yesterdayEvening = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - 1, 19 - 7));
  await installSupabaseStub(page, { sessions: [{ label: "Sesi 2", started_at: yesterdayEvening.toISOString() }] });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText(/^Sesi 2 sejak \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/)).toBeVisible();
  await expect(page.getByText(/masih berjalan: check-in baru masuk tab .* Sesi 2 sampai Anda menekan Mulai Sesi 1\./)).toBeVisible();
  // Sesi 2 is still under way; Sesi 1 starts today's first session.
  await expect(page.getByRole("button", { name: "Mulai Sesi 2", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mulai Sesi 1", exact: true })).toBeEnabled();
});

test("a Sesi 1 carried over from an earlier day leaves Mulai Sesi 1 open for today's", async ({ page }) => {
  await installSupabaseStub(page, { sessions: [{ label: "Sesi 1", started_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() }] });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText(/^Sesi 1 sejak \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mulai Sesi 1", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Mulai Sesi 2", exact: true })).toBeEnabled();
});
