# Buku Tamu — event check-in (Bawaslu)

A one-event guest book on the web, in Bahasa Indonesia. Attendees open the link on their own phone and an event slideshow opens first (once per browser session). They fill in one form (Nama, Nomor Telepon and E-mail, then the questions the admins set up in *Formulir*, by default Divisi, and an optional photo taken with the camera or a chosen image/PDF) and tap **Kirim**. The server records the check-in time, shown in WIB, and a thank-you popup confirms it; closing the popup shows the event information on the page with an *Anda sudah check-in* card above it, and below it a *Ikut polling di Mentimeter* button the event rundown as page images shown one at a time (swipe or the arrows for the next and previous page), downloadable PDF materials, and the speakers, each opening their CV as page images in a popup. Admins edit all of it in *Info acara* (see the admin guide); until they save, the page shows the rundown and CVs built into the site (`BUILT_IN_CONTENT` in `src/services/eventInfo.ts`, JPEGs in `public/rundown/` and `public/narasumber/` made with `swift scripts/pdf-to-jpg.swift file.pdf public/narasumber/name` on macOS). The event has two sessions a day and attendees no longer check out: at each session they check in again, and someone whose phone number or e-mail is already registered is welcomed without a second row; their row records the latest check-in and how many there were. A *Hubungi panitia* WhatsApp button stays in the bottom-right corner when an organiser number is set. The opening slideshow shows the speakers first, one per slide with only the name-and-photo part of their CV (a hand-made crop of page 1, `public/narasumber/<name>-profil.jpg`, sized in `SPEAKERS`), and ends with a recreation of the KV Bawaslu-01 title card, whose text is in `src/features/intro/slides.ts`; after check-in the page shows that title card alone. Admins sign in at `/admin` to watch check-ins arrive, search them, export the full list to Excel or CSV, run a lucky draw, and change the event name, texts, logo, background and colours. The default look is Bawaslu's, measured from the supplied key visual and https://www.bawaslu.go.id/id (see `assets/brand/README.md`).

Built with Expo Router on React Native Web (web only), TanStack Query, react-hook-form + zod, SheetJS for Excel, and Supabase (Postgres, Auth, Storage).

The interface uses Plus Jakarta Sans (loaded from Google Fonts with system fallbacks), the official Bawaslu logo on a white capsule over the navy key visual, a navy sidebar for the admin area, and inline SVG icons generated from lucide (`scripts/generate-icons.cjs`), so no icon library ships to the browser.

The previous workforce-attendance prototype is preserved on the `workforce-app` branch and the `workforce-app-final` tag.

## Run locally

First time on this project? Follow [GETTING_STARTED.md](GETTING_STARTED.md) for installing, connecting Supabase, creating the first admin and deploying.

Use Node 24 LTS (24.3+) or 22.13+.

```sh
npm ci
cp .env.example .env.local   # fill in both values from Supabase → Project Settings → API
npm run web
```

`.env.local` holds only the project URL and the publishable key; both are public client values and are embedded at build time. Never put the database password, CLI token, secret key or service-role key in an `EXPO_PUBLIC_` variable. Keep private CLI credentials in `supabase/.env.cli.local`, not in a root `.env.*` file: Expo's development server bundles every root file that starts with `.env` and only understands the standard names, so a file such as `.env.supabase.local` breaks `npm run web` with a 500 on the entry bundle.

```sh
npm run typecheck
npm run lint
npm test           # domain unit tests (theme, phone, time, validation, export)
npm run db:test    # the real migrations in embedded Postgres (RLS, RPCs, storage policies)
npm run build:web  # production build into dist/
npm run weight     # public page weight gate (needs the dist/ build)
```

## Supabase setup

