import type { FormField } from "../domain/formFields";
import type { Settings } from "../types/guestbook";
import { DEFAULT_SETTINGS } from "./settings";
import { getSupabase } from "./supabase";
import { compressImage } from "./uploads";

export async function updateSettings(patch: Partial<Omit<Settings, "id" | "updated_at">>): Promise<Settings> {
  const { data, error } = await getSupabase().from("guestbook_settings").update(patch).eq("id", 1).select();
  // PostgREST names a column the database does not have yet: a migration is still pending.
  const missing = /Could not find the '(\w+)' column/.exec(error?.message ?? "")?.[1];
  if (missing) throw new Error(`Database belum siap: kolom ${missing} belum ada. Jalankan migrasi terbaru (npm run db:push).`);
  if (error) throw new Error(error.message);
  // Row-level security turns a non-admin update into zero updated rows, not an error.
  const row = (data ?? [])[0] as Settings | undefined;
  if (!row) throw new Error("Tampilan tidak tersimpan: akun ini tidak memiliki izin admin.");
  return { ...DEFAULT_SETTINGS, ...row };
}

// Logos keep PNG/WebP transparency when small; everything else is re-encoded as JPEG.
export async function uploadBrandImage(kind: "logo" | "background", file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Gambar harus berupa JPG, PNG, atau WebP");
  const keep = kind === "logo" && file.type !== "image/jpeg" && file.size <= 1024 * 1024;
  const blob = keep ? file : await compressImage(file, kind === "logo" ? 1200 : 1920);
  const extension = keep ? (file.type === "image/webp" ? "webp" : "png") : "jpg";
  const path = `${kind}-${Date.now()}.${extension}`;
  const { error } = await getSupabase()
    .storage.from("guestbook-brand")
    .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
  if (error) throw new Error(`Gagal mengunggah gambar: ${error.message}`);
  return path;
}

export const saveFormFields = (fields: FormField[]) => updateSettings({ form_fields: fields });
