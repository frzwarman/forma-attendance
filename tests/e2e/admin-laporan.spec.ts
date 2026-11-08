import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { checkInRow, deviceId, installSupabaseStub, pollRow, wheelEntry } from "./supabase-stub";

// Four real attendees over the event, a test-day attendee before it, and a demo row.
function seed() {
  const budi = checkInRow({
    name: "Budi Santoso",
    email: "budi@bawaslu.test",
    created_at: "2026-11-02T01:00:00.000Z", // 08:00 WIB
    last_checked_in_at: "2026-11-04T06:00:00.000Z", // 13:00 WIB
    checkin_count: 5,
    divisi: "Biro Hukum",
    answers: { "TYPE LAYOUT": "ROUNDTABLE", "Tulis pesan dan kesan di kegiatan ini": "Mantap!" },
    checked_out_at: "2026-11-04T09:00:00.000Z",
    room_number: "1204",
    file_path: "checkins/budi.jpg",
  });
  const siti = checkInRow({ name: "Siti Rahma", email: "siti@bawaslu.test", created_at: "2026-11-02T02:00:00.000Z", divisi: "biro  hukum", answers: { "TYPE LAYOUT": "CLASS ROOM" } });
  const agus = checkInRow({ name: "Agus Canny", email: "agus@bawaslu.test", created_at: "2026-11-03T01:30:00.000Z", divisi: "", answers: { "TYPE LAYOUT": "ROUNDTABLE", "Kesan dan Pesan": "-" } });
  const dewi = checkInRow({ name: "Dewi Lestari", email: "dewi@bawaslu.test", created_at: "2026-10-25T01:00:00.000Z", divisi: "Puslitbang" });
  const demo = checkInRow({ name: "Contoh Peserta", email: "demo@example.com", created_at: "2026-11-02T01:00:00.000Z", divisi: "Contoh Divisi" });
  const real = pollRow({ options: ["Round table", "Classroom table"], max_picks: 1, created_at: "2026-11-04T06:09:00.000Z", is_open: false });
  const trial = pollRow({ options: ["A", "B"], max_picks: 1, created_at: "2026-11-06T01:00:00.000Z", title: "E-VOTE" });
  return {
    checkins: [budi, siti, agus, dewi, demo],
    feedback: [
      { checkin_id: budi.id, message: "Acaranya seru" },
      { checkin_id: demo.id, message: "Pesan demo" },
    ],
    polls: [real, trial],
    ballots: [
      { poll_id: real.id, device_id: deviceId(1), picks: [0] },
      { poll_id: real.id, device_id: deviceId(2), picks: [1] },
      { poll_id: real.id, device_id: deviceId(3), picks: [1] },
      { poll_id: trial.id, device_id: deviceId(4), picks: [0] },
    ],
    wheel: [wheelEntry({ name: "Rudi Hartono" }), wheelEntry({ name: "Andri Syamsudin", prize: "Hadiah 1", won_at: "2026-11-06T03:00:00.000Z" })],
  };
}

async function openLaporan(page: Page) {
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Laporan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Laporan", exact: true })).toBeVisible();
}

test("Laporan tells the event's story: attendance, divisions, form answers, every E-Vote, messages and the draw", async ({ page }) => {
  const data = seed();
  const state = await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  state.feedback.push(...data.feedback);
  await openLaporan(page);

  // The demo row is left out: 4 attendees, 5 + 1 + 1 + 1 check-ins.
  await expect(page.getByTestId("stat-attendees")).toContainText("4");
  await expect(page.getByTestId("stat-visits")).toContainText("8");
  await expect(page.getByTestId("stat-visits")).toContainText("Rata-rata 2 per orang");
  await expect(page.getByTestId("stat-days")).toContainText("4");
  await expect(page.getByTestId("stat-checked-out")).toContainText("1");
  await expect(page.getByTestId("stat-rooms")).toContainText("1");
  await expect(page.getByTestId("stat-files")).toContainText("1");

  const divisi = page.getByTestId("divisi-row");
  await expect(divisi.nth(0)).toContainText("Biro Hukum");
  await expect(divisi.nth(0)).toContainText("2");
  await expect(page.getByTestId("divisi-row").filter({ hasText: "Tidak diisi" })).toHaveCount(1);
  await expect(page.getByText("Contoh Divisi")).toHaveCount(0);

  // The questions with countable answers; the Kesan & Pesan questions are quotes instead.
  const questions = page.getByTestId("question-card");
  await expect(questions).toHaveCount(1);
  await expect(questions.first()).toContainText("TYPE LAYOUT");
  await expect(questions.first()).toContainText("3 jawaban");
  await expect(questions.first()).toContainText("ROUNDTABLE");
  await expect(questions.first()).toContainText("67%");

  // Every vote, newest first, with the real result readable even though a trial poll came later.
  const polls = page.getByTestId("poll-card");
  await expect(polls).toHaveCount(2);
  await expect(polls.nth(0)).toContainText("E-VOTE");
  await expect(polls.nth(0)).toContainText("1 orang memilih");
  await expect(polls.nth(1)).toContainText("3 orang memilih");
  await expect(polls.nth(1)).toContainText("Classroom table");
  await expect(polls.nth(1)).toContainText("67%");
  await expect(polls.nth(1)).toContainText("Ditutup");

  // Messages from the attendee page and from the form, with names that can be hidden for printing.
  const quotes = page.getByTestId("quote");
  await expect(quotes).toHaveCount(2);
  await expect(quotes.filter({ hasText: "Acaranya seru" })).toContainText("Budi Santoso");
  await expect(quotes.filter({ hasText: "Mantap!" })).toContainText("Budi Santoso");
  await expect(page.getByText("Pesan demo")).toHaveCount(0);
  await page.getByRole("button", { name: "Sembunyikan nama", exact: true }).click();
  await expect(quotes.filter({ hasText: "Budi Santoso" })).toHaveCount(0);
  await expect(quotes.first()).toContainText("Peserta");
  await page.getByRole("button", { name: "Tampilkan nama", exact: true }).click();
  await expect(quotes.filter({ hasText: "Budi Santoso" })).toHaveCount(2);

  const winners = page.getByTestId("winner-row");
  await expect(winners).toHaveCount(1);
  await expect(winners).toContainText("Andri Syamsudin");
  await expect(winners).toContainText("Hadiah 1");
  await expect(page.getByText("Rudi Hartono")).toHaveCount(0);
});

