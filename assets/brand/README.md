# Bawaslu brand assets

Source: the owner-supplied key visual `bawaslu-kv.png` (4536 × 2552, kept unmodified) and
the colours of https://www.bawaslu.go.id/id, measured on 2026-10-26.

- Navy `#00243f` (page background behind the image), Bawaslu red `#ec1c24` (accent),
  gold `#d1aa67` (logo mark and bottom wave; winner highlight), white surfaces with
  near-black `#1e1e1e` text as on the website's content area.
- `bawaslu-logo.png`: the white pill with mark and wordmark, cropped from the key visual at
  x 130, y 130, 700 × 220 px. A few navy pixels remain outside the pill's rounded corners;
  admins can upload their own logo for light backgrounds.
- `bawaslu-background.jpg`: the key visual cropped below the pill (y ≥ 400), resized to
  1600 px wide and saved as JPEG under 240 KB.
- `app-icon.png`, `adaptive-icon.png`, `favicon.png`: the ballot-box mark cropped at
  x 205, y 170, 145 × 145 px with the white pill background made transparent.

Regenerate everything with `node scripts/generate-brand-assets.cjs`. Native icon changes
need a new build; browser favicons may be cached.
