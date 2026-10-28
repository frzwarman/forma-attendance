import { useQuery } from "@tanstack/react-query";

export type Material = { title: string; file_name: string; url: string; size: number };
export type EventInfo = { mentimeter_url: string | null; materials: Material[] };

// ponytail: mock store. The admin's changes stay in that browser's localStorage (uploaded PDFs
// inline as data URLs), so every other phone sees this sample. Move it to Supabase for real use.
export const SAMPLE_EVENT_INFO: EventInfo = {
  mentimeter_url: "https://www.menti.com/",
  materials: [
    { title: "Panduan peserta", file_name: "panduan-peserta.pdf", url: "/materi/panduan-peserta.pdf", size: 46730 },
    { title: "Jadwal acara", file_name: "jadwal-acara.pdf", url: "/materi/jadwal-acara.pdf", size: 67865 },
    {
      title: "Kelas A: kecerdasan buatan untuk pengawasan pemilu",
      file_name: "materi-kecerdasan-buatan.pdf",
      url: "/materi/materi-kecerdasan-buatan.pdf",
      size: 52400,
    },
  ],
};

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
