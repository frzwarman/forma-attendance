import { expect, test } from "@playwright/test";
import { dateKey } from "../../src/domain/attendance";

test("mobile HR users can reach their account and log out", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch demo role", exact: true }).click();
  await page.getByRole("button", { name: "HR administrator · Kevin Santoso" }).click();
  const profile = page.getByRole("button", { name: "Profile", exact: true });
  await expect(profile).toBeVisible();
  const bounds = (await profile.boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await profile.click();
  await expect(page.getByText("Kevin Santoso", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByText("Welcome back.", { exact: true })).toBeVisible();
});

test("location editing preserves partial negative and decimal coordinates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch demo role", exact: true }).click();
  await page.getByRole("button", { name: "HR administrator · Kevin Santoso" }).click();
  await page.getByRole("tab", { name: "Offices", exact: true }).click();
  await page.getByRole("button", { name: "Manage location", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Office attendance zone", exact: true });
  const latitude = dialog.getByRole("textbox", { name: "Latitude", exact: true });
  const longitude = dialog.getByRole("textbox", { name: "Longitude", exact: true });
  const radius = dialog.getByRole("textbox", { name: "Allowed radius (meters)", exact: true });
  await latitude.fill("");
  await dialog.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(dialog.getByText("Enter coordinates and an allowed radius.", { exact: true })).toBeVisible();
  await latitude.pressSequentially("-");
  await expect(latitude).toHaveValue("-");
  await latitude.pressSequentially("6.");
  await expect(latitude).toHaveValue("-6.");
  await latitude.pressSequentially("125");
  await longitude.fill("");
  await longitude.pressSequentially("106.825");
  await expect(longitude).toHaveValue("106.825");
  await radius.fill("");
  await radius.pressSequentially("175");
  await dialog.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Office location saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("-6.1250, 106.8250", { exact: true })).toBeVisible();
  await expect(page.getByText("175 m radius", { exact: true })).toBeVisible();
});

test("history List view removes the calendar and restores it on demand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/history");
  const nextMonth = page.getByRole("button", { name: "Next month", exact: true });
  const dayDetails = page.getByText("Day details", { exact: true });
  await expect(nextMonth).toBeVisible();
  await expect(dayDetails).toBeVisible();
  const selectedDate = page.getByRole("button", { name: new RegExp(`^${dateKey()}`) });
  await expect(selectedDate.getByText(String(Number(dateKey().slice(-2))), { exact: true }))
    .toHaveCSS("color", "rgb(29, 27, 26)");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(nextMonth).toHaveCount(0);
  await expect(dayDetails).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Search attendance", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(nextMonth).toBeVisible();
  await expect(dayDetails).toBeVisible();
});
