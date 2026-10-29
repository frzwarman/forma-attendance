// Renders every page of a PDF to a JPEG in the admin's browser, the same size and quality as
// scripts/pdf-to-jpg.swift. pdf.js loads on first use, so only an admin picking a PDF downloads it.
export type PageImage = { blob: Blob; width: number; height: number };

export const PAGE_WIDTH = 1240;

export async function pdfToJpegs(file: File, onPage?: (done: number, total: number) => void): Promise<PageImage[]> {
  const pdfjs = await import("pdfjs-dist");
  // No worker file to host: pdf.js runs its worker code on this page instead (globalThis.pdfjsWorker).
  // @ts-expect-error the worker build ships without type declarations
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const pages: PageImage[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: PAGE_WIDTH / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_WIDTH;
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (!blob) throw new Error(`Halaman ${n} gagal diubah menjadi gambar.`);
      pages.push({ blob, width: canvas.width, height: canvas.height });
      onPage?.(n, pdf.numPages);
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
