import type { Page } from "@playwright/test";

export const valid = {
  name: "Budi Santoso",
  phone: "0812 1111 2222",
  email: "budi@example.test",
  jabatan: "Staf",
  address: "Jl. MH Thamrin 14",
  in: "2026-11-02",
  out: "2026-11-04",
};

export async function fillForm(page: Page, overrides: Partial<typeof valid> = {}) {
  const v = { ...valid, ...overrides };
  await page.getByLabel("Nama", { exact: true }).fill(v.name);
  await page.getByLabel("Nomor Telepon", { exact: true }).fill(v.phone);
  await page.getByLabel("E-mail", { exact: true }).fill(v.email);
  await page.getByLabel("Jabatan", { exact: true }).fill(v.jabatan);
  await page.getByLabel("Alamat", { exact: true }).fill(v.address);
  await page.getByLabel("Tanggal Check In", { exact: true }).fill(v.in);
  await page.getByLabel("Tanggal Check Out", { exact: true }).fill(v.out);
}
