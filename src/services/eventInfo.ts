import { useQuery } from "@tanstack/react-query";

export type Material = { title: string; file_name: string; url: string; size: number };
export type EventInfo = { mentimeter_url: string | null; materials: Material[] };

// ponytail: mock store. The admin's changes stay in that browser's localStorage (uploaded PDFs
// inline as data URLs), so every other phone sees this sample. Move it to Supabase for real use.
export const SAMPLE_EVENT_INFO: EventInfo = {
  mentimeter_url: "https://www.menti.com/",
  materials: [
    { title: "Panduan peserta", file_name: "panduan-peserta.pdf", url: "/materi/panduan-peserta.pdf", size: 46730 },
    {
      title: "Kelas A: kecerdasan buatan untuk pengawasan pemilu",
      file_name: "materi-kecerdasan-buatan.pdf",
      url: "/materi/materi-kecerdasan-buatan.pdf",
      size: 52400,
    },
  ],
};

// A document shown as page images (rendered from its PDF by scripts/pdf-to-jpg.swift), not as a download.
export type PagedDoc = { title: string; pages: string[]; width: number; height: number };
const doc = (title: string, prefix: string, count: number, height: number): PagedDoc => ({
  title,
  pages: Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}.jpg`),
  width: 1240,
  height,
});

// Fixed in public/; not editable in the admin's Info acara tab.
export const RUNDOWN = doc("Rundown acara", "/rundown/rundown", 2, 1755);
export const SPEAKERS: PagedDoc[] = [
  doc("Dr. Agus Canny", "/narasumber/agus-canny", 9, 1605),
  doc("Muhammad Juan Al Qausar", "/narasumber/muhammad-juan-al-qausar", 7, 1605),
  doc("Nicholas Khoo", "/narasumber/nicholas-khoo", 1, 1605),
  doc("I Gede Putu Rahman Desyanta (Anta)", "/narasumber/rahman-desyanta", 4, 1754),
  doc("Indra Hardianto", "/narasumber/indra-hardianto", 2, 1754),
  doc("Verdyka Kurniawan", "/narasumber/verdyka-kurniawan", 2, 1754),
  doc("Fransiskus Paranso (Anzo)", "/narasumber/fransiskus-paranso", 2, 1754),
  doc("Karen Grace Sutoto", "/narasumber/karen-grace-sutoto", 1, 1605),
  doc("Tim Positium", "/narasumber/tim-positium", 1, 1754),
];

const KEY = "guestbook.event-info";

export function loadEventInfo(): EventInfo {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return Array.isArray(value?.materials) ? { mentimeter_url: value.mentimeter_url ?? null, materials: value.materials } : SAMPLE_EVENT_INFO;
  } catch {
    return SAMPLE_EVENT_INFO;
  }
}

// Throws when the browser's storage is full.
export function saveEventInfo(info: EventInfo): void {
  localStorage.setItem(KEY, JSON.stringify(info));
}

// Rereads on focus, so a tab left open picks up what the admin saved in another tab.
export function useEventInfo(): EventInfo {
  return useQuery({ queryKey: ["event-info"], queryFn: loadEventInfo, initialData: loadEventInfo, staleTime: 0 }).data;
}
