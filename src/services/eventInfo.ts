import { parseEventContent, resolveEventContent, type EventContent, type EventView, type StoredImage } from "../domain/eventContent";
import { publicObjectUrl } from "./rest";
import { useSettings } from "./settings";

export const EVENT_BUCKET = "guestbook-event";

// Page images rendered by scripts/pdf-to-jpg.swift, all 1240 px wide.
const pages = (prefix: string, count: number, height: number): StoredImage[] =>
  Array.from({ length: count }, (_, i) => ({ path: `${prefix}-${i + 1}.jpg`, width: 1240, height }));
// The name-and-photo part of a CV's first page, cropped by hand to <prefix>-profil.jpg
// (ffmpeg -i <prefix>-1.jpg -vf crop=w:h:x:y -q:v 4 <prefix>-profil.jpg).
const speaker = (name: string, prefix: string, count: number, height: number, profile?: [number, number]) => ({
  name,
  pages: pages(prefix, count, height),
  profile: profile ? { path: `${prefix}-profil.jpg`, width: profile[0], height: profile[1] } : null,
});

// Shown until an admin saves Info acara, and what "Pakai data contoh" restores. The files are in public/.
export const BUILT_IN_CONTENT: EventContent = {
  mentimeter_url: "https://www.menti.com/",
  rundown: pages("/rundown/rundown", 2, 1755),
  speakers: [
    speaker("Dr. Agus Canny", "/narasumber/agus-canny", 9, 1605, [820, 310]),
    speaker("Muhammad Juan Al Qausar", "/narasumber/muhammad-juan-al-qausar", 7, 1605, [960, 590]),
    speaker("Nicholas Khoo", "/narasumber/nicholas-khoo", 1, 1605, [1240, 300]),
    speaker("I Gede Putu Rahman Desyanta (Anta)", "/narasumber/rahman-desyanta", 4, 1754, [524, 1000]),
    speaker("Indra Hardianto", "/narasumber/indra-hardianto", 2, 1754, [1240, 220]),
    speaker("Verdyka Kurniawan", "/narasumber/verdyka-kurniawan", 2, 1754, [1060, 140]),
    speaker("Fransiskus Paranso (Anzo)", "/narasumber/fransiskus-paranso", 2, 1754, [1240, 520]),
    speaker("Karen Grace Sutoto", "/narasumber/karen-grace-sutoto", 1, 1605, [1240, 232]),
    // A one-page team introduction: every part of it is names and photos, so the whole page is the profile.
    speaker("Tim Positium", "/narasumber/tim-positium", 1, 1754),
  ],
  materials: [
    { title: "Panduan peserta", file_name: "panduan-peserta.pdf", path: "/materi/panduan-peserta.pdf", size: 46730 },
    {
      title: "Kelas A: kecerdasan buatan untuk pengawasan pemilu",
      file_name: "materi-kecerdasan-buatan.pdf",
      path: "/materi/materi-kecerdasan-buatan.pdf",
      size: 52400,
    },
  ],
};

export const eventObjectUrl = (path: string) => publicObjectUrl(EVENT_BUCKET, path);

// The saved event information, or the built-in one when nothing is saved yet (or before migration
// 20261030000000_guestbook_event_content.sql, or when settings fail to load).
export function storedEventContent(raw: unknown): EventContent {
  return parseEventContent(raw) ?? BUILT_IN_CONTENT;
}

// Null while the settings load, so the opening popup does not show the built-in speakers first.
// After one failed attempt it uses the built-in content rather than wait for the retries.
export function useEventContent(): EventView | null {
  const { settings, ready, failureCount } = useSettings();
  if (!ready && !failureCount) return null;
  return resolveEventContent(storedEventContent(settings.event_content), eventObjectUrl);
}