test("the date range narrows the report to attendees who first checked in within it", async ({ page }) => {
  const data = seed();
  await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  await openLaporan(page);
  await page.getByLabel("Dari tanggal", { exact: true }).fill("2026-11-01");
  await expect(page.getByTestId("stat-attendees")).toContainText("3");
  await expect(page.getByTestId("stat-visits")).toContainText("Rata-rata 2,3 per orang");
  const days = page.getByTestId("day-row");
  await expect(days).toHaveCount(3);
  await expect(days.nth(0)).toContainText("02/11/2026");
  await expect(days.nth(0)).toContainText("2");
  await expect(days.nth(2)).toContainText("04/11/2026");
  await expect(days.nth(2)).toContainText("terakhir hadir 1");
  const hours = page.getByTestId("hour-row");
  await expect(hours.nth(0)).toContainText("08:00");
  await expect(hours.nth(0)).toContainText("2");
  await expect(page.getByText("Puslitbang")).toHaveCount(0);
  await page.getByLabel("Sampai tanggal", { exact: true }).fill("2026-11-02");
  await expect(page.getByTestId("stat-attendees")).toContainText("2");
});

test("the Google Sheet's Check-in tab, dropped on the page, gives attendance per session", async ({ page }) => {
  const data = seed();
  await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  await openLaporan(page);
  const csv = [
    "Waktu Check-in (WIB),Sesi,Nama,E-mail,Check-in ke-",
    "02/11/2026 08:10 WIB,02-11-2026 Sesi 1,Budi Santoso,budi@bawaslu.test,1",
    "02/11/2026 08:12 WIB,02-11-2026 Sesi 1,Siti Rahma,siti@bawaslu.test,1",
    "02/11/2026 13:40 WIB,02-11-2026 Sesi 2,Budi Santoso,budi@bawaslu.test,2",
    "02/11/2026 13:41 WIB,02-11-2026 Sesi 2,Budi Santoso,BUDI@bawaslu.test,3",
    "",
  ].join("\n");
  await page.getByLabel("Unggah ekspor tab Check-in", { exact: true }).setInputFiles({ name: "Check-in.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("status")).toHaveText("4 check-in dalam 2 sesi.");
  const sessions = page.getByTestId("session-row");
  await expect(sessions).toHaveCount(2);
  await expect(sessions.nth(0)).toContainText("02-11-2026 Sesi 1");
  await expect(sessions.nth(0)).toContainText("2");
  await expect(sessions.nth(0)).toContainText("2 orang");
  await expect(sessions.nth(1)).toContainText("Sesi 2");
  await expect(sessions.nth(1)).toContainText("1 orang");

  // The wrong file says what to upload.
  await page.getByLabel("Unggah ekspor tab Check-in", { exact: true }).setInputFiles({ name: "lain.csv", mimeType: "text/csv", buffer: Buffer.from("Nama,Divisi\nBudi,Hukum\n") });
  await expect(page.getByRole("alert")).toContainText('Kolom "Sesi" tidak ditemukan');
  await expect(sessions).toHaveCount(0);
});

test("Cetak prints the report alone, over as many pages as it needs", async ({ page }) => {
  const data = seed();
  await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  await openLaporan(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("link", { name: "Undian", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Cetak / simpan PDF", exact: true })).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-print="page"]')!).overflowY)).toBe("visible");
  const pdf = await page.pdf({ format: "A4" });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThanOrEqual(2);
});