The app uses the `guestbook_` tables, RPCs and buckets created by `supabase/migrations/20261026000000_guestbook.sql` `20261026120000_guestbook_optional_jabatan.sql` (Jabatan is no longer collected; the column became optional and existing values are kept) `20261026180000_guestbook_automatic_checkin.sql` (visit dates are no longer asked for; check-in rows get today's Jakarta date) `20261026200000_guestbook_checkout.sql` (check-out time, the hashed check-out code, and the attendee and admin check-out functions) and `20261028000000_guestbook_room_number_optional_address.sql` (the optional hotel room number, and the address becomes optional because the form no longer asks for an address or map pin; until it is applied, check-ins still work, without the room number and with `-` as the address) and `20261029000000_guestbook_divisi.sql` (the division; required on the form, optional in the database so older clients keep working; until it is applied, check-ins go through without the division or room number) and `20261030000000_guestbook_event_content.sql` (the `event_content` column and the public `guestbook-event` bucket for *Info acara*; until it is applied, attendees see the built-in rundown and CVs and saving in *Info acara* says which migration to run) and `20261031000000_guestbook_form_fields.sql` (the `form_fields` setting, the `answers` column and `p_answers` on the check-in RPC; until it is applied the form shows Divisi, saving in *Formulir* says to run the migration, and check-ins go through without answers) and `20261101000000_guestbook_repeat_checkin.sql` (`last_checked_in_at` and `checkin_count`; a repeat check-in is welcomed and recorded on the person's row instead of reported as a duplicate; until it is applied, a repeat check-in is welcomed but not recorded) in the linked project `dzzufvejzbhgwiemcxwz`. Migrations are additive; never run `db reset --linked`. Apply pending migrations before deploying a client that depends on them.

```sh
set -a; . ./supabase/.env.cli.local; set +a   # exports SUPABASE_DB_PASSWORD for the CLI without printing it
npm run db:plan    # dry run
npm run db:push
npm run db:status
```

