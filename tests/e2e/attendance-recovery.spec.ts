import { expect, test } from "@playwright/test";
import { seedDatabase } from "../../src/services/seed";

test("the attendance action occupies a visible full-width row on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const action = page.getByRole("button", { name: "Clock in", exact: true });
  await expect(action).toBeVisible();
  const bounds = (await action.boundingBox())!;
  expect(bounds.width).toBeGreaterThan(200);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await action.click();
  await expect(page.getByRole("dialog", { name: "Start your workday", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page.getByRole("button", { name: "Request leave", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "A little time for you", exact: true })).toBeVisible();
});

test("an unreadable saved workspace can be restored only after explicit confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    let unreadable = true;
    Storage.prototype.getItem = function (key) {
      if (key === "forma.demo.v1" && unreadable) throw new Error("Saved workspace is unreadable");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      set.call(this, key, value);
      if (key === "forma.demo.v1") unreadable = false;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Restore demo workspace", exact: true }).click();
  await expect(page.getByText("This replaces saved demo attendance and requests on this device", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Keep saved data", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clock in", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Restore demo workspace", exact: true }).click();
  await page.getByRole("button", { name: "Restore demo data", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clock in", exact: true })).toBeVisible();
});

test("Home never advertises rejected or pending leave as an upcoming approval", async ({ page }) => {
  const db = seedDatabase();
  for (const request of db.requests) if (request.kind === "leave") request.status = "Rejected";
  await page.addInitScript((database) => localStorage.setItem("forma.demo.v1", JSON.stringify(database)), db);
  await page.goto("/");
  await expect(page.getByText("No upcoming approved leave", { exact: true })).toBeVisible();
  await expect(page.getByText("Your annual leave is approved", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Coming up next week", { exact: true })).toHaveCount(0);
});
