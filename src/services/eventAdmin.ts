import type { EventContent, StoredImage, StoredMaterial } from "../domain/eventContent";
import { EVENT_BUCKET } from "./eventInfo";
import { pdfToJpegs } from "./pdfPages";
import { updateSettings } from "./settingsAdmin";
import { getSupabase } from "./supabase";
import { compressImage } from "./uploads";

export const MAX_EVENT_PDF = 20 * 1024 * 1024;
const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

function checkPdf(file: File) {
  if (!isPdf(file)) throw new Error("Pilih berkas PDF.");
  if (file.size > MAX_EVENT_PDF) throw new Error("Ukuran PDF maksimal 20 MB.");
}

async function put(path: string, blob: Blob, contentType: string) {
  const { error } = await getSupabase().storage.from(EVENT_BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(`Gagal mengunggah berkas: ${error.message}`);
}

// A rundown or a CV: each page becomes a JPEG in its own folder, so a replaced PDF never
// overwrites pages an attendee may still be looking at.
// ponytail: replaced or removed files stay in the bucket; add a cleanup if storage ever matters.
export async function uploadPdfPages(file: File, onProgress: (message: string) => void): Promise<StoredImage[]> {
  checkPdf(file);
  onProgress("Membuka PDF…");
  const pages = await pdfToJpegs(file, (done, total) => onProgress(`Mengubah halaman ${done} dari ${total}…`));
  onProgress(`Mengunggah ${pages.length} halaman…`);
  const folder = `docs/${crypto.randomUUID()}`;
  return Promise.all(
    pages.map(async (page, i) => {
      const path = `${folder}/${i + 1}.jpg`;
      await put(path, page.blob, "image/jpeg");
      return { path, width: page.width, height: page.height };
    }),
  );
}

// The name-and-photo picture for the opening popup.
export async function uploadProfileImage(file: File): Promise<StoredImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Foto profil harus berupa JPG, PNG, atau WebP.");
  const blob = await compressImage(file, 1240);
  const bitmap = await createImageBitmap(blob);
  const image = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const path = `profiles/${crypto.randomUUID()}.jpg`;
  await put(path, blob, "image/jpeg");
  return { path, ...image };
}

export async function uploadMaterial(file: File): Promise<StoredMaterial> {
  checkPdf(file);
  const path = `materials/${crypto.randomUUID()}.pdf`;
  await put(path, file, "application/pdf");
  return { title: file.name.replace(/\.pdf$/i, ""), file_name: file.name, path, size: file.size };
}

export const saveEventContent = (content: EventContent) => updateSettings({ event_content: content });
