import { expect, test } from "@playwright/test";
import { dateKey, nextWorkingDate } from "../../src/domain/attendance";
import { seedDatabase } from "../../src/services/seed";

test("attendance and leave actions remain reachable in a short mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await page.goto("/");
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start your workday", exact: true });
  await expect(dialog).toBeVisible();
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(500);
  await dialog.getByRole("button", { name: "Verify my location" }).click();
  await dialog.getByRole("button", { name: "Confirm clock in" }).click();
  await expect(page.getByText("You’re checked in!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to my day" }).click();
  await page.getByRole("button", { name: "Clock out", exact: true }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await page.getByRole("button", { name: "Confirm clock out" }).click();
  await expect(page.getByText("You’re checked out!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to my day" }).click();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page.getByRole("button", { name: "Request leave", exact: true }).click();
  const start = page.getByRole("textbox", { name: "From (YYYY-MM-DD)", exact: true });
  const end = page.getByRole("textbox", { name: "To (YYYY-MM-DD)", exact: true });
  // Use a future working day, clear of the seeded requests.
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 22);
  const date = nextWorkingDate(dateKey(future));
  await start.fill(date);
  await end.fill(date);
  const reason = "A family appointment requested from a small phone screen.";
  await page.getByRole("textbox", { name: "A little context", exact: true }).fill(reason);
  await page.getByRole("button", { name: "Send leave request" }).click();
  await expect(page.getByText("You’re all set.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to requests" }).click();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(date) }).click();
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
});

test("persisted rest days explain clock-in availability and leave starts on a working day", async ({ page }) => {
  const db = seedDatabase();
  const today = dateKey();
  db.schedules.find((s) => s.employeeId === "emp-1" && s.date === today)!.dayOff = true;
  await page.addInitScript((database) => {
    localStorage.setItem("forma.demo.v1", JSON.stringify(database));
  }, db);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Clock in", exact: true })).toBeDisabled();
  await expect(page.getByText("Clock-in unavailable: rest day.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Next shift:/)).toBeVisible();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page.getByRole("button", { name: "Request leave", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "From (YYYY-MM-DD)", exact: true })).toHaveValue(nextWorkingDate(today));
  await expect(page.getByText("1 working days requested", { exact: true })).toBeVisible();
});
