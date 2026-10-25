import { test, expect } from "@playwright/test";

test("Nusantara reference logo, typography and field styling are preserved", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const logo = page.getByRole("img", { name: "Nusantara", exact: true });
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1694);
  const bounds = (await logo.boundingBox())!;
  expect(bounds.width).toBe(295);
  expect(Math.abs(bounds.y - 40)).toBeLessThan(2);
  const email = page.getByRole("textbox", {
    name: "Corporate email",
    exact: true,
  });
  await expect(email).toHaveCSS("border-color", "rgb(219, 175, 109)");
  await expect(email).toHaveCSS("border-radius", "6px");
  await expect(email).toHaveCSS("background-color", "rgba(29, 27, 26, 0.54)");
  await expect(email).toHaveCSS("font-family", "Arial");
  await page.screenshot({ path: "artifacts/nusantara-login.png" });
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Nusantara", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Clock in", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/nusantara-home.png" });
  expect(errors).toEqual([]);
});
