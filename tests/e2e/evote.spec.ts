import { expect, test, type Page } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { finishIntro } from "./intro";
import { deviceId, installSupabaseStub, pollRow } from "./supabase-stub";

const toRegistrasi = (page: Page) => page.getByRole("link", { name: "Lanjut ke Registrasi" });

test("the link page at / shows the event name without the welcome text, opens E-Vote and Registrasi, and the slideshow waits for Registrasi", async ({ page }) => {
  const welcome = "Silakan isi data diri Anda di meja registrasi.";
  await installSupabaseStub(page, { intro: true, settings: { event_name: "Rakernas Bawaslu 2026", welcome_text: welcome }, polls: [pollRow()] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rakernas Bawaslu 2026" })).toBeVisible();
  // Name and welcome text come from the same settings: with the name shown, the text would be too.
  await expect(page.getByText(welcome)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Informasi acara" })).toHaveCount(0);
  await page.getByRole("link", { name: /^E-Vote/ }).click();
  await expect(page).toHaveURL(/\/vote$/);
  await expect(page.getByRole("radio", { name: "Round table" })).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: /^Registrasi/ }).click();
  await expect(page).toHaveURL(/\/registrasi$/);
  await finishIntro(page);
  await expect(page.getByText("Formulir Check-in")).toBeVisible();
  await expect(page.getByText(welcome)).toBeVisible();
});

test("an attendee picks one option and votes once; the phone keeps its vote and goes on to Registrasi", async ({ page }) => {
  const poll = pollRow({ options: ["Round table", "Classroom"], max_picks: 1 });
  const state = await installSupabaseStub(page, { polls: [poll] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vote");
  await expect(page.getByText("Pilih 1 dari pilihan di bawah", { exact: true })).toBeVisible();
  const round = page.getByRole("radio", { name: "Round table" });
  const classroom = page.getByRole("radio", { name: "Classroom" });
  const send = page.getByRole("button", { name: "Kirim suara", exact: true });
  await expect(send).toBeDisabled();
  await round.click();
  await expect(round).toBeChecked();
  await classroom.click();
  await expect(classroom).toBeChecked();
  await expect(round).not.toBeChecked();
  await send.click();
  await expect(page.getByText("Terima kasih!", { exact: true })).toBeVisible();
  await expect(page.getByTestId("my-picks")).toHaveText("Classroom");
  expect(state.ballots).toEqual([{ poll_id: poll.id, device_id: expect.stringMatching(/^[0-9a-f]{32}$/), picks: [1] }]);
  // A full-size button (the large one is 54 px tall), not a bare text link.
  expect((await toRegistrasi(page).boundingBox())!.height).toBeGreaterThanOrEqual(54);

  // Opened again on the same phone: the thanks, no second ballot.
  await page.reload();
  await expect(page.getByText("Terima kasih!", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(state.ballots).toHaveLength(1);

  await toRegistrasi(page).click();
  await expect(page).toHaveURL(/\/registrasi$/);
  await expect(page.getByText("Formulir Check-in")).toBeVisible();
});

test("a phone that already voted, from another tab, is shown its first picks instead of a second vote", async ({ page }) => {
  const poll = pollRow({ options: ["Round table", "Classroom"], max_picks: 1 });
  const state = await installSupabaseStub(page, { polls: [poll], ballots: [{ poll_id: poll.id, device_id: deviceId(7), picks: [0] }] });
  // The phone's ID, kept from the first tab; that tab's record of the vote is not there.
  await page.addInitScript((device) => localStorage.setItem("guestbook.evote", JSON.stringify({ device, votes: {} })), deviceId(7));
  await page.goto("/vote");
  await page.getByRole("radio", { name: "Classroom" }).click();
  await page.getByRole("button", { name: "Kirim suara", exact: true }).click();
  await expect(page.getByText("Terima kasih!", { exact: true })).toBeVisible();
  await expect(page.getByTestId("my-picks")).toHaveText("Round table");
  expect(state.ballots).toHaveLength(1);
  expect(state.rpcCalls.find((call) => call.name === "guestbook_cast_ballot")?.body.p_device_id).toBe(deviceId(7));
});

test("with several picks allowed, the attendee ticks up to the limit, in any order", async ({ page }) => {
  const poll = pollRow({ options: ["Round table", "Classroom", "U-shape"], max_picks: 2 });
  const state = await installSupabaseStub(page, { polls: [poll] });
  await page.goto("/vote");
  await expect(page.getByText("Pilih maksimal 2 dari pilihan di bawah", { exact: true })).toBeVisible();
  const box = (name: string) => page.getByRole("checkbox", { name });
  await box("U-shape").click();
  await box("Classroom").click();
  await expect(page.getByText("2 dari 2 dipilih", { exact: true })).toBeVisible();
  await expect(box("Round table")).toBeDisabled();
  await box("Classroom").click();
  await expect(box("Classroom")).not.toBeChecked();
  await expect(box("Round table")).toBeEnabled();
  await box("Round table").click();
  await page.getByRole("button", { name: "Kirim suara", exact: true }).click();
  await expect(page.getByTestId("my-picks")).toHaveText("Round table, U-shape");
  expect(state.ballots.map((ballot) => ballot.picks)).toEqual([[0, 2]]);
});

test("before voting opens the page waits and opens by itself; after it closes it says so; both lead to Registrasi", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/vote");
  await expect(page.getByText("Voting belum dibuka", { exact: true })).toBeVisible();
  await expect(toRegistrasi(page)).toBeVisible();
  state.polls.push(pollRow());
  await expect(page.getByRole("radio", { name: "Round table" })).toBeVisible({ timeout: 15000 });
  state.polls[0].is_open = false;
  await page.reload();
  await expect(page.getByText("Voting sudah ditutup", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(toRegistrasi(page)).toBeVisible();
});

test("a ballot sent after the admin changed the options or closed voting is not counted, and the page says why", async ({ page }) => {
  const state = await installSupabaseStub(page, { polls: [pollRow({ created_at: "2026-11-04T01:00:00.000Z" })] });
  await page.goto("/vote");
  await page.getByRole("radio", { name: "Round table" }).click();
  state.polls.push(pollRow({ options: ["Nasi goreng", "Soto"], created_at: "2026-11-04T02:00:00.000Z" }));
  await page.getByRole("button", { name: "Kirim suara", exact: true }).click();
  await expect(page.getByText("Pilihan voting berubah. Silakan pilih lagi.", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Round table" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Soto" }).click();
  state.polls[1].is_open = false;
  await page.getByRole("button", { name: "Kirim suara", exact: true }).click();
  await expect(page.getByText("Voting sudah ditutup", { exact: true })).toBeVisible();
  expect(state.ballots).toHaveLength(0);
});

test("an admin sets the options and how many each person may pick, opens voting, closes it and opens it again", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "E-Vote", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E-Vote", exact: true })).toBeVisible();
  await expect(page.getByText("Belum ada voting", { exact: true })).toBeVisible();
  const save = page.getByRole("button", { name: "Simpan & buka voting", exact: true });
  const close = page.getByRole("button", { name: "Tutup voting", exact: true });
  const more = page.getByRole("button", { name: "Tambah jumlah pilihan", exact: true });
  const picks = page.getByTestId("max-picks");
  await expect(close).toBeDisabled();

  await page.getByLabel("Pilihan 1", { exact: true }).fill("Round table");
  await save.click();
  await expect(page.getByRole("alert")).toHaveText("Isi minimal 2 pilihan.");
  expect(state.polls).toHaveLength(0);

  await page.getByLabel("Pilihan 2", { exact: true }).fill("Classroom");
  await page.getByRole("button", { name: "Tambah pilihan", exact: true }).click();
  await page.getByLabel("Pilihan 3", { exact: true }).fill("U-shape");
  await more.click();
  await more.click();
  await expect(picks).toHaveText("3");
  await expect(more).toBeDisabled();
  // One option fewer: no more picks than options.
  await page.getByRole("button", { name: "Hapus pilihan 3", exact: true }).click();
  await expect(picks).toHaveText("2");
  await page.getByRole("button", { name: "Tambah pilihan", exact: true }).click();
  await page.getByLabel("Pilihan 3", { exact: true }).fill("U-shape");

  await save.click();
  await expect(page.getByText("Voting dibuka", { exact: true })).toBeVisible();
  await expect(page.getByText("Voting baru dibuka.", { exact: true })).toBeVisible();
  expect(state.polls).toEqual([expect.objectContaining({ options: ["Round table", "Classroom", "U-shape"], max_picks: 2, is_open: true })]);

  await close.click();
  await expect(page.getByText("Voting ditutup", { exact: true })).toBeVisible();
  await expect(close).toBeDisabled();
  expect(state.polls[0].is_open).toBe(false);

  // The same options again: the same vote opens again, without asking.
  await save.click();
  await expect(page.getByText("Voting dibuka lagi.", { exact: true })).toBeVisible();
  await expect(page.getByText("Voting dibuka", { exact: true })).toBeVisible();
  expect(state.polls).toHaveLength(1);
  expect(state.polls[0].is_open).toBe(true);
});

test("changing the options of a vote that has votes asks first, then starts a new vote from zero", async ({ page }) => {
  const poll = pollRow({ options: ["Round table", "Classroom"], max_picks: 1 });
  const state = await installSupabaseStub(page, {
    polls: [poll],
    ballots: [1, 2, 3].map((n) => ({ poll_id: poll.id, device_id: deviceId(n), picks: [0] })),
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "E-Vote", exact: true }).click();
  const second = page.getByLabel("Pilihan 2", { exact: true });
  await expect(second).toHaveValue("Classroom");
  await second.fill("U-shape");
  const save = page.getByRole("button", { name: "Simpan & buka voting", exact: true });
  const dialog = page.getByRole("dialog", { name: "Mulai voting baru" });
  await save.click();
  await expect(dialog).toContainText("3 orang");
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.polls).toHaveLength(1);

  await save.click();
  await dialog.getByRole("button", { name: "Ya, mulai voting baru", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Voting baru dibuka.", { exact: true })).toBeVisible();
  expect(state.polls).toHaveLength(2);
  expect(state.polls[1]).toMatchObject({ options: ["Round table", "U-shape"], max_picks: 1, is_open: true });
  await expect(page.getByLabel("Pilihan 2", { exact: true })).toHaveValue("U-shape");
});

test("Hasil E-Vote shows the live count on a page of its own, in the admin's order, and fills the screen", async ({ page }) => {
  const poll = pollRow({ options: ["Round table", "Classroom"], max_picks: 1 });
  const state = await installSupabaseStub(page, {
    polls: [poll],
    ballots: [[0], [0], [1]].map((picks, i) => ({ poll_id: poll.id, device_id: deviceId(i + 1), picks })),
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Hasil E-Vote", exact: true }).click();
  const stage = page.getByTestId("evote-stage");
  const rows = stage.getByTestId("result-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Round table");
  await expect(rows.nth(0)).toContainText("2 · 67%");
  await expect(rows.nth(1)).toContainText("Classroom");
  await expect(rows.nth(1)).toContainText("1 · 33%");
  await expect(stage).toContainText("3 orang sudah memilih");
  // The settings are on the E-Vote page, not here.
  await expect(page.getByLabel("Pilihan 1", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simpan & buka voting" })).toHaveCount(0);

  // Votes arrive: the count follows without a reload, and the bars keep their order.
  state.ballots.push(...[4, 5].map((n) => ({ poll_id: poll.id, device_id: deviceId(n), picks: [1] })));
  await expect(stage).toContainText("5 orang sudah memilih", { timeout: 6000 });
  await expect(rows.nth(0)).toContainText("Round table");
  await expect(rows.nth(0)).toContainText("2 · 40%");
  await expect(rows.nth(1)).toContainText("3 · 60%");

  await page.getByRole("button", { name: "Layar penuh", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute("data-testid") ?? null)).toBe("evote-stage");
});

test("Hasil E-Vote before the first vote points to the E-Vote page", async ({ page }) => {
  await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Hasil E-Vote", exact: true }).click();
  await expect(page.getByTestId("evote-stage")).toContainText("Belum ada voting.");
});

test("before the E-Vote migration, the vote page says it cannot load and the admin page says what to run", async ({ page }) => {
  await installSupabaseStub(page, { legacyEvote: true });
  await page.goto("/vote");
  await expect(page.getByRole("alert")).toContainText("E-Vote gagal dimuat");
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "E-Vote", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("npm run db:push");
  await page.getByRole("link", { name: "Hasil E-Vote", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("npm run db:push");
});
