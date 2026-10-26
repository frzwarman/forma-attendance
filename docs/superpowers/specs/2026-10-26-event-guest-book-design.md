# Event guest book (check-in) — design

Date: 2026-10-26. Status: awaiting owner approval. Owner: Fariz. Written by Claude from the brainstorming conversation; anything marked *(my call)* was decided by Claude and can be overruled.

## Intent

Replace the current workforce-attendance prototype with what the product actually is: a **single-event guest book on the web**. Attendees open a link on their own phones, fill in one form modelled on the existing Jotform (https://form.jotform.com/241414717939059), tap **Kirim**, and their check-in lands in one central list. Admins open their own address on the same site to customise the look, watch check-ins arrive, run a lucky draw, and export the whole list to Excel or CSV. Expected volume is 400 to 4,000 check-ins for the one event.

Why now: the previous app (employee attendance, schedules, leave, HR dashboard, Android APK) solved a different, much larger problem than the one the organiser has.

## Goals

1. Anyone with the link can check in from a phone browser in under a minute, in Bahasa Indonesia, with the Jotform field set plus **Jabatan**.
2. One person is recorded once: a repeat phone number or e-mail is told they are already registered (with the earlier time) instead of creating a second row.
3. Admins, and only admins, can see the list live, search it, export it completely (Excel and CSV) and run a lucky draw that never picks the same person twice.
4. Admins customise the event name, welcome text, logo, background image, colours and WhatsApp contact without touching code; the public page and the admin pages both follow that look. Out of the box the site already looks like Bawaslu's.
5. Everything is in Bahasa Indonesia, public and admin side.

## Non-goals

- Multiple events or organisations at once. One event, one settings row. The admin can re-theme it for the next event; history is not kept.
- Attendee accounts, editing or cancelling a check-in by the attendee, e-mail or WhatsApp confirmations.
- Native iOS/Android apps or an APK. Web only.
- Captcha or IP rate limiting. A hidden honeypot field is enough until spam actually appears.
- Automated data retention or deletion schedules. Manual deletion through the Supabase dashboard is documented instead.
- Any of the former workforce features (shifts, leave, HR approvals, geofenced attendance). They are removed, not hidden.

## Anti-goals (failure even if it "works")

- The attendee list, or any uploaded file, reachable by anyone who is not a signed-in admin, including via a guessed or forwarded URL.
- Duplicate rows for the same person, or an export that is missing rows because of paging.
- Phone numbers losing their leading zero in Excel.
- A public page too heavy to load on a mid-range Android phone over 4G at a crowded venue.
- Losing the existing workforce code and its uncommitted fixes without a trace in git.

## Constraints

- Language: Bahasa Indonesia for every label, message and button, public and admin. Code and comments stay in English.
- Default look: the Bawaslu brand (Badan Pengawas Pemilihan Umum), matching https://www.bawaslu.go.id/id, with the logo and background taken from the owner-supplied key visual `KV Bawaslu-05.png`. The Nusantara assets are removed. Admin customisation starts from the Bawaslu defaults. See "Brand defaults" below.
- Backend: the Supabase project already linked from this repo (reference `dzzufvejzbhgwiemcxwz`, Singapore). Schema changes are additive migrations under `supabase/migrations/`; never destructive, never `db reset --linked`.
- Hosting: the existing static HTTPS host with SPA fallback, built by `npm run build:web` (Expo web export). HTTPS is required anyway for geolocation.
- Secrets: only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the browser. Database password, CLI token and service-role key never appear in `EXPO_PUBLIC_` variables or in the repo. `.env.local` and `.env.supabase.local` stay ignored and are never printed.
- Fields on the public form are exactly: Nama, Nomor Telepon, E-mail, Jabatan, Alamat (with map pin), Unggah Berkas (optional), Tanggal Check In, Tanggal Check Out.

## How it gets made (decided)

### Codebase and platform *(my call)*

Keep the existing Expo Router + React Native Web project for its brand components, theme provider, UI primitives, hosting setup and test tooling. Remove the workforce features entirely: screens, the mock repository, seed data, chunked native storage, domain attendance rules and their tests, and the APK/EAS configuration. Before anything is deleted, the last workforce state (commit `600b0f3`, which already contains the Android fixes) is kept on a branch named `workforce-app` and tagged, so that work stays retrievable. The guest book is then built on `main`.

The site is web only. Native-only dependencies that nothing uses afterwards (camera, location, secure store, haptics, document picker, reanimated) are removed to keep the public page light.

**Weight budget for the public page** *(my call)*: at most 500 KB of JavaScript transferred (gzipped) and at most 300 KB of images on first load, measured on the built site. Today's build ships about 800 KB of gzipped JavaScript plus a 1 MB background JPEG, so the bundled background is re-encoded to fit and admin-uploaded backgrounds are resized client-side (longest side 1920 px, JPEG) before storing. If, after the workforce code is removed, the Expo/React Native Web build still cannot meet the JavaScript budget, the public form is instead a plain HTML/JavaScript page served from the same host and only the admin panel stays in Expo. The builder measures first and reports the number before choosing.

### Data (Supabase, decided)

New additive migration, prefix `guestbook_` so nothing collides with the existing `forma_` tables, which stay untouched.

- `guestbook_settings`: exactly one row (enforced with a check on a constant id). Columns: `event_name`, `welcome_text`, `logo_path`, `background_path`, `accent_color`, `background_color`, `surface_color`, `text_color`, `whatsapp_number` (nullable), `updated_at`. Defaults reproduce the Bawaslu look with the bundled assets. Readable by everyone (the public page needs it); updatable by admins only; never inserted or deleted by clients.
- `guestbook_checkins`: `id`, `created_at` (database time), `name`, `phone` (as typed), `phone_key` (generated: digits only, a leading `62` becomes `0`), `email`, `email_key` (generated: trimmed, lower-cased), `jabatan`, `address`, `latitude`/`longitude` (nullable), `file_path` (nullable), `check_in_date`, `check_out_date` (not before check-in). Unique indexes on `phone_key` and `email_key`. Length and format checks on every text column. Clients never read, update or delete this table directly; admins read and delete through RLS; nobody inserts directly.
- `guestbook_draw_winners`: `id`, `checkin_id` (unique, references check-ins), `prize` (free label such as "Hadiah 1", may be empty), `drawn_at`, `drawn_by` (auth user). Admins only.
- `guestbook_admins`: `auth_user_id` referencing `auth.users`. A helper `guestbook_is_admin()` returns whether `auth.uid()` is in it. All admin RLS policies use this helper, so an accidentally enabled public sign-up still grants nothing.
- RPC `guestbook_check_in(...)`, security definer, executable by `anon` and `authenticated`: validates, rejects a filled honeypot, inserts, and returns either `{ status: 'created', created_at }` or `{ status: 'duplicate', created_at }` (the earlier row's time) without exposing anything else. This is the only write path for attendees.
- RPC `guestbook_draw_winner(prize)`, security definer, admin-only inside the function: atomically picks one random check-in that has not won, records it, and returns the winner. Two admins pressing Undi at once cannot pick the same person. Admins can remove a winner (delete) so a no-show prize can be redrawn.
- Storage: bucket `guestbook-brand` (public read, admin write) for logo and background; bucket `guestbook-uploads` (private) for attendee files, 10 MB limit, images and PDF only, anonymous insert into the `checkins/` folder only, admin read through short-lived signed URLs. An attendee uploads first, then calls the check-in RPC with the stored path; an orphaned upload after a failed RPC is acceptable.
- PostgREST returns at most 1,000 rows per request; every admin read and export pages through all rows until none remain, and the row count shown is the count of rows actually loaded.
- Timestamps are stored as `timestamptz` and shown in WIB (Asia/Jakarta) on the admin side and in exports.
- Database tests follow the existing PGlite harness (`tests/database/`): the real migration runs in embedded Postgres and tests cover anonymous insert-only access, duplicate detection and its response, admin-only reads, the draw never repeating a winner, and storage policy intent where PGlite allows.

### Admin access (decided)

Admins live at `/admin` on the same site. Behind it is a sign-in with e-mail and password through Supabase Auth. Admin users are created in the Supabase dashboard and added to `guestbook_admins` with a documented SQL snippet; public sign-up is disabled in the Auth settings and, independently, grants nothing because of the admins table. The session is kept by the Supabase client in browser storage, which is acceptable for this small admin panel. "Keluar" signs out.

**Provisioning** *(my call)*: the migration is pushed from this repo with the Supabase CLI (`npm run db:push` after `db:plan`). Two steps exist only in the Supabase dashboard: disabling public sign-up in Auth settings and creating the first admin user. They are written as a short owner checklist in the README, together with the SQL snippet that adds the user to `guestbook_admins`. `supabase config push` is not used, because the local `config.toml` still points Auth at localhost. If the owner authorises the Supabase connector for Claude, Claude performs the dashboard steps and reports them; otherwise the admin pages are verified against the hosted project only after the owner completes the checklist.

### Public page (decided)

Route `/`. Full-screen background image, logo, event name and welcome text from settings, then the form:

- **Nama** (required), **Nomor Telepon** (required, telephone keyboard, kept as typed), **E-mail** (required).
- **Jabatan**: free text *(my call; a dropdown is a small change if the organiser wants fixed values)*.
- **Alamat**: a text box plus a map with a draggable pin. "Gunakan lokasi saya" places the pin from the browser's geolocation. Map tiles come from OpenStreetMap through Leaflet, so no Google key or billing *(my call)*. The row stores the typed address and the pin's coordinates; coordinates are optional. No address autocomplete or geocoding is required.
- **Unggah Berkas (opsional)**: one image or PDF up to 10 MB using the browser's native file input.
- **Tanggal Check In**, **Tanggal Check Out**: native date inputs; check-out may not be earlier than check-in.
- A hidden honeypot field that must stay empty.
- Layout: the form sits in a white card on the navy key-visual background, like the website's white content on its red-accented pages; the logo pill and event name sit above the card.
- **Kirim**: disabled while sending, with inline validation messages in Bahasa. Success shows "Terima kasih, {Nama}" with a short summary of what was recorded, and a WhatsApp button linking to the organiser's number when one is set in settings.
- A duplicate phone or e-mail shows a clear message that this number or e-mail is already registered, with the earlier check-in time, and offers to fix a typo. No second row is created.

Use the browser's native inputs (`date`, `file`, `tel`, `email`, `color`) rather than custom pickers. Validation with the zod and react-hook-form dependencies already in the project.

### Admin pages (decided)

All under `/admin`, all in Bahasa, same theme as the public page.

- **Masuk**: e-mail, kata sandi, error messages in Bahasa.
- **Daftar Check-in** (default after sign-in): running total, search box matching name, phone or e-mail, rows newest first showing time (WIB), name, phone, e-mail, jabatan, check-in/out dates, a link that opens the uploaded file, and a winner badge where applicable. The list refreshes itself every few seconds while open *(my call: polling through TanStack Query, no Realtime setup)*. Two buttons: **Ekspor Excel** and **Ekspor CSV**, each downloading the complete list in one file. Excel stores phone numbers as text so leading zeros survive. CSV is UTF-8 with BOM. Both include the winner columns (prize, drawn at).
- **Undian**: a prize label field, a big **Undi** button, and a winner display large enough to project: name in very large type, jabatan, and the phone number masked except the first four and last two digits. Below it, the list of previous winners with time and prize, each removable. Attendees who have already won are never drawn again.
- **Tampilan**: event name, welcome text, WhatsApp number, logo upload, background image upload, and four colours (aksen, latar, permukaan, teks) with the Bawaslu preset as a one-tap reset. Changes are visible in a live preview of the public page before **Simpan**.

### Brand defaults (decided)

Measured from the key visual (4536 × 2552 PNG) and the website on 2026-10-26:

- Navy `#00243f` (page background behind the image; the key visual's dominant colour), Bawaslu red `#ec1c24` (accent: buttons, links, highlights, the headline red used on the website), gold `#d1aa67` (the logo's ballot-box gold and the bottom wave; used for the winner display and secondary highlights), white surfaces with near-black text `#1e1e1e` as on the website's content area.
- Default background image: the key visual, cropped to remove the top strip that contains the baked-in logo pill (keep from about 400 px down in the original), re-encoded as JPEG at 1920 px wide and under 300 KB. On portrait phones it is positioned `cover`, anchored top-left, so the glow, the dotted Indonesia map and the red-gold wave remain visible.
- Default logo: the white rounded pill with the Bawaslu mark and wordmark, cropped from the same key visual at full resolution (about x 130–830, y 130–350 in the original) and saved as a transparent PNG, so it reads on the navy background exactly as in the key visual. The website's transparent logo PNG is not used by default because the navy wordmark disappears on a navy page.
- The original key visual is kept unmodified in `assets/brand/` with the crop commands documented in `assets/brand/README.md`, the same way the Nusantara sources were documented.
- App icon and favicon are regenerated from the Bawaslu mark.

### Theme model (decided)

Four stored colours: accent, background, surface, text, defaulting to red, navy, white and near-black above. Every other token (text on accent chosen by contrast, text on the background image, borders, muted text, translucent overlays, the gold winner highlight) is derived from these four in the theme provider, so admin customisation needs no knowledge of the token set. Logo and background are URLs from the public brand bucket, falling back to the bundled Bawaslu defaults when unset. The Tampilan page offers a one-tap "Bawaslu" preset that restores all four colours and both images.

### Verification expected of the build

- Database: PGlite tests for the migration as listed above. Docker is not installed on the owner's machine, so embedded Postgres is the only local database check; the harness stubs `storage.buckets`/`storage.objects` the way it already stubs `auth.users`.
- Browser: Playwright against the built site covering check-in success, duplicate message, validation messages, admin sign-in, list and search, export file contents (phone kept as text), draw excluding past winners, and theme change reflected on the public page. Network calls to Supabase are stubbed with Playwright route handlers; do not write a second data layer just for tests. If Docker is available, `supabase start` may be used for a fuller local run.
- One manual smoke test against the hosted project on a real phone: check in, duplicate, admin export opens in Excel with phone numbers intact.
- Public page bundle size is reported after the build; the native-only dependencies are gone from `package.json`.

## Left to the builder

- Component structure, file layout under `src/`, and how much of the existing UI primitives survive.
- Exact colour derivation (contrast rules for text on accent), map default centre and zoom, winner display animation.
- Export column order and file naming, and the client-side paging mechanics.
- How settings images are cached and invalidated after an upload.
- Whether orphaned attendee uploads are cleaned up, and how.
- README rewrite: setup, creating the first admin, deploying, exporting, and the data-deletion note.

## Open questions for the owner

Raised by the builder check on 2026-10-26. The owner confirmed the strict one-person-per-phone-or-e-mail rule (question 2). Questions 1, 3 and 4 were not answered, so the build proceeds on the defaults noted under each; the owner can change them at any time.

1. Where is the site hosted and who deploys? Decides the SPA rewrite configuration for `/admin`, where `EXPO_PUBLIC_*` values are set at build time, and whether the plan ends with a deployment or with instructions. *Default (my call):* the plan ends with a verified `dist/` build and a README deploy section covering the SPA fallback for Netlify, Vercel and Cloudflare Pages; the owner deploys.
2. Must one phone number or e-mail map to exactly one person? A protocol officer registering a whole delegation under their own number would be rejected by the current rule. *Answered: yes, strict.* The unique indexes and the duplicate response stand.
3. Which Supabase plan is the project on, and what is the uploaded file for? Sets the per-file cap and whether images are compressed before upload. *Default (my call):* images are resized client-side to a longest side of 1600 px and re-encoded as JPEG (typically under 400 KB), PDFs are capped at 5 MB, so 4,000 uploads stay near 1–2 GB in the worst case; the README notes that the free plan's 1 GB may need upgrading if most attendees upload.
4. When is the event, and when must the link go out? *Default (my call):* build order is check-in form, admin list and export first; then Undian; then Tampilan; the hosted smoke test happens as soon as the owner has completed the admin checklist.
