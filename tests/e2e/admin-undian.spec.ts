import { expect, test } from "@playwright/test";
import { signInAsAdmin } from "./admin";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("the draw picks each attendee once, masks the phone and can be redrawn after removal", async ({ page }) => {
  const state = await installSupabaseStub(page, {
    checkins: [
      checkInRow({ name: "Budi Santoso", phone: "081211112222" }),
      checkInRow({ name: "Siti Rahma", phone: "081333334444" }),
    ],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Undian" }).click();
  await expect(page.getByRole("heading", { name: "Undian" })).toBeVisible();
  const undi = page.getByRole("button", { name: "Undi", exact: true });
  const winnerName = page.getByTestId("winner-name");

  await undi.click();
  await expect(winnerName).toHaveText(/Budi Santoso|Siti Rahma/);
  const first = (await winnerName.textContent())!;
  await expect(page.getByTestId("winner-phone")).toHaveText(first === "Budi Santoso" ? "0812******22" : "0813******44");

  await undi.click();
  await expect(winnerName).not.toHaveText(first);
  await undi.click();
  await expect(page.getByRole("alert")).toContainText("Semua peserta sudah mendapat hadiah.");
  expect(state.winners).toHaveLength(2);

  await page.getByTestId("winner-row").filter({ hasText: first }).getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(page.getByTestId("winner-row")).toHaveCount(1);
  await undi.click();
  await expect(winnerName).toHaveText(first);
  expect(state.winners).toHaveLength(2);
});

test("the draw waits until someone has checked in", async ({ page }) => {
  await installSupabaseStub(page);
  await page.goto("/admin");
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Undian" }).click();
  await expect(page.getByText("Belum ada peserta yang check-in.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undi", exact: true })).toBeDisabled();
});
