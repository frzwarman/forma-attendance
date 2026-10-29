import { z } from "zod";

// The questions after Nama, Nomor Telepon and E-mail, as the admin sets them up in
// guestbook_settings.form_fields. Divisi and Nomor Kamar Hotel keep their own columns (builtin);
// any other answer is stored in the check-in's answers under the question's label, so an answer
// keeps its meaning in the export even after the question is removed or renamed.
export type FieldType = "text" | "textarea" | "select";
export type Builtin = "divisi" | "room_number";
export type FormField = { id: string; label: string; type: FieldType; required: boolean; options: string[]; builtin?: Builtin };

export const FIELD_TYPES: Record<FieldType, string> = { text: "Teks singkat", textarea: "Teks panjang", select: "Pilihan" };
export const BUILTIN_FIELDS: Record<Builtin, FormField> = {
  divisi: { id: "divisi", builtin: "divisi", label: "Divisi", type: "text", required: true, options: [] },
  room_number: { id: "room_number", builtin: "room_number", label: "Nomor Kamar Hotel", type: "text", required: false, options: [] },
};
// The form until an admin saves one (and before migration 20261031000000_guestbook_form_fields.sql).
export const DEFAULT_FORM_FIELDS: FormField[] = [BUILTIN_FIELDS.divisi];
// Nama, Nomor Telepon and E-mail: always asked, so no added question may take their labels.
export const FIXED_LABELS = ["Nama", "Nomor Telepon", "E-mail"];

// The database columns cap Divisi at 120 and the room at 20 characters.
export const maxLength = (field: FormField) =>
  field.builtin === "divisi" ? 120 : field.builtin === "room_number" ? 20 : field.type === "textarea" ? 1000 : 200;

const ID = /^[a-z0-9_]{1,40}$/;

// Reads what the database holds; malformed questions are left out. Null when nothing is saved.
export function parseFormFields(raw: unknown): FormField[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  return raw.slice(0, 30).flatMap((item): FormField[] => {
    const v = item as Partial<FormField> | null;
    const builtin = v?.builtin === "divisi" || v?.builtin === "room_number" ? v.builtin : undefined;
    const id = builtin ?? (typeof v?.id === "string" && ID.test(v.id) ? v.id : null);
    const label = typeof v?.label === "string" ? v.label.trim().slice(0, 120) : "";
    if (!id || !label || seen.has(id) || seen.has(`label:${label.toLowerCase()}`)) return [];
    seen.add(id);
    seen.add(`label:${label.toLowerCase()}`);
    const type = builtin ? "text" : v?.type === "textarea" || v?.type === "select" ? v.type : "text";
    const options = type === "select" && Array.isArray(v?.options) ? [...new Set(v.options.filter((o): o is string => typeof o === "string").map((o) => o.trim().slice(0, 100)).filter(Boolean))].slice(0, 50) : [];
    if (type === "select" && !options.length) return [];
    return [{ id, label, type, required: v?.required === true, options, ...(builtin ? { builtin } : {}) }];
  });
}

export const formFieldsFrom = (raw: unknown) => parseFormFields(raw) ?? DEFAULT_FORM_FIELDS;

// One answer's rule: trimmed, capped, required when the admin says so, and one of the options for Pilihan.
export function answerSchema(field: FormField) {
  const max = maxLength(field);
  let rule = z.string().trim().max(max, `${field.label} maksimal ${max} karakter`);
  if (field.required) rule = rule.min(1, `${field.label} wajib diisi`);
  return field.type === "select" ? rule.refine((value) => !value || field.options.includes(value), `Pilih salah satu ${field.label}`) : rule;
}

// What is wrong with a list of questions the admin is about to save, or "" when it is fine.
export function formFieldsProblem(fields: FormField[]): string {
  const labels = new Set(FIXED_LABELS.map((label) => label.toLowerCase()));
  for (const [i, field] of fields.entries()) {
    const label = field.label.trim();
    if (!label) return `Pertanyaan ${i + 1} belum punya judul.`;
    if (labels.has(label.toLowerCase())) return `Judul "${label}" dipakai lebih dari sekali.`;
    labels.add(label.toLowerCase());
    if (field.type === "select" && !field.options.some((option) => option.trim())) return `"${label}" butuh minimal satu pilihan.`;
  }
  return "";
}
