import { expect, test } from "@playwright/test";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { signInAsAdmin } from "./admin";
import { checkInRow, installSupabaseStub } from "./supabase-stub";

test("admins download the complete list as CSV and Excel with phone numbers intact", async ({ page }) => {
  await installSupabaseStub(page, {
    settings: { event_name: "Rakernas Bawaslu 2026" },
    checkins: [checkInRow({ phone: "081234567890" }), checkInRow(), checkInRow()],
  });
  await page.goto("/admin");
  await signInAsAdmin(page);
  await expect(page.getByText("Total check-in: 3", { exact: true })).toBeVisible();

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV", exact: true }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/^check-in-rakernas-bawaslu-2026-\d{8}\.csv$/);
  const text = fs.readFileSync((await csv.path())!, "utf8");
  expect(text.startsWith("﻿Waktu Check-in (WIB),Nama")).toBe(true);
  expect(text.trim().split("\r\n")).toHaveLength(4);
  expect(text).toContain("081234567890");

  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor Excel", exact: true }).click();
  const xlsx = await xlsxDownload;
  expect(xlsx.suggestedFilename()).toMatch(/^check-in-rakernas-bawaslu-2026-\d{8}\.xlsx$/);
  const sheet = XLSX.read(fs.readFileSync((await xlsx.path())!)).Sheets["Check-in"];
  const phones = ["C2", "C3", "C4"].map((ref) => sheet[ref]);
  expect(phones.every((cell) => cell.t === "s")).toBe(true);
  expect(phones.map((cell) => cell.v)).toContain("081234567890");
});
