# Bawaslu brand assets

Source: the owner-supplied key visual `bawaslu-kv.png` (4536 × 2552, kept unmodified) and
the colours of https://www.bawaslu.go.id/id, measured on 2026-10-26.

- Navy `#00243f` (page background behind the image), Bawaslu red `#ec1c24` (accent),
  gold `#d1aa67` (logo mark and bottom wave; winner highlight), white surfaces with
  near-black `#1e1e1e` text as on the website's content area.
- `bawaslu-logo-source.png`: the official transparent logo from https://www.bawaslu.go.id (2698 × 720), kept as supplied. `bawaslu-logo.png` is the same logo resized to 800 px wide; the app places it on a white capsule wherever the ground is dark.
- `bawaslu-background.jpg`: KV Bawaslu-05 below the logo pill and left of the network sphere
  (x 0–2880, y 400–2552), resized to 1400 px wide and saved as JPEG under 120 KB.
- `bawaslu-sphere-source.png`: the network sphere cropped from KV Bawaslu-01 (x 10553–13833,
  y 69–3495 of 13833 × 4819), where it stands clear of the dotted map, resized to 1000 px.
  `bawaslu-sphere.webp` is that crop at 480 px with the navy background keyed out to
  transparency (colour to alpha); the app shows it beside the logo on a soft navy halo.
- `app-icon.png`, `adaptive-icon.png`, `favicon.png`: the ballot-box mark cropped from the transparent logo (x 0, y 0, 560 × 720 px).

Regenerate everything with `node scripts/generate-brand-assets.cjs` (needs `cwebp`: `brew install webp`). Interface icons are inline SVG generated from lucide's data by `node scripts/generate-icons.cjs` (`src/components/icons.tsx`), so no icon package ships to the browser. Native icon changes
need a new build; browser favicons may be cached.
