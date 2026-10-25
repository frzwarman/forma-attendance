import { expect, test, type Page } from "@playwright/test";
import { dateKey, nextWorkingDate } from "../../src/domain/attendance";

// AsyncStorage's web adapter awaits the return from Storage calls. Delaying
// those calls tests real pending UI without adding latency to the application.
async function slowStorage(page: Page, failFirstWrite = false, readFailures = 0) {
  await page.addInitScript(({ failFirstWrite, readFailures }) => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    let fail = failFirstWrite;
    let readsToFail = readFailures;
    Storage.prototype.getItem = function (key) {
      if (key !== "forma.demo.v1") return get.call(this, key);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (readsToFail-- > 0) reject(new Error("Storage temporarily unavailable"));
          else resolve(get.call(this, key));
        }, 1000);
      }) as unknown as string | null;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key !== "forma.demo.v1") return set.call(this, key, value);
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (fail) {
            fail = false;
            reject(new Error("Storage temporarily unavailable"));
          } else {
            set.call(this, key, value);
            resolve();
          }
        }, 1000);
      }) as unknown as void;
    };
  }, { failFirstWrite, readFailures });
}

async function expectSaving(page: Page, label: string, progress: string) {
  const action = page.getByRole("button", { name: label, exact: true });
  await expect(action).toBeDisabled();
  await expect(action).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText(progress, { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").filter({ has: action }).getByRole("button", { name: "Close dialog", exact: true })).toBeDisabled();
  if (label === "Confirm clock in") {
    await page.screenshot({ path: "artifacts/loading-clock-in.png" });
  }
}

test("workspace reads show a loading state until data is available", async ({ page }) => {
  await slowStorage(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("progressbar", { name: "Loading workspace…", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/loading-workspace.png" });
  await expect(page.getByRole("button", { name: "Clock in", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Loading workspace…", exact: true })).toHaveCount(0);
});

test("notification failures release the pending state and allow a successful retry", async ({ page }) => {
  await slowStorage(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notifications");
  const mark = page.getByRole("button", { name: "Mark all as read", exact: true });
  await mark.click();
  await expect(mark).toBeDisabled();
  await expect(mark).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Marking as read…", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Storage temporarily unavailable");
  await expect(mark).toBeEnabled();
  await mark.click();
  await expect(mark).toHaveAttribute("aria-busy", "false");
  await expect(mark).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("New", { exact: true })).toHaveCount(0);
});

test("failed workspace reads show pending feedback during retry and recover", async ({ page }) => {
  // Exhaust the initial read and its automatic retry, then allow manual retry.
  await slowStorage(page, false, 2);
  await page.goto("/");
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(retry).toBeVisible({ timeout: 15000 });
  await retry.click();
  await expect(page.getByRole("progressbar", { name: "Loading workspace…", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clock in", exact: true })).toBeVisible();
});

test("lazy section downloads show a loading fallback instead of an empty page", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/_expo\/static\/js\/web\/.*page.*\.js/, async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/history", { waitUntil: "commit" });
    await expect(page.getByRole("progressbar", { name: "Loading section…", exact: true })).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByText("Your work, at a glance", { exact: true })).toBeVisible();
});

test("all data submissions show pending feedback and lock their dialog until completion", async ({ page }) => {
  await slowStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await page.getByRole("button", { name: "Confirm clock in" }).click();
  await expectSaving(page, "Confirm clock in", "Recording clock-in…");
  // The location action must not show a spinner for an attendance submission.
  await expect(page.getByRole("button", { name: "Refresh location" })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByText("You’re checked in!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to my day" }).click();
  await page.getByRole("button", { name: "Clock out", exact: true }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await page.getByRole("button", { name: "Confirm clock out" }).click();
  await expectSaving(page, "Confirm clock out", "Recording clock-out…");
  await expect(page.getByText("You’re checked out!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to my day" }).click();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page.getByRole("button", { name: "Request leave", exact: true }).click();
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 22);
  const date = nextWorkingDate(dateKey(future));
  await page.getByRole("textbox", { name: "From (YYYY-MM-DD)", exact: true }).fill(date);
  await page.getByRole("textbox", { name: "To (YYYY-MM-DD)", exact: true }).fill(date);
  await page.getByRole("textbox", { name: "A little context", exact: true }).fill("A family appointment with advance notice.");
  await page.getByRole("button", { name: "Send leave request" }).click();
  await expectSaving(page, "Send leave request", "Sending leave request…");
  await expect(page.getByRole("textbox", { name: "A little context", exact: true })).not.toBeEditable();
  await expect(page.getByText("You’re all set.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to requests" }).click();
  await page.getByRole("button", { name: "Correct attendance", exact: true }).click();
  await page.getByRole("textbox", { name: "What should we know?", exact: true }).fill("Please review the time recorded for my shift.");
  await page.getByRole("button", { name: "Send correction request" }).click();
  await expectSaving(page, "Send correction request", "Sending correction…");
  await expect(page.getByText("You’re all set.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to requests" }).click();
  await page.getByRole("button", { name: "Switch demo role", exact: true }).click();
  await page.getByRole("button", { name: "HR administrator · Kevin Santoso" }).click();
  await page.getByRole("tab", { name: "Approvals", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expectSaving(page, "Confirm approval", "Saving decision…");
  await expect(page.getByRole("button", { name: "Go back", exact: true })).toBeDisabled();
  await expect(page.getByText("Request approved. The employee has been notified.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Offices", exact: true }).click();
  await page.getByRole("button", { name: "Manage location", exact: true }).first().click();
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expectSaving(page, "Save location", "Saving location…");
  await expect(page.getByRole("textbox", { name: "Office name", exact: true })).not.toBeEditable();
  await expect(page.getByText("Office location saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch demo role", exact: true }).click();
  await page.getByRole("button", { name: "Employee · Alex Morgan" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo data", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo workspace", exact: true }).click();
  await expectSaving(page, "Reset demo workspace", "Resetting workspace…");
  await expect(page.getByRole("button", { name: "Keep my changes", exact: true })).toBeDisabled();
  await expect(page.getByText("Demo workspace reset.", { exact: true })).toBeVisible();
});
