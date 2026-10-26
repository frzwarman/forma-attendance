# Bawaslu brand assets

Source: the owner-supplied key visual `bawaslu-kv.png` (4536 × 2552, kept unmodified) and
the colours of https://www.bawaslu.go.id/id, measured on 2026-10-26.

- Navy `#00243f` (page background behind the image), Bawaslu red `#ec1c24` (accent),
  gold `#d1aa67` (logo mark and bottom wave; winner highlight), white surfaces with
  near-black `#1e1e1e` text as on the website's content area.
- `bawaslu-logo-source.png`: the official transparent logo from https://www.bawaslu.go.id (2698 × 720), kept as supplied. `bawaslu-logo.png` is the same logo resized to 1200 px wide; the app places it on a white capsule wherever the ground is dark.
- `bawaslu-background.jpg`: the key visual cropped below the pill (y ≥ 400), resized to
  1600 px wide and saved as JPEG under 240 KB.
- `app-icon.png`, `adaptive-icon.png`, `favicon.png`: the ballot-box mark cropped from the transparent logo (x 0, y 0, 560 × 720 px).

Regenerate everything with `node scripts/generate-brand-assets.cjs`. Interface icons are inline SVG generated from lucide's data by `node scripts/generate-icons.cjs` (`src/components/icons.tsx`), so no icon package ships to the browser. Native icon changes
need a new build; browser favicons may be cached.
