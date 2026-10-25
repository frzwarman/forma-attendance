# Nusantara reference assets

Original assets supplied through the user-provided reference:
https://form.jotform.com/241414717939059

- `nusantara-logo.png`: original transparent Nusantara vertical logo, 1694 × 1035.
  Source: https://www.jotform.com/uploads/ipungstr/form_files/01%20Nusantara-08-VerticalColor.6654f443542df6.74848471.png
- `nusantara-background.jpg`: original aerial background with gold line motifs, 1920 × 1080.
  Source: https://www.jotform.com/uploads/ipungstr/form_files/BG-01.jpg

Measured reference styling: gold `#DBAF6D`, Arial typography, 6px field corners,
1px gold field borders, and input background `rgba(29, 27, 26, 0.54)`.
The PNG logo and JPG background are preserved as supplied, without redrawing them.

## Application icons

The icons use the original logo's gold emblem, cropped above the wordmark so it
remains legible at small sizes. Regenerate them with
`node scripts/generate-brand-icons.cjs` after installing dependencies.

- `app-icon.png`: opaque 1024 × 1024 charcoal square for iOS and legacy Android.
- `adaptive-icon.png`: transparent 1024 × 1024 foreground with Android safe-zone
  padding, paired with the charcoal background configured in `app.json`.
- `favicon.png`: 64 × 64 browser icon; Expo exports it as `favicon.ico` for web.

Native icon changes require a new app build; browser favicons may be cached.
