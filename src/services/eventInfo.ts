import { useQuery } from "@tanstack/react-query";

export type Room = { number: string; name: string };
export type Material = { title: string; file_name: string; url: string; size: number };
export type EventInfo = { mentimeter_url: string | null; rooms: Room[]; materials: Material[] };

// ponytail: mock store. The admin's changes stay in that browser's localStorage (uploaded PDFs
// inline as data URLs), so every other phone sees this sample. Move it to Supabase for real use.
export const SAMPLE_EVENT_INFO: EventInfo = {
  mentimeter_url: "https://www.menti.com/",
  rooms: [
    { number: "201", name: "Pleno: pembukaan, panel, dan penutupan" },
    { number: "305", name: "Kelas A: kecerdasan buatan untuk pengawasan pemilu" },
    { number: "306", name: "Kelas B: blockchain dan keamanan data pemilu" },
    { number: "307", name: "Kelas C: komunikasi, informasi, dan edukasi publik" },
  ],
  materials: [
    { title: "Panduan peserta", file_name: "panduan-peserta.pdf", url: "/materi/panduan-peserta.pdf", size: 64441 },
    { title: "Jadwal acara", file_name: "jadwal-acara.pdf", url: "/materi/jadwal-acara.pdf", size: 73332 },
    {
      title: "Kelas A: kecerdasan buatan untuk pengawasan pemilu",
      file_name: "materi-kecerdasan-buatan.pdf",
      url: "/materi/materi-kecerdasan-buatan.pdf",
      size: 53481,
    },
  ],
};

const KEY = "guestbook.event-info";

export function loadEventInfo(): EventInfo {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return Array.isArray(value?.rooms) && Array.isArray(value?.materials) ? value : SAMPLE_EVENT_INFO;
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