What the migrations enforce: attendees can only call `guestbook_check_in` and `guestbook_check_out` (with the code their phone received; only a SHA-256 hash of it is stored, and repeating it is harmless) (validation, honeypot, one row per normalised phone number and per e-mail: a repeat check-in updates that row's latest check-in and count, fills in only answers it lacked, clears its check-out, and returns no check-out code) and upload into `guestbook-uploads/checkins/`; only users listed in `guestbook_admins` can read check-ins, draw winners, update settings or read uploads. Settings are public so the page can render the theme.

**Owner checklist (Supabase dashboard, once):**

1. Authentication → Providers → Email: turn off *Allow new users to sign up*. (Even if left on, a self-registered user gets nothing: admin rights come only from the table below.)
2. Authentication → Users → *Add user* with the admin's e-mail and password.
3. SQL editor, with the admin's e-mail:

   ```sql
   insert into public.guestbook_admins (auth_user_id)
   select id from auth.users where lower(email) = lower('admin@example.com')
   on conflict do nothing
   returning auth_user_id;
   ```

   The result must show one row. If it shows none, the e-mail does not match an existing Auth user. To see who has admin rights:

   ```sql
   select u.email, a.auth_user_id is not null as admin
   from auth.users u left join public.guestbook_admins a on a.auth_user_id = u.id;
   ```

   An account that signs in without this grant sees "Akun ini belum menjadi admin" at `/admin`.

Repeat 2–3 for each admin. The two buckets (`guestbook-brand`, public; `guestbook-uploads`, private, 5 MB per file) are created by the migration.

## Deploy

```sh
npm run build:web
```

Publish `dist/` to any HTTPS static host (HTTPS is required for the camera). Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` wherever the build runs. The site is a single-page app, so `/admin` and its sub-pages need a fallback to `index.html`:

- Cloudflare Workers (the current deployment, `forma-attendance`): `wrangler.jsonc` in this repo serves `dist/` with `not_found_handling: "single-page-application"`. In Workers Builds use build command `npm run build` and deploy command `npx wrangler deploy`, and add the `EXPO_PUBLIC_` values under the build's variables, because they are embedded at build time.
- Netlify or Cloudflare Pages: a `_redirects` file in `dist/` containing `/*    /index.html   200`
- Vercel: `vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Firebase Hosting: `"rewrites": [{ "source": "**", "destination": "/index.html" }]`

Share the public link (or a QR code of it) with attendees; keep `/admin` for the organisers.

## Admin guide

- **Daftar Check-in** (`/admin`): running total, search by name, phone, e-mail or hotel room, newest first, a *Kamar* column with each attendee's hotel room, refreshed every 10 seconds. *Lihat berkas* opens an attendee's upload through a short-lived signed link. The list pages through PostgREST in blocks of 1,000, so a 4,000-row event loads completely.
- **Check-out**: the Check-out column shows when each attendee left. *Check out* records it now for someone who cannot use their phone, *Batalkan* undoes a mistake, and *Check out semua* (with a confirmation) closes everyone still present at the end of the event. The *Sudah check-out* tile shows how many have left and how many are still present.
- **Ekspor Excel / Ekspor CSV**: one file with every check-in (WIB first and latest check-in times, the number of check-ins, the check-out time, all fields, prize and draw time). Use the Excel export for Excel: it keeps phone numbers as text, whereas a CSV opened by double-click drops leading zeros. The CSV is UTF-8 with a BOM, and attendee text that looks like a formula is prefixed with an apostrophe.
- **Undian**: type a prize name, press *Undi*. The database picks one attendee who has not won yet, atomically, and shows the name large with the phone masked (`0812******22`). Previous winners are listed; *Hapus* releases a no-show so the prize can be redrawn.
- **Formulir** (`/admin/formulir`): the questions on the check-in form after Nama, Nomor Telepon and E-mail (those three are fixed: they recognise someone checking in again, and the draw lists each person once). Admins add questions (Teks singkat, Teks panjang, or Pilihan with one option per line), make them required, rename, reorder and remove them, saved in `guestbook_settings.form_fields`; *Pakai formulir bawaan* restores the default (Divisi); *Kembalikan Nomor Kamar Hotel* adds the hotel room question back. Divisi and the room keep their own columns; other answers are stored in `guestbook_checkins.answers` under the question's label, shown under each attendee in the list, searchable, and exported as one column per question after Nomor Kamar Hotel. Answers to a question removed or renamed later stay in the database and the export.
- **Info acara** (`/admin/acara`): the Mentimeter participation link (only `https://` links on menti.com or mentimeter.com), the rundown, the speakers and the PDF materials, saved in `guestbook_settings.event_content` and shown on every phone the next time the page opens. A rundown or CV is uploaded as a PDF (up to 20 MB) and the admin's browser turns each page into a 1240 px JPEG with pdf.js (loaded only on this tab, never on the attendee page) before uploading it to the public `guestbook-event` bucket. Each speaker can also get a profile picture (the name-and-photo part shown in the opening popup; without one the popup shows the first CV page). Speakers and materials can be renamed, reordered and removed; *Pakai data contoh* brings back the built-in content. Replaced or removed files stay in the bucket. Two admins saving at once: the last save wins.
- **Tampilan**: event name, welcome text, organiser WhatsApp number (shows the *Hubungi panitia* WhatsApp button in the bottom-right corner of the public page), logo, background image and four colours (accent, background, surface, text), with a live preview and a one-tap Bawaslu preset. Uploaded images are resized in the browser (logo 1200 px, background 1920 px).

## Demo data

To show the admin list and the exports with realistic content, run `supabase/seed/demo-checkins.sql` in the Supabase SQL editor: 48 fictional attendees over roughly the last 30 hours, about half checked out, hotel room numbers for the 36 from outside Jakarta, and three lucky-draw winners. It needs every migration applied first. Demo rows added by an older version of the seed have no room numbers: run the removal script, then the seed again. All of them use `@example.com` e-mails, a reserved domain no real attendee has, and `supabase/seed/remove-demo-checkins.sql` deletes exactly those rows (and their draw wins) before the real event. Running the seed twice adds nothing.

`npm run demo:export` builds the same data in embedded Postgres and writes sample exports to `artifacts/contoh-ekspor-check-in.xlsx` and `artifacts/contoh-ekspor-check-in.csv` using the admin page's export code.

## Data and privacy

Exports contain personal data; store and share them accordingly. After the event, delete the data from the Supabase SQL editor and empty the `guestbook-uploads` bucket in Storage:

```sql
delete from public.guestbook_draw_winners;
delete from public.guestbook_checkins;
```

Attendee images are compressed to a 1600 px JPEG before upload and PDFs are capped at 5 MB, so 4,000 uploads stay around 1–2 GB. The free Supabase plan includes 1 GB of storage; upgrade if most attendees are expected to upload.

## Verification

Checked in this workspace on 2026-10-28 (after the hotel room number):

- TypeScript and ESLint: clean.
- `npm test`: **18 unit tests** pass (theme derivation and contrast, phone normalisation/masking/WhatsApp links, WIB formatting, check-in validation messages incl. the optional room number, CSV/Excel export incl. the room column and text phone cells, formula neutralisation and file naming, file sizes, Mentimeter link checks).
- `npm run db:test`: **22 tests** pass against the real migrations in embedded Postgres: RLS and grants, phone-key normalisation, anonymous check-in and duplicate reporting, input rejection, admin-only reads and settings updates, draws that never repeat a winner, storage policies, optional Jabatan (old clients that still send one keep working), check-ins without dates stamped with today's Jakarta date, check-out (one use per code, unknown codes refused, admin-only per-row, undo and close-all), the hotel room number (optional, trimmed, at most 20 characters, older clients that do not send it), and the demo seed (48 rows, check-outs, 36 hotel rooms, three winners, repeatable and removable).
- `npm run test:e2e:dev`: the public page renders on the Expo development server with no 5xx bundle responses.
- `npm run test:e2e`: **47 browser tests** pass against the built site with every Supabase endpoint stubbed by Playwright routes: public page and defaults, check-in success/duplicate/validation/honeypot with no Lokasi section, compressed upload (unsupported files refused), camera capture with retake and a denied-camera message, the event slideshow (first visit, arrows and dots, Escape, Mulai check-in, not shown again on reload), the network sphere beside the logo, an account without admin rights being told so, a refused settings save, the draw waiting for the first check-in, the thank-you popup followed by the event information page, the WhatsApp corner button staying put while scrolling, the hotel room number (saved, shown in the popup, listed and searchable for admins, left out of the request when empty, and check-ins with and without a room number still accepted by a database without the migration), the Mentimeter link and a PDF download after check-in, the mock *Info acara* tab (link check, a PDF over 1 MB refused, an uploaded PDF downloadable on the attendee page, the sample restored), one-tap check-out on the same phone (no slideshow for returning attendees, an unknown code), admin check-out with undo and a confirmed check-out of everyone, page scrolling with the wheel, 16px inputs, admin sign-in and reload, paged list with exactly 2,000 rows and a row arriving between pages, search, signed file links, CSV and Excel downloads, the lucky draw, theme changes reflected on the public page, the Bawaslu preset and logo upload, plus reference screenshots in `artifacts/`.
- `npm run weight`: a first visit to the public page, with the slideshow open, downloads **441 KB** of gzipped JavaScript and **263 KB** of images (budget 500 KB and 300 KB).
- The public form, date and check-in tests also pass in WebKit (Safari's engine) with iPhone 13 emulation; this is not a test on a real iPhone.
- `wrangler dev` with `wrangler.jsonc` serves `/admin`, `/admin/undian` and `/admin/tampilan` as the app (HTTP 200) and still serves assets.

To repeat the browser suite:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://stub.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run build:web
npm run test:e2e      # set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an installed Chrome if Playwright's Chromium is missing
npm run test:e2e:dev  # the same public page served by the Expo development server (Metro dev bundling)
```

Not yet verified: a real check-in on a phone against the hosted project, and the admin pages against the hosted project (they need the owner checklist above first). Do that smoke test before the event: check in, repeat the same phone number, sign in, export, and open the Excel file.

## Limitations

- One event at a time; re-theming replaces the previous look, history is not kept.
- Spam protection is a hidden honeypot only; add a captcha if abuse appears.
- Attendee uploads that fail before the check-in RPC are left in the bucket; clear them with the post-event cleanup.
- *Ambil foto* needs HTTPS and camera permission; when the camera is denied or missing the form explains it and *Pilih berkas* still works.
- `npm audit` reports advisories in `node-forge`, used only by Expo's build tooling.
