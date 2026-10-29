import { z } from "zod";
import { answerSchema, type FormField } from "./formFields";
import { phoneDigits } from "./phone";

// Always asked: they identify the attendee for duplicates, check-out and the lucky draw.
const fixed = {
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
};

// The form's rules for the questions the admin set up; answers are keyed by question id.
export const checkInSchemaFor = (fields: FormField[]) =>
  z.object({ ...fixed, answers: z.object(Object.fromEntries(fields.map((field) => [field.id, answerSchema(field)]))) });

export type CheckInInput = { name: string; phone: string; email: string; answers: Record<string, string> };

// What the check-in RPC stores: Divisi and the room in their columns, every other filled-in answer
// under its question's label. Empty answers are left out.
export function splitAnswers(fields: FormField[], answers: Record<string, string>) {
  const result = { divisi: "", room_number: "", answers: {} as Record<string, string> };
  for (const field of fields) {
    const value = (answers[field.id] ?? "").trim();
    if (!value) continue;
    if (field.builtin) result[field.builtin] = value;
    else result.answers[field.label] = value;
  }
  return result;
}
