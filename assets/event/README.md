# Event slideshow photos (placeholders)

Dummy photos for the slideshow that opens on the public page (`src/features/intro/slides.ts`).
They are free photos from Unsplash under the [Unsplash License](https://unsplash.com/license),
which allows free commercial and non-commercial use without permission or attribution.
Replace them, and the slide text, with the real event material before the event.

| File | Shows | Source |
| --- | --- | --- |
| `sesi.webp` | Audience in front of a large presentation screen | https://images.unsplash.com/photo-1505373877841-8d25f7d46678 |
| `narasumber.webp` | Microphone in front of an event audience | https://images.unsplash.com/photo-1475721027785-f74eccf877e2 |
| `jakarta.webp` | Bundaran HI and the Jakarta skyline | https://images.unsplash.com/photo-1555899434-94d1368aa7af |
| `aula.webp` | Conference hall with round tables and screens | https://images.unsplash.com/photo-1591115765373-5207764f72e7 |

Each was downloaded at 1000 × 625 (`?w=1000&h=625&fit=crop&q=65&fm=jpg`) and converted with
`cwebp -q 70`. Only the current and next slide's photo load, so opening the page stays light.
