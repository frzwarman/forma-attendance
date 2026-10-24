import { expect, test, type Locator } from "@playwright/test";

async function expectContentInside(card: Locator) {
  const outside = await card.evaluate((element) => {
    const parent = element.getBoundingClientRect();
    return Array.from(element.querySelectorAll("div, button, img, input"))
      .filter((child) => {
        const bounds = child.getBoundingClientRect();
        return (
          bounds.width > 0 &&
          bounds.height > 0 &&
          (bounds.bottom > parent.bottom + 2 ||
            bounds.top < parent.top - 2 ||
            bounds.left < parent.left - 2 ||
            bounds.right > parent.right + 2)
        );
      })
      .map((child) => child.textContent?.slice(0, 80));
  });
  expect(outside).toEqual([]);
}

for (const width of [320, 375, 390, 430]) {
  test(`schedule and profile contain their content at ${width}px after tab navigation`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "Schedule", exact: true }).click();
    const plan = page.getByTestId("schedule-plan-card");
    await expect(plan.getByText("Today’s plan", { exact: true })).toBeVisible();
    await expectContentInside(plan);
    const planBounds = (await plan.boundingBox())!;
    const weekBounds = (await page
      .getByTestId("schedule-week-card")
      .boundingBox())!;
    const tabBounds = (await page
      .getByRole("tab", { name: "Schedule", exact: true })
      .boundingBox())!;
    expect(planBounds.y + planBounds.height).toBeLessThan(tabBounds.y);
    expect(weekBounds.y).toBeGreaterThan(planBounds.y + planBounds.height);
    await page.screenshot({ path: `artifacts/schedule-${width}.png` });
    await page
      .getByRole("button", { name: "Show month overview", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Next month", exact: true }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    const identity = page.getByTestId("profile-identity-card");
    await expect(
      identity.getByText("Alex Morgan", { exact: true }),
    ).toBeVisible();
    await expectContentInside(identity);
    expect((await identity.boundingBox())!.height).toBeLessThan(260);
    await page.screenshot({ path: `artifacts/profile-${width}.png` });
    for (const id of [
      "profile-work-card",
      "profile-preferences-card",
      "profile-demo-card",
    ]) {
      await expectContentInside(page.getByTestId(id));
    }
    const preferences = page.getByTestId("profile-preferences-card");
    await preferences.scrollIntoViewIfNeeded();
    const light = page.getByRole("button", { name: "Light", exact: true });
    const dark = page.getByRole("button", { name: "Dark", exact: true });
    const system = page.getByRole("button", { name: "System", exact: true });
    expect((await light.boundingBox())!.y).toBe((await dark.boundingBox())!.y);
    expect((await light.boundingBox())!.y).toBe(
      (await system.boundingBox())!.y,
    );
    await dark.click();
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("screen-scroll").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const logout = page.getByRole("button", { name: "Log out", exact: true });
    await expect(logout).toBeVisible();
    const logoutBounds = (await logout.boundingBox())!;
    const profileTab = page.getByRole("tab", { name: "Profile", exact: true });
    expect(logoutBounds.y + logoutBounds.height).toBeLessThan(
      (await profileTab.boundingBox())!.y,
    );
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await profileTab.click();
    await expect(identity).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByTestId("screen-scroll")
          .evaluate((element) => element.scrollTop),
      )
      .toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(errors).toEqual([]);
  });
}

test("employee preview keeps a phone layout on a desktop browser", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(
    (await page.getByTestId("screen-scroll").boundingBox())!.width,
  ).toBeLessThanOrEqual(480);
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  await expectContentInside(page.getByTestId("schedule-plan-card"));
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expectContentInside(page.getByTestId("profile-identity-card"));
  await page.screenshot({ path: "artifacts/employee-phone-preview.png" });
});
