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
  const tester = checkInRow({ name: "test", email: "nama@instansi.go.id", created_at: "2026-11-02T03:00:00.000Z", divisi: "asdasd" });
  const uji = checkInRow({ name: "Peserta Uji 0416", email: "uji.74020416@kantor.go.id", created_at: "2026-11-04T02:00:00.000Z", divisi: "Contoh Unit Kerja" });
  const real = pollRow({ options: ["Round table", "Classroom table"], max_picks: 1, created_at: "2026-11-04T06:09:00.000Z", is_open: false });
  const trial = pollRow({ options: ["A", "B"], max_picks: 1, created_at: "2026-11-06T01:00:00.000Z", title: "E-VOTE" });
  return {
    checkins: [budi, siti, agus, dewi, demo, tester, uji],
    feedback: [
      { checkin_id: budi.id, message: "Acaranya seru" },
      { checkin_id: demo.id, message: "Pesan demo" },
    ],
    polls: [real, trial],
    ballots: [
      ...Array.from({ length: 12 }, (_, i) => ({ poll_id: real.id, device_id: deviceId(i + 1), picks: [i < 4 ? 0 : 1] })),
      { poll_id: trial.id, device_id: deviceId(40), picks: [0] },
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

test("Laporan tells the event's story: the conclusion, attendance, divisions, form answers, every E-Vote, messages and the draw", async ({ page }) => {
  const data = seed();
  const state = await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  state.feedback.push(...data.feedback);
  await openLaporan(page);

  // The conclusion is written from the numbers; the demo row is left out: 4 attendees, 5 + 1 + 1 + 1 check-ins.
  const narrative = page.getByTestId("narrative");
  await expect(narrative).toContainText("4 peserta hadir selama 4 hari (25/10/2026–04/11/2026) dengan 8 check-in, rata-rata 2 per orang.");
  const facts = page.getByTestId("fact");
  await expect(facts).toHaveCount(5);
  await expect(facts.filter({ hasText: "Puncak kedatangan" })).toContainText("02/11/2026, 2 peserta baru");
  await expect(facts.filter({ hasText: "Divisi terbesar" })).toContainText("Biro Hukum, 2 orang; 1 tidak mengisi divisi");
  await expect(facts.filter({ hasText: "E-Vote" })).toContainText("Classroom table unggul, 67% dari 12 suara");
  await expect(page.getByText("4 dari 4 peserta; 3 baris uji coba tidak dihitung.")).toBeVisible();
  await expect(page.getByText("asdasd")).toHaveCount(0);
  await expect(facts.filter({ hasText: "Kesan & Pesan" })).toContainText("2 pesan masuk");
  await expect(facts.filter({ hasText: "Undian" })).toContainText("1 pemenang");
  await expect(page.getByTestId("stat-attendees")).toContainText("4");
  await expect(page.getByTestId("stat-visits")).toContainText("8");
  await expect(page.getByTestId("stat-visits")).toContainText("Rata-rata 2 per orang");
  await expect(page.getByTestId("stat-days")).toContainText("4");
  await expect(page.getByTestId("stat-checked-out")).toContainText("1");
  await expect(page.getByTestId("stat-rooms")).toContainText("1");
  await expect(page.getByTestId("stat-files")).toContainText("1");

  // The day chart: one column per day (the 25/10 test day included), the peak read out by default, any
  // column on hover or focus.
  const dayCols = page.getByTestId("day-col");
  await expect(dayCols).toHaveCount(4);
  const dayTip = page.getByTestId("day-col-tooltip");
  await expect(dayTip).toContainText("02/11");
  await expect(dayTip).toContainText("2 peserta baru, 0 check-in terakhir (Puncak)");
  await dayCols.nth(3).hover();
  await expect(dayTip).toContainText("04/11");
  await expect(dayTip).toContainText("0 peserta baru, 1 check-in terakhir");
  await dayCols.nth(2).focus();
  await expect(dayTip).toContainText("03/11");
  // Hours run from the first to the last hour with a check-in: 08:00 to 13:00.
  await expect(page.getByTestId("hour-col")).toHaveCount(6);
  await expect(page.getByTestId("hour-col-tooltip")).toContainText("3 check-in pukul 08:00");

  const divisi = page.getByTestId("divisi-row");
  await expect(divisi.nth(0)).toContainText("Biro Hukum");
  await expect(divisi.nth(0)).toContainText("2");
  await expect(divisi.nth(0)).toContainText("(50%)");
  await expect(divisi.filter({ hasText: "Tidak diisi" })).toHaveCount(1);
  await expect(page.getByText("Contoh Divisi")).toHaveCount(0);

  // The questions with countable answers; the Kesan & Pesan questions are quotes instead.
  const questions = page.getByTestId("question-card");
  await expect(questions).toHaveCount(1);
  await expect(questions.first()).toContainText("TYPE LAYOUT");
  await expect(questions.first()).toContainText("3 jawaban");
  await expect(questions.first()).toContainText("ROUNDTABLE");
  await expect(questions.first()).toContainText("(67%)");

  // The real vote (12 voters) shows; the 1-voter trial is hidden until asked for.
  const chips = page.getByTestId("poll-chip");
  await expect(chips).toHaveCount(0);
  const pollCard = page.getByTestId("poll-card");
  await expect(pollCard).toContainText("12 orang memilih");
  await expect(pollCard).toContainText("Ditutup");
  await expect(page.getByTestId("vote-slice")).toHaveCount(2);
  await expect(pollCard).toContainText("Classroom table");
  await expect(pollCard).toContainText("67%");
  await page.getByRole("button", { name: "Tampilkan uji coba (1)", exact: true }).click();
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).toHaveText("E-Vote (12 suara)");
  await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
  await chips.nth(1).click();
  await expect(pollCard).toContainText("E-VOTE");
  await expect(pollCard).toContainText("1 orang memilih");
  await expect(facts.filter({ hasText: "E-Vote" })).toContainText("A unggul, 100% dari 1 suara (E-VOTE)");

  // Messages from the attendee page and from the form, searchable, with names that can be hidden for printing.
  const quotes = page.getByTestId("quote");
  await expect(quotes).toHaveCount(2);
  await expect(quotes.filter({ hasText: "Acaranya seru" })).toContainText("Budi Santoso");
  await expect(page.getByText("Pesan demo")).toHaveCount(0);
  await page.getByRole("button", { name: "Sembunyikan nama", exact: true }).click();
  await expect(quotes.filter({ hasText: "Budi Santoso" })).toHaveCount(0);
  await expect(quotes.first()).toContainText("Peserta");
  await page.getByRole("button", { name: "Tampilkan nama", exact: true }).click();
  await page.getByLabel("Cari pesan", { exact: true }).fill("seru");
  await expect(quotes).toHaveCount(1);
  await expect(quotes).toContainText("Acaranya seru");

  const winners = page.getByTestId("winner-row");
  await expect(winners).toHaveCount(1);
  await expect(winners).toContainText("Andri Syamsudin");
  await expect(winners).toContainText("Hadiah 1");
  await expect(page.getByText("Rudi Hartono")).toHaveCount(0);
});

test("the day presets, the dates and a division narrow every number and the conclusion together", async ({ page }) => {
  const data = seed();
  const state = await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  state.feedback.push(...data.feedback);
  await openLaporan(page);
  const attendees = page.getByTestId("stat-attendees");
  // The last week before the last check-in (04/11): the 25/10 test day drops out.
  await page.getByRole("button", { name: "Minggu terakhir", exact: true }).click();
  await expect(attendees).toContainText("3");
  await expect(page.getByTestId("stat-visits")).toContainText("Rata-rata 2,3 per orang");
  await expect(page.getByText("Puslitbang")).toHaveCount(0);

  // Only days with check-ins can be picked, from our own list (not the system's), by mouse or keyboard.
  await page.getByRole("button", { name: "Pilih tanggal", exact: true }).click();
  const fromDay = page.getByRole("button", { name: "Dari tanggal", exact: true });
  await expect(fromDay).toHaveText("Dari awal");
  await fromDay.click();
  await expect(page.getByRole("option")).toHaveText(["Dari awal", "25/10/2026", "02/11/2026", "03/11/2026"]);
  await page.getByRole("option", { name: "03/11/2026" }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(fromDay).toHaveText("03/11/2026");
  await expect(attendees).toContainText("1");
  const toDay = page.getByRole("button", { name: "Sampai tanggal", exact: true });
  await toDay.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(toDay).toHaveText("02/11/2026");
  // From 03/11 to 02/11: nobody.
  await expect(page.getByTestId("narrative")).toContainText("Belum ada check-in dalam rentang ini.");
  await toDay.click();
  await page.getByRole("option", { name: "Sampai akhir" }).click();
  await expect(attendees).toContainText("1");
  await expect(page.getByText("1 dari 4 peserta; 3 baris uji coba tidak dihitung.")).toBeVisible();
  await page.getByRole("button", { name: "Seluruh acara", exact: true }).click();
  await expect(attendees).toContainText("4");

  // Click a division: the report is that division's; the chip shows it and clears it.
  await page.getByTestId("divisi-row").filter({ hasText: "Biro Hukum" }).click();
  await expect(page.getByTestId("division-chip")).toContainText("Divisi: Biro Hukum");
  await expect(attendees).toContainText("2");
  await expect(page.getByTestId("stat-visits")).toContainText("6");
  await expect(page.getByTestId("narrative")).toContainText("2 peserta hadir");
  await expect(page.getByTestId("question-card").first()).toContainText("2 jawaban");
  await expect(page.getByTestId("quote")).toHaveCount(2);
  await expect(page.getByTestId("divisi-row").filter({ hasText: "Biro Hukum" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Hapus filter", exact: true }).click();
  await expect(page.getByTestId("division-chip")).toHaveCount(0);
  await expect(attendees).toContainText("4");
});

test("the Google Sheet's Check-in tab, dropped on the page, gives attendance per session and joins the conclusion", async ({ page }) => {
  const data = seed();
  await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  await openLaporan(page);
  const csv = [
    "Waktu Check-in (WIB),Sesi,Nama,E-mail,Check-in ke-",
    "02/11/2026 08:10 WIB,02-11-2026 Sesi 1,Budi Santoso,budi@bawaslu.test,1",
    "02/11/2026 08:12 WIB,02-11-2026 Sesi 1,Siti Rahma,siti@bawaslu.test,1",
    "02/11/2026 13:40 WIB,02-11-2026 Sesi 2,Budi Santoso,budi@bawaslu.test,2",
    "02/11/2026 13:41 WIB,02-11-2026 Sesi 2,Budi Santoso,BUDI@bawaslu.test,3",
    "03/11/2026 08:01 WIB,03-11-2026 Sesi 1,Agus Canny,agus@bawaslu.test,1",
    "",
  ].join("\n");
  const dropped = await page.evaluateHandle((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], "Check-in.csv", { type: "text/csv" }));
    return data;
  }, csv);
  await page.getByTestId("sheet-dropzone").dispatchEvent("drop", { dataTransfer: dropped });
  await expect(page.getByRole("status")).toHaveText("5 check-in dalam 3 sesi.");
  await expect(page.getByTestId("session-col")).toHaveCount(3);
  await expect(page.getByTestId("session-col-tooltip")).toContainText("02-11-2026 Sesi 1: 2 check-in, 2 orang (Paling ramai)");
  await page.getByTestId("session-col").nth(1).hover();
  await expect(page.getByTestId("session-col-tooltip")).toContainText("02-11-2026 Sesi 2: 2 check-in, 1 orang");
  await expect(page.getByTestId("fact").filter({ hasText: "Sesi teramai" })).toContainText("02-11-2026 Sesi 1, 2 check-in dari 2 orang");

  // The wrong file says what to upload, and the chart stays.
  await page.getByLabel("Unggah ekspor tab Check-in", { exact: true }).setInputFiles({ name: "lain.csv", mimeType: "text/csv", buffer: Buffer.from("Nama,Divisi\nBudi,Hukum\n") });
  await expect(page.getByRole("alert")).toContainText('Kolom "Sesi" tidak ditemukan');
  await expect(page.getByTestId("session-col")).toHaveCount(0);
});

test("Cetak prints the report alone, over as many pages as it needs", async ({ page }) => {
  const data = seed();
  await installSupabaseStub(page, { checkins: data.checkins, polls: data.polls, ballots: data.ballots, wheel: data.wheel });
  await openLaporan(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("link", { name: "Undian", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Cetak / simpan PDF", exact: true })).toBeHidden();
  await expect(page.getByTestId("poll-chip").first()).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-print="page"]')!).overflowY)).toBe("visible");
  const pdf = await page.pdf({ format: "A4" });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThanOrEqual(2);
});
