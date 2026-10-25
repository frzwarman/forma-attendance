import { test, expect } from "@playwright/test";

test("startup, reload and appearance changes do not open the Expo error overlay", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--css-interop-darkMode")
          .trim(),
      ),
    )
    .toBe("class dark");
  await expect(
    page.getByRole("button", { name: "Dismiss error", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  const heading = page.getByText("A little about you", { exact: true });
  await expect(heading).toBeVisible();

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(heading).toHaveCSS("color", "rgb(243, 230, 210)");
  await page.reload();
  await expect(heading).toHaveCSS("color", "rgb(243, 230, 210)");

  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(heading).toHaveCSS("color", "rgb(219, 175, 109)");
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(heading).toHaveCSS("color", "rgb(243, 230, 210)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(heading).toHaveCSS("color", "rgb(219, 175, 109)");

  await expect(
    page.getByRole("button", { name: "Dismiss error", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("selfie shows live camera, captured preview, retake and selected photo", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .context()
    .grantPermissions(["camera"], { origin: new URL(baseURL!).origin });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Home", exact: true }).waitFor();
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  await page
    .getByRole("button", { name: "Verify my location", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Take a selfie", exact: true })
    .click();
  await expect(page.locator("video")).toBeVisible();
  const capture = page.getByRole("button", {
    name: "Capture selfie",
    exact: true,
  });
  await expect(capture).toBeEnabled();
  await capture.click();
  const preview = page.getByRole("img", {
    name: "Selfie preview",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveJSProperty("complete", true);
  await expect
    .poll(() =>
      preview.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Confirm clock in", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retake", exact: true }).click();
  await expect(capture).toBeEnabled();
  await capture.click();
  await expect(preview).toBeVisible();
  await page.screenshot({ path: "artifacts/selfie-preview.png" });
  await page.getByRole("button", { name: "Use photo", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Selected selfie", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm clock in", exact: true })
    .click();
  await expect(
    page.getByText("You’re checked in!", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("camera permission denial gives a recoverable message without a false preview", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .grantPermissions([], { origin: new URL(baseURL!).origin });
  await page.goto("/");
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  await page
    .getByRole("button", { name: "Take a selfie", exact: true })
    .click();
  await expect(
    page.getByText("Camera permission was denied.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Selfie preview", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Take a selfie", exact: true }),
  ).toBeVisible();
});

test("empty feedback and form states do not render text inside a View", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Clock in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Take a selfie", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByText("A little about you", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  await page
    .getByRole("button", { name: "Request leave", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "From (YYYY-MM-DD)", exact: true })
    .fill("");
  await page
    .getByRole("button", { name: "Send leave request", exact: true })
    .click();
  await expect(page.getByText("Use YYYY-MM-DD", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
