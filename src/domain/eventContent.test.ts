import assert from "node:assert/strict";
import { it } from "node:test";
import { isSafePath, parseEventContent, resolveEventContent } from "./eventContent";

const page = (path: string) => ({ path, width: 1240, height: 1754 });
const saved = {
  mentimeter_url: " https://www.menti.com/al1b2c ",
  rundown: [page("docs/r/1.jpg"), page("docs/r/2.jpg")],
  speakers: [
    { name: " Dr. Agus Canny ", pages: [page("docs/a/1.jpg")], profile: { path: "profiles/a.jpg", width: 800, height: 300 } },
    { name: "", pages: [page("/narasumber/nicholas-khoo-1.jpg")], profile: null },
  ],
  materials: [{ title: "Panduan", file_name: "panduan peserta.pdf", path: "materials/p.pdf", size: 46730 }],
};

it("reads saved content and trims it", () => {
  const content = parseEventContent(saved)!;
  assert.equal(content.mentimeter_url, "https://www.menti.com/al1b2c");
  assert.equal(content.rundown.length, 2);
  assert.deepEqual(content.speakers.map((s) => s.name), ["Dr. Agus Canny", "Narasumber"]);
  assert.equal(content.materials[0].path, "materials/p.pdf");
});

it("treats anything but an object as nothing saved", () => {
  for (const raw of [null, undefined, "x", 3, []]) assert.equal(parseEventContent(raw), null);
  assert.deepEqual(parseEventContent({}), { mentimeter_url: null, rundown: [], speakers: [], materials: [] });
});

it("drops entries whose files could point elsewhere or are malformed", () => {
  for (const path of ["//evil.example/x.jpg", "https://evil.example/x.jpg", "docs/../../x.jpg", "javascript:alert(1)", "docs//x.jpg", ""])
    assert.equal(isSafePath(path), false, path);
  for (const path of ["/rundown/rundown-1.jpg", "docs/0b1c-uuid/1.jpg", "materials/a_b.pdf"]) assert.equal(isSafePath(path), true, path);
  const content = parseEventContent({
    rundown: [page("//evil.example/1.jpg"), { path: "docs/r/1.jpg", width: -1, height: 10 }, page("docs/r/2.jpg")],
    speakers: [{ name: "Tanpa CV", pages: [] }, { name: "Profil luar", pages: [page("docs/b/1.jpg")], profile: page("https://evil.example/p.jpg") }],
    materials: [{ title: "Luar", file_name: "x.pdf", path: "https://evil.example/x.pdf", size: 1 }],
  })!;
  assert.deepEqual(content.rundown.map((p) => p.path), ["docs/r/2.jpg"]);
  assert.deepEqual(content.speakers.map((s) => [s.name, s.profile]), [["Profil luar", null]]);
  assert.deepEqual(content.materials, []);
});

it("resolves bucket paths to public URLs and keeps files built into the site", () => {
  const view = resolveEventContent(parseEventContent(saved)!, (path) => `https://x.supabase.co/storage/v1/object/public/guestbook-event/${path}`);
  assert.equal(view.rundown?.pages[1].src, "https://x.supabase.co/storage/v1/object/public/guestbook-event/docs/r/2.jpg");
  assert.equal(view.speakers[0].profile.src, "https://x.supabase.co/storage/v1/object/public/guestbook-event/profiles/a.jpg");
  // Without a profile picture the popup shows the first CV page.
  assert.deepEqual(view.speakers[1].profile, { src: "/narasumber/nicholas-khoo-1.jpg", width: 1240, height: 1754 });
  assert.equal(view.materials[0].url, "https://x.supabase.co/storage/v1/object/public/guestbook-event/materials/p.pdf?download=panduan%20peserta.pdf");
  assert.equal(resolveEventContent({ ...parseEventContent(saved)!, rundown: [] }, String).rundown, null);
});
