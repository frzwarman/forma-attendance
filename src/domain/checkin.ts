import { z } from "zod";
import { phoneDigits } from "./phone";

const dateString = /^\d{4}-\d{2}-\d{2}$/;

export const checkInSchema = z
  .object({
    name: z.string().trim().min(2, "Nama wajib diisi").max(120, "Nama maksimal 120 karakter"),
    phone: z.string().refine((value) => {
      const length = phoneDigits(value).length;
      return length >= 8 && length <= 15;
    }, "Nomor telepon tidak valid"),
    email: z
      .string()
      .trim()
      .max(160, "E-mail maksimal 160 karakter")
      .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail tidak valid"),
    address: z.string().trim().min(1, "Alamat wajib diisi").max(400, "Alamat maksimal 400 karakter"),
    check_in_date: z.string().regex(dateString, "Tanggal check in wajib diisi"),
    check_out_date: z.string().regex(dateString, "Tanggal check out wajib diisi"),
  })
  .refine(
    (value) =>
      !dateString.test(value.check_in_date) ||
      !dateString.test(value.check_out_date) ||
      value.check_out_date >= value.check_in_date,
    { message: "Tanggal check out tidak boleh sebelum tanggal check in", path: ["check_out_date"] },
  );

export type CheckInInput = z.infer<typeof checkInSchema>;
