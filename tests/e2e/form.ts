import type { Page } from "@playwright/test";

export const valid = {
  name: "Budi Santoso",
  phone: "0812 1111 2222",
  email: "budi@example.test",
  address: "Jl. MH Thamrin 14",
};

export async function fillForm(page: Page, overrides: Partial<typeof valid> = {}) {
  const v = { ...valid, ...overrides };
  await page.getByLabel("Nama", { exact: true }).fill(v.name);
  await page.getByLabel("Nomor Telepon", { exact: true }).fill(v.phone);
  await page.getByLabel("E-mail", { exact: true }).fill(v.email);
  await page.getByLabel("Alamat", { exact: true }).fill(v.address);
}
