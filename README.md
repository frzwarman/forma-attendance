# Buku Tamu — event check-in (Bawaslu)

A one-event guest book on the web, in Bahasa Indonesia. Attendees open the link on their own phone, fill in one form (Nama, Nomor Telepon, E-mail, Jabatan, Alamat with a map pin, an optional file, Tanggal Check In/Check Out) and tap **Kirim**. Admins sign in at `/admin` to watch check-ins arrive, search them, export the full list to Excel or CSV, run a lucky draw, and change the event name, texts, logo, background and colours. The default look is Bawaslu's, measured from the supplied key visual and https://www.bawaslu.go.id/id (see `assets/brand/README.md`).

Built with Expo Router on React Native Web (web only), TanStack Query, react-hook-form + zod, Leaflet with OpenStreetMap tiles, SheetJS for Excel, and Supabase (Postgres, Auth, Storage).

The previous workforce-attendance prototype is preserved on the `workforce-app` branch and the `workforce-app-final` tag.

## Run locally

Use Node 24 LTS (24.3+) or 22.13+.

```sh
npm ci
cp .env.example .env.local   # fill in both values from Supabase → Project Settings → API
npm run web
```

`.env.local` holds only the project URL and the publishable key; both are public client values and are embedded at build time. Never put the database password, CLI token, secret key or service-role key in an `EXPO_PUBLIC_` variable.

```sh
npm run typecheck
npm run lint
npm test           # domain unit tests (theme, phone, time, validation, export)
npm run db:test    # the real migrations in embedded Postgres (RLS, RPCs, storage policies)
npm run build:web  # production build into dist/
npm run weight     # public page weight gate (needs the dist/ build)
```

## Supabase setup

The app uses the `guestbook_` tables, RPCs and buckets created by `supabase/migrations/20261026000000_guestbook.sql` in the linked project `dzzufvejzbhgwiemcxwz`. Migrations are additive; never run `db reset --linked`.

```sh
npm run db:plan    # dry run (loads SUPABASE_DB_PASSWORD from .env.supabase.local, see supabase/README.md)
npm run db:push
npm run db:status
```

What the migration enforces: attendees can only call `guestbook_check_in` (validation, honeypot, one row per normalised phone number and per e-mail, duplicate reports with the earlier time) and upload into `guestbook-uploads/checkins/`; only users listed in `guestbook_admins` can read check-ins, draw winners, update settings or read uploads. Settings are public so the page can render the theme.

**Owner checklist (Supabase dashboard, once):**

1. Authentication → Providers → Email: turn off *Allow new users to sign up*. (Even if left on, a self-registered user gets nothing: admin rights come only from the table below.)
2. Authentication → Users → *Add user* with the admin's e-mail and password.
3. SQL editor, with the admin's e-mail:

   ```sql
   insert into public.guestbook_admins (auth_user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

Repeat 2–3 for each admin. The two buckets (`guestbook-brand`, public; `guestbook-uploads`, private, 5 MB per file) are created by the migration.

## Deploy

```sh
npm run build:web
```

Publish `dist/` to any HTTPS static host (HTTPS is required for the map's geolocation). Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` wherever the build runs. The site is a single-page app, so `/admin` and its sub-pages need a fallback to `index.html`:

- Netlify or Cloudflare Pages: a `_redirects` file in `dist/` containing `/*    /index.html   200`
- Vercel: `vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Firebase Hosting: `"rewrites": [{ "source": "**", "destination": "/index.html" }]`

Share the public link (or a QR code of it) with attendees; keep `/admin` for the organisers.

## Admin guide

- **Daftar Check-in** (`/admin`): running total, search by name, phone or e-mail, newest first, refreshed every 10 seconds. *Lihat berkas* opens an attendee's upload through a short-lived signed link. The list pages through PostgREST in blocks of 1,000, so a 4,000-row event loads completely.
- **Ekspor Excel / Ekspor CSV**: one file with every check-in (WIB times, all fields, prize and draw time). Excel keeps phone numbers as text so leading zeros survive; CSV is UTF-8 with a BOM.
- **Undian**: type a prize name, press *Undi*. The database picks one attendee who has not won yet, atomically, and shows the name large with the phone masked (`0812******22`). Previous winners are listed; *Hapus* releases a no-show so the prize can be redrawn.
- **Tampilan**: event name, welcome text, organiser WhatsApp number (shows a *Hubungi Panitia via WhatsApp* button after check-in), logo, background image and four colours (accent, background, surface, text), with a live preview and a one-tap Bawaslu preset. Uploaded images are resized in the browser (logo 1200 px, background 1920 px).

## Data and privacy

Exports contain personal data; store and share them accordingly. After the event, delete the data from the Supabase SQL editor and empty the `guestbook-uploads` bucket in Storage:

```sql
delete from public.guestbook_draw_winners;
delete from public.guestbook_checkins;
```

Attendee images are compressed to a 1600 px JPEG before upload and PDFs are capped at 5 MB, so 4,000 uploads stay around 1–2 GB. The free Supabase plan includes 1 GB of storage; upgrade if most attendees are expected to upload.

## Verification

Checked in this workspace on 2026-10-26:

- TypeScript and ESLint: clean.
- `npm test`: **14 unit tests** pass (theme derivation and contrast, phone normalisation/masking/WhatsApp links, WIB formatting, check-in validation messages, CSV/Excel export incl. text phone cells and file naming).
- `npm run db:test`: **16 tests** pass against the real migrations in embedded Postgres: RLS and grants, phone-key normalisation, anonymous check-in and duplicate reporting, input rejection, admin-only reads and settings updates, draws that never repeat a winner, and storage policies.
- `npm run test:e2e`: **18 browser tests** pass against the built site with every Supabase endpoint stubbed by Playwright routes: public page and defaults, check-in success/duplicate/validation/honeypot, map pin and compressed upload (unsupported files refused), admin sign-in and reload, paged list with exactly 2,000 rows, search, signed file links, CSV and Excel downloads, the lucky draw, theme changes reflected on the public page, the Bawaslu preset and logo upload, plus reference screenshots in `artifacts/`.
- `npm run weight`: the public page downloads **473 KB** of gzipped JavaScript and **135 KB** of images on first load (budget 500 KB and 300 KB).

To repeat the browser suite:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://stub.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run build:web
npm run test:e2e      # set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an installed Chrome if Playwright's Chromium is missing
```

Not yet verified: a real check-in on a phone against the hosted project, and the admin pages against the hosted project (they need the owner checklist above first). Do that smoke test before the event: check in, repeat the same phone number, sign in, export, and open the Excel file.

## Limitations

- One event at a time; re-theming replaces the previous look, history is not kept.
- Spam protection is a hidden honeypot only; add a captcha if abuse appears.
- OpenStreetMap's public tile servers are meant for light use; for a very large audience switch the tile URL in `src/features/checkin/MapPicker.tsx` to a provider with an API key.
- Attendee uploads that fail before the check-in RPC are left in the bucket; clear them with the post-event cleanup.
- `npm audit` reports advisories in `node-forge`, used only by Expo's build tooling.
