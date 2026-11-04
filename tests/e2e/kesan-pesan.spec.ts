import { expect, test } from "@playwright/test";
import { fillForm } from "./form";
import { installSupabaseStub } from "./supabase-stub";

test("after check-in, Kesan & Pesan and then check-out come last; a message is sent under the attendee's check-in", async ({ page }) => {
  const state = await installSupabaseStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/registrasi");
  await fillForm(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByText(/tekan Check out sekarang di bagian bawah halaman/)).toBeVisible();
  await page.getByRole("button", { name: "Lihat informasi acara", exact: true }).click();

  // Banner, event guide, Kesan & Pesan, check-out: top to bottom.
  const top = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!.y;
  const order = [
    await top(page.getByRole("region", { name: "Informasi acara" })),
    await top(page.getByRole("region", { name: "Panduan acara" })),
    await top(page.getByRole("heading", { name: "Kesan & Pesan", exact: true })),
    await top(page.getByRole("heading", { name: "Anda sudah check-in" })),
  ];
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  const box = page.getByLabel("Kesan & pesan", { exact: true });
  const send = page.getByRole("button", { name: "Kirim kesan & pesan", exact: true });
  await expect(page.getByText("Dikirim atas nama Budi Santoso.")).toBeVisible();
  // Nothing written: asked to write first, nothing sent.
  await send.click();
  await expect(page.getByRole("alert")).toHaveText("Tulis kesan & pesan Anda dulu.");
  expect(state.rpcCalls.filter((call) => call.name === "guestbook_send_feedback")).toHaveLength(0);

  await box.fill("  Materinya sangat bermanfaat.  ");
  await send.click();
  await expect(page.getByRole("status")).toHaveText("Terima kasih! Kesan & pesan Anda sudah terkirim.");
  await expect(box).toHaveValue("");
  expect(state.feedback).toEqual([{ checkin_id: state.checkins[0].id, message: "Materinya sangat bermanfaat." }]);
  // Another one later is fine.
  await box.fill("Semoga ada acara serupa lagi.");
  await send.click();
  await expect.poll(() => state.feedback.length).toBe(2);
});

test("a check-in code the database does not know is explained", async ({ page }) => {
  await installSupabaseStub(page);
  await page.addInitScript(() =>
    localStorage.setItem("guestbook.checkouts", JSON.stringify([{ token: "kode-hilang", name: "Budi Santoso", at: new Date().toISOString() }])),
  );
  await page.goto("/registrasi");
  await page.getByLabel("Kesan & pesan", { exact: true }).fill("Halo panitia");
  await page.getByRole("button", { name: "Kirim kesan & pesan", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Kode check-in tidak dikenal");
});
