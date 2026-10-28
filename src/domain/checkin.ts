import { z } from "zod";
import { phoneDigits } from "./phone";

export const checkInSchema = z.object({
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
  // Hotel room, for attendees who stay at the event hotel.
  room_number: z.string().trim().max(20, "Nomor kamar maksimal 20 karakter").optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
