import { test, expect } from "@playwright/test";
const futureWorkday = () => {
  const day = new Date();
  day.setDate(day.getDate() + 15);
  while ([0, 6].includes(day.getDay())) day.setDate(day.getDate() + 1);
  return day.toISOString().slice(0, 10);
};
test("employee attendance, persistent requests and HR review work across responsive layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/desktop-overview.png",
    fullPage: true,
  });
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("tab", { name: "Home", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/mobile-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/mobile-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  await page.getByRole("radio", { name: "Demo: outside" }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await expect(
    page.getByText("Outside the attendance zone", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm clock in" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Unavailable", exact: true }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await expect(
    page.getByText("Location is unavailable.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Demo: inside" }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await expect(
    page.getByText("Location verified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm clock in" }).click();
  await expect(
    page.getByText("You’re checked in!", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page
        .getByRole("button", { name: "Back to my day" })
        .evaluate((e) => e.getBoundingClientRect().width),
    )
    .toBeGreaterThan(280);
  await page.screenshot({ path: "artifacts/clock-in-success.png" });
  await page.getByRole("button", { name: "Back to my day" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Clock out", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clock out", exact: true }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await page.getByRole("button", { name: "Confirm clock out" }).click();
  await expect(
    page.getByText("You’re checked out!", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to my day" }).click();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page
    .getByRole("button", { name: "Request leave", exact: true })
    .click();
  const date = futureWorkday();
  await page
    .getByRole("textbox", { name: "From (YYYY-MM-DD)", exact: true })
    .fill(date);
  await page
    .getByRole("textbox", { name: "To (YYYY-MM-DD)", exact: true })
    .fill(date);
  await page
    .getByRole("textbox", { name: "A little context", exact: true })
    .fill("A planned family day to recharge.");
  await page.getByRole("button", { name: "Send leave request" }).click();
  await expect(
    page.getByText("You’re all set.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to requests" }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(date) }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch demo role", exact: true })
    .click();
  await page
    .getByRole("button", { name: "HR administrator · Kevin Santoso" })
    .click();
  await page.getByRole("tab", { name: "Approvals", exact: true }).click();
  await expect(
    page.getByText("A planned family day to recharge.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(
    page.getByText("Request approved. The employee has been notified.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByText("A pulse on your people", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/hr-dashboard.png", fullPage: true });
  await page
    .getByRole("button", { name: "Switch demo role", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Employee · Alex Morgan" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveCSS("background-color", "rgb(219, 175, 109)");
  await page.screenshot({ path: "artifacts/dark-profile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("mobile history, corrections, directory, locations and non-remembered login work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/history");
  await expect(
    page.getByText("Your work, at a glance", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Late", exact: true }).click();
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  await expect(
    page.getByText("Find your rhythm", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page
    .getByRole("button", { name: "Correct attendance", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "What should we know?", exact: true })
    .fill("I forgot to mark my attendance this morning.");
  await page.getByRole("button", { name: "Send correction request" }).click();
  await expect(
    page.getByText("You’re all set.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to requests" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Forgot to clock in/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch demo role", exact: true })
    .click();
  await page
    .getByRole("button", { name: "HR administrator · Kevin Santoso" })
    .click();
  await page.getByRole("tab", { name: "People", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search employees", exact: true })
    .fill("Sarah");
  await expect(page.getByText("Sarah Wijaya", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Offices", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage location", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Office name", exact: true })
    .fill("Jakarta Main Office");
  await page
    .getByRole("textbox", { name: "Allowed radius (meters)", exact: true })
    .fill("175");
  await page
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await expect(
    page.getByText("Office location saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Jakarta Main Office", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch demo role", exact: true })
    .click();
  await page.getByRole("button", { name: "Employee · Alex Morgan" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByText("Welcome back.", { exact: true })).toBeVisible();
  await page
    .getByLabel("Corporate email", { exact: true })
    .fill("alex@northstar.demo");
  await page.getByLabel("Password", { exact: true }).fill("Forma2026!");
  await page
    .getByRole("switch", { name: "Remember session", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Welcome back.", { exact: true })).toBeVisible();
});

test("all employee and HR screens fit the narrow mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const route of [
    "/",
    "/history",
    "/schedule",
    "/requests",
    "/profile",
    "/notifications",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("tab", { name: "Home", exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        { message: `Horizontal overflow on ${route}` },
      )
      .toBeLessThanOrEqual(0);
  }
  await page
    .getByRole("button", { name: "Switch demo role", exact: true })
    .click();
  await page
    .getByRole("button", { name: "HR administrator · Kevin Santoso" })
    .click();
  for (const route of [
    "/admin",
    "/employees",
    "/monitoring",
    "/approvals",
    "/locations",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("tab", { name: "Offices", exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        { message: `Horizontal overflow on ${route}` },
      )
      .toBeLessThanOrEqual(0);
  }
});
