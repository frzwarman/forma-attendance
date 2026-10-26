import { uploadObject } from "./rest";

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const UNSUPPORTED_FILE = "Berkas harus berupa gambar atau PDF";
export const FILE_TOO_LARGE = "Ukuran berkas maksimal 5 MB";

// Re-encodes an image through a canvas so uploads stay small on a phone connection.
export function compressImage(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Gagal memproses gambar"));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses gambar"))), "image/jpeg", quality);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar"));
    };
    image.src = url;
  });
}

export async function prepareUpload(
  file: File,
  maxSide = 1600,
): Promise<{ blob: Blob; extension: "jpg" | "pdf"; contentType: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(UNSUPPORTED_FILE);
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(FILE_TOO_LARGE);
    return { blob: file, extension: "pdf", contentType: "application/pdf" };
  }
  return { blob: await compressImage(file, maxSide), extension: "jpg", contentType: "image/jpeg" };
}

export async function uploadCheckInFile(file: File): Promise<string> {
  const { blob, extension, contentType } = await prepareUpload(file);
  const path = `checkins/${crypto.randomUUID()}.${extension}`;
  try {
    await uploadObject("guestbook-uploads", path, blob, contentType);
  } catch (cause) {
    throw new Error(`Gagal mengunggah berkas: ${(cause as Error).message}`);
  }
  return path;
}
