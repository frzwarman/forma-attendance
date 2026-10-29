// What attendees see after check-in, as the admin saves it in guestbook_settings.event_content.
// Files are paths: "/..." is a file built into the site, anything else is in the guestbook-event bucket.
export type StoredImage = { path: string; width: number; height: number };
export type StoredSpeaker = { name: string; pages: StoredImage[]; profile: StoredImage | null };
export type StoredMaterial = { title: string; file_name: string; path: string; size: number };
export type EventContent = {
  mentimeter_url: string | null;
  // Rundown page images; empty hides the section.
  rundown: StoredImage[];
  speakers: StoredSpeaker[];
  materials: StoredMaterial[];
};

// The same, with URLs, as the attendee page shows it.
export type Page = { src: string; width: number; height: number };
export type PagedDoc = { title: string; pages: Page[] };
// profile: the name-and-photo part of the CV for the opening popup; the first CV page when none is given.
export type Speaker = PagedDoc & { profile: Page };
export type Material = { title: string; file_name: string; url: string; size: number };
export type EventView = { mentimeter_url: string | null; rundown: PagedDoc | null; speakers: Speaker[]; materials: Material[] };

// Letters, digits, "_", "-", "." and single "/" only, so a saved path can never point at another host
// ("//host/...") or climb out of its folder ("..").
export const isSafePath = (path: unknown): path is string =>
  typeof path === "string" && path.length <= 300 && /^\/?[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(path) && !path.includes("..") && !path.includes("//");

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const size = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100_000 ? value : null);
const list = (value: unknown) => (Array.isArray(value) ? value.slice(0, 100) : []);

function image(value: unknown): StoredImage | null {
  const v = value as Partial<StoredImage> | null;
  const width = size(v?.width);
  const height = size(v?.height);
  return v && isSafePath(v.path) && width && height ? { path: v.path, width, height } : null;
}
const images = (value: unknown) => list(value).map(image).filter((page): page is StoredImage => !!page);

// Reads what the database holds; entries that are not well formed are left out. Null when nothing is saved.
export function parseEventContent(raw: unknown): EventContent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const link = text(v.mentimeter_url, 300);
  return {
    mentimeter_url: link || null,
    rundown: images(v.rundown),
    speakers: list(v.speakers).flatMap((item) => {
      const s = item as Record<string, unknown> | null;
      const pages = images(s?.pages);
      return pages.length ? [{ name: text(s?.name, 120) || "Narasumber", pages, profile: image(s?.profile) }] : [];
    }),
    materials: list(v.materials).flatMap((item) => {
      const m = item as Record<string, unknown> | null;
      const bytes = typeof m?.size === "number" && Number.isFinite(m.size) && m.size >= 0 ? m.size : 0;
      const file_name = text(m?.file_name, 200) || "materi.pdf";
      return isSafePath(m?.path) ? [{ title: text(m?.title, 200) || file_name, file_name, path: m.path, size: bytes }] : [];
    }),
  };
}

// objectUrl turns a bucket path into its public URL; files built into the site keep their own path.
export function resolveEventContent(content: EventContent, objectUrl: (path: string) => string): EventView {
  const url = (path: string) => (path.startsWith("/") ? path : objectUrl(path));
  const page = (img: StoredImage): Page => ({ src: url(img.path), width: img.width, height: img.height });
  return {
    mentimeter_url: content.mentimeter_url,
    rundown: content.rundown.length ? { title: "Rundown acara", pages: content.rundown.map(page) } : null,
    speakers: content.speakers.map((s) => ({ title: s.name, pages: s.pages.map(page), profile: page(s.profile ?? s.pages[0]) })),
    materials: content.materials.map((m) => ({
      title: m.title,
      file_name: m.file_name,
      // The download attribute is ignored across origins; Storage's ?download= names the file instead.
      url: m.path.startsWith("/") ? m.path : `${objectUrl(m.path)}?download=${encodeURIComponent(m.file_name)}`,
      size: m.size,
    })),
  };
}
