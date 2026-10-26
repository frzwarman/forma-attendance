# Event Guest Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workforce-attendance prototype with a one-event, Bahasa Indonesia guest book: a public check-in form on `/`, and an admin area on `/admin` with a live list, Excel/CSV export, a lucky draw and theme customisation, backed by Supabase.

**Architecture:** The existing Expo Router + React Native Web project is stripped to its UI primitives and rebuilt around two route groups. All data lives in new `guestbook_` tables in the linked Supabase project; attendees write only through a security-definer RPC, admins read through RLS gated by a `guestbook_admins` table, and files go to two Storage buckets. Browser tests stub every Supabase endpoint with Playwright routes; database rules are tested against the real migration in embedded Postgres (PGlite).

**Tech Stack:** Expo SDK 58 (web only), Expo Router, React 19, React Native Web, TanStack Query, react-hook-form + zod, `@supabase/supabase-js` v2, Leaflet + OpenStreetMap tiles, SheetJS (`xlsx` 0.20.3 from the SheetJS CDN tarball), Playwright, PGlite, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-10-26-event-guest-book-design.md`

## Global Constraints

- Every user-facing string, public and admin, is Bahasa Indonesia. Code, comments and commit messages are English.
- Public form fields, in order: Nama, Nomor Telepon, E-mail, Jabatan, Alamat (text + map pin), Unggah Berkas (opsional), Tanggal Check In, Tanggal Check Out, plus a hidden honeypot. Submit button: **Kirim**.
- Default colours: accent `#ec1c24`, background `#00243f`, surface `#ffffff`, text `#1e1e1e`; gold `#d1aa67` for the winner display. Default images are cropped from `assets/brand/bawaslu-kv.png` (the owner's `KV Bawaslu-05.png`, 4536 × 2552).
- Supabase project `dzzufvejzbhgwiemcxwz`. Only additive migrations under `supabase/migrations/`; never `db reset --linked`; `forma_` tables stay untouched. Everything new is prefixed `guestbook_`.
- Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the browser. Never print or commit `.env.local` or `.env.supabase.local`.
- Strict duplicates: one row per normalised phone (`phone_key`) and per lower-cased e-mail (`email_key`); the attendee is told the earlier check-in time.
- Uploads: images resized client-side to a longest side of 1600 px and re-encoded as JPEG; PDFs at most 5 MB; both buckets limited to 5 MB per object.
- PostgREST returns at most 1,000 rows per request; every admin read pages until a page is short.
- Timestamps are `timestamptz`; the admin UI and exports show WIB (`Asia/Jakarta`) as `dd/MM/yyyy HH:mm`.
- Public page weight: at most 500 KB gzipped JavaScript and 300 KB of images on first load, measured by `npm run weight` on the built site.
- The last workforce state, commit `600b0f3`, is kept as branch `workforce-app` and tag `workforce-app-final` before anything is deleted.
- Git: one commit per task, message prefixed `feat:`, `chore:`, `test:` or `docs:`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A phone typed as `+62 812-1111-2222` must be stored as typed yet collide with `081211112222` → Task 2 (`guestbook_phone_key` test) and Task 6 (duplicate browser test).
2. Exactly 2,000 check-ins must load completely and stop paging without an endless loop → Task 9 ("loads every page" test seeds 2,000 rows and counts three requests).
3. A check-out date before the check-in date must be refused in the browser and by the database → Task 2 ("rejects invalid input") and Task 6 ("validation messages").
4. A missing or failing settings row must still render the public form with the Bawaslu defaults → Task 5 ("renders the Bawaslu defaults when settings cannot be loaded").
5. An unsupported upload (`.docx`) must be refused in Bahasa before any network request → Task 7 ("unsupported files are refused").

---

### Task 1: Preserve the workforce app and reduce the codebase to a booting web shell

**Files:**
- Delete: `src/features/`, `src/services/`, `src/domain/`, `src/stores/`, `src/components/{AppShell,Avatar,Calendar,Loading,NusantaraBrand,NusantaraPattern}.tsx`, `src/app/[page].tsx`, `src/types/index.ts`, `tests/e2e/*.spec.ts`, `artifacts/*.png`, `eas.json`, `tailwind.config.js`, `nativewind-env.d.ts`, `playwright.dev.config.ts`, `assets/brand/nusantara-logo.png`, `assets/brand/nusantara-background.jpg`
- Modify: `package.json`, `babel.config.js`, `metro.config.js`, `global.css`, `tsconfig.json`, `app.json`, `src/app/_layout.tsx`, `src/app/index.tsx`, `src/theme/index.tsx`, `src/components/ui.tsx`
- Keep: `supabase/`, `tests/database/foundation.test.mjs`, `src/types/supabase.ts`, `scripts/{serve-web,supabase-link,supabase-types}.cjs`, `playwright.config.ts`

**Interfaces:**
- Produces: a project where `npm run typecheck`, `npm run lint`, `npm test`, `npm run db:test` and `npm run build:web` all pass, with `@supabase/supabase-js`, `leaflet`, `@types/leaflet` and `xlsx` installed and no native-only dependencies left.

- [ ] **Step 1: Preserve the workforce state**

Run: `git branch workforce-app 600b0f3 && git tag workforce-app-final 600b0f3 && git branch --list workforce-app && git tag --list workforce-app-final`
Expected: both names printed.

- [ ] **Step 2: Remove the workforce code and assets**

Run `git rm -r -q` on every path in the Delete list above. `artifacts/` may end up empty; keep the directory with a `.gitkeep`.

- [ ] **Step 3: Rewrite dependencies and scripts in `package.json`**

Remove dependencies: `@expo-google-fonts/plus-jakarta-sans`, `@react-native-async-storage/async-storage`, `expo-camera`, `expo-document-picker`, `expo-haptics`, `expo-image`, `expo-linear-gradient`, `expo-location`, `expo-secure-store`, `expo-font`, `nativewind`, `react-native-reanimated`, `react-native-worklets`, `zustand`; devDependency `tailwindcss`.
Add dependencies: `"@supabase/supabase-js": "^2.49.0"`, `"leaflet": "^1.9.4"`, `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`; devDependency `"@types/leaflet": "^1.9.12"`.
Scripts: `"test": "node --import tsx --test \"src/**/*.test.ts\""`; remove `build:apk` and `test:e2e:dev`; rename the package to `event-guest-book`.
Run: `npm install` then `npm ls @supabase/supabase-js leaflet xlsx --depth=0`
Expected: three resolved entries, no `UNMET`.

- [ ] **Step 4: Remove NativeWind from the build**

`babel.config.js`: presets `["babel-preset-expo"]` only. `metro.config.js`: `module.exports = getDefaultConfig(__dirname)`. `global.css`: delete the three `@tailwind` lines and the `:root` block; change the focus outline colour to `#ec1c24`. `tsconfig.json` `include`: drop `nativewind-env.d.ts`.

- [ ] **Step 5: Reduce `app.json`**

`expo.name` → `"Buku Tamu"`, `web.name` → `"Buku Tamu"`, `web.themeColor` → `"#00243f"`. Delete the `expo-location` and `expo-camera` entries from `plugins` (leave `expo-router`), delete `android.permissions` and `android.softwareKeyboardLayoutMode`. Keep `slug`, `owner`, `extra.eas.projectId`, `extra.router.asyncRoutes` and the icon paths.

- [ ] **Step 6: Make the shell compile without the deleted modules**

`src/theme/index.tsx`: delete the `usePreferences` import; `ThemeProvider` temporarily always provides `light`. `src/components/ui.tsx`: delete `Sheet` (and its `Modal`/`KeyboardAvoidingView`/`useSafeAreaInsets`/`useWindowDimensions` imports) and `IconBox`; everything else stays. `src/app/_layout.tsx`:

```tsx
import "../../global.css";
import { Slot } from "expo-router";
export default function RootLayout() { return <Slot />; }
```

`src/app/index.tsx` renders `<T size={24} weight="bold">Buku Tamu</T>` inside a `View` with `padding: 24`.

- [ ] **Step 7: Verify every check**

Run: `npm run typecheck && npm run lint && npm test && npm run db:test && npm run build:web`
Expected: typecheck and lint print nothing; `npm test` reports `tests 0`, exit 0; `db:test` reports `pass 9`; the build ends with `Exported: dist`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: strip workforce app to a web shell for the guest book"
```

---

### Task 2: Guest book migration with embedded-Postgres tests

**Files:**
- Create: `supabase/migrations/20261026000000_guestbook.sql`
- Test: `tests/database/guestbook.test.mjs`

**Interfaces:**
- Produces, all in schema `public`:
  - `guestbook_settings` (`id smallint primary key default 1 check (id = 1)`, `event_name text`, `welcome_text text`, `logo_path text null`, `background_path text null`, `accent_color text`, `background_color text`, `surface_color text`, `text_color text`, `whatsapp_number text null`, `updated_at timestamptz default now()`), seeded with one row: `'Buku Tamu'`, `'Silakan isi data diri Anda untuk check-in.'`, nulls, `#ec1c24`, `#00243f`, `#ffffff`, `#1e1e1e`, null. Colour columns check `^#[0-9a-f]{6}$`.
  - `guestbook_checkins` (`id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `name text` 2–120 chars, `phone text`, `phone_key text generated always as (public.guestbook_phone_key(phone)) stored` with check `length between 8 and 15`, `email text` ≤160 matching `^[^@\s]+@[^@\s]+\.[^@\s]+$`, `email_key text generated always as (lower(btrim(email))) stored`, `jabatan text` 1–120, `address text` 1–400, `latitude double precision null` −90..90, `longitude double precision null` −180..180, `file_path text null` matching `^checkins/[A-Za-z0-9._-]+$`, `check_in_date date`, `check_out_date date` with check `check_out_date >= check_in_date`); unique indexes on `phone_key` and `email_key`.
  - `guestbook_draw_winners` (`id uuid pk`, `checkin_id uuid unique references guestbook_checkins(id) on delete cascade`, `prize text default ''`, `drawn_at timestamptz default now()`, `drawn_by uuid null`).
  - `guestbook_admins` (`auth_user_id uuid primary key references auth.users(id) on delete cascade`, `created_at timestamptz default now()`).
  - `guestbook_phone_key(text) returns text` immutable: digits only; a leading `62` on a result longer than 8 digits becomes `0`.
  - `guestbook_is_admin() returns boolean` stable security definer: `auth.uid()` is in `guestbook_admins`. Executable by `anon` and `authenticated`.
  - `guestbook_check_in(p_name text, p_phone text, p_email text, p_jabatan text, p_address text, p_latitude double precision, p_longitude double precision, p_file_path text, p_check_in_date date, p_check_out_date date, p_honeypot text default null) returns jsonb` security definer, `set search_path = public`, executable by `anon` and `authenticated`. Raises `spam` when `p_honeypot` is non-empty; raises the Bahasa messages `Nama wajib diisi (2–120 karakter)`, `Nomor telepon tidak valid`, `E-mail tidak valid`, `Jabatan wajib diisi`, `Alamat wajib diisi`, `Tanggal check out tidak boleh sebelum tanggal check in`, `Berkas tidak valid`. Inserts with `on conflict do nothing returning created_at`; returns `{"status":"created","created_at":…}` or, on conflict, `{"status":"duplicate","created_at":…}` of the earliest row whose `phone_key` or `email_key` matches.
  - `guestbook_draw_winner(p_prize text default '') returns jsonb` security definer, executable by `authenticated`: raises `Hanya admin yang dapat mengundi` unless `guestbook_is_admin()`; takes `pg_advisory_xact_lock(hashtext('guestbook_draw'))`; picks one `guestbook_checkins` row with no winner `order by random() limit 1`; returns `{"status":"empty"}` or `{"status":"drawn","winner":{id,checkin_id,prize,drawn_at},"checkin":{id,name,jabatan,phone,email}}`.
  - RLS enabled on all four tables. Grants: `select` on settings to `anon, authenticated`; `update` on settings to `authenticated`; `select, delete` on checkins and draw_winners to `authenticated`; nothing on admins. Policies: settings select `using (true)`; settings update `using/with check (public.guestbook_is_admin())`; checkins and draw_winners select/delete `using (public.guestbook_is_admin())`.
  - Storage: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)` → `guestbook-brand` (public, 5242880, png/jpeg/webp) and `guestbook-uploads` (private, 5242880, jpeg/png/webp/pdf), `on conflict (id) do nothing`. Policies on `storage.objects`: `guestbook brand public read` select for `anon, authenticated` where bucket is `guestbook-brand`; `guestbook brand admin write` insert/update/delete for `authenticated` where bucket is `guestbook-brand` and `guestbook_is_admin()`; `guestbook uploads anonymous insert` insert for `anon, authenticated` where bucket is `guestbook-uploads` and `(storage.foldername(name))[1] = 'checkins'`; `guestbook uploads admin read` select for `authenticated` where bucket is `guestbook-uploads` and `guestbook_is_admin()`.

- [ ] **Step 1: Write the failing tests**

`tests/database/guestbook.test.mjs` starts like `foundation.test.mjs` (PGlite, auth roles, `auth.users`, `auth.uid()`), then adds a storage stub before running the migration:

```sql
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated;
grant all on storage.buckets, storage.objects to anon, authenticated;
```

Then it executes `20261026000000_guestbook.sql`, inserts `auth.users` ids `id(1)` and `id(2)`, and `insert into public.guestbook_admins (auth_user_id) values (id(1))`. Reuse the `asUser(userId, run, role)` helper. A helper `checkIn(overrides)` calls the RPC with valid defaults: name `Budi Santoso`, phone `0812 1111 2222`, email `budi@example.test`, jabatan `Staf`, address `Jl. MH Thamrin 14`, null coordinates, null file, dates `2026-11-02`/`2026-11-04`.

Tests and assertions:

```js
test("guestbook tables have RLS and no direct client writes", …)
// relrowsecurity true for the 4 guestbook_ tables; has_table_privilege('anon', t, 'INSERT'|'UPDATE'|'DELETE') false for all 4;
// has_table_privilege('authenticated', 'public.guestbook_checkins', 'INSERT') false; same for guestbook_admins and 'UPDATE'.

test("phone keys normalise formatting and the +62 prefix", …)
// each of ["+62 812-3456-7890", "62812 3456 7890", "0812-3456-7890", "(0812) 34567890"] → "081234567890"; "+1 415 555 0100" → "14155550100".

test("anonymous check-in succeeds once and reports the duplicate's time", …)
// as anon: first → {status:"created"}; second with phone "+62 812-1111-2222" and email "lain@example.test" → {status:"duplicate", created_at === first.created_at};
// third with phone "0813 0000 0000" and email "BUDI@example.test" → duplicate; as anon `select * from public.guestbook_checkins` rejects /permission denied/;
// as id(1): one row, phone === "0812 1111 2222" (as typed).

test("the check-in function rejects invalid input", …)
// honeypot "x" → /spam/; check_out "2026-11-01" with check_in "2026-11-02" → /check out/; name "A" → /Nama/; email "bad" → /E-mail/; phone "12" → /telepon/; file "other/x.jpg" → /Berkas/;
// afterwards the table still holds only the rows created above.

test("only admins read check-ins, settings are public, and only admins update settings", …)
// as id(2): select checkins → 0 rows; update settings set event_name='X' → rowCount 0; rpc guestbook_draw_winner → rejects /admin/.
// as id(1): select checkins → 1 row; update settings set event_name='Rakernas' → rowCount 1.
// as anon: select event_name from settings → "Rakernas"; update → rejects /permission denied/ or rowCount 0.

test("draws pick each attendee at most once and only for admins", …)
// seed 2 more check-ins as anon (distinct phones/e-mails); as id(1): three draws → three distinct checkin_id, each status "drawn" with checkin.name; fourth → {status:"empty"};
// delete one winner row; next draw returns that checkin_id.

test("storage policies allow anonymous uploads only into checkins/ and admin reads", …)
// as anon: insert ('guestbook-uploads','checkins/a.jpg') ok; ('guestbook-uploads','other/a.jpg') rejects /policy/; ('guestbook-brand','logo.png') rejects /policy/; select → 0 rows.
// as id(2): select → 0 rows; insert into guestbook-brand rejects /policy/. as id(1): select ≥ 1 row; insert ('guestbook-brand','logo.png') ok.
// buckets: file_size_limit 5242880 for both; guestbook-brand public true; guestbook-uploads public false.
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/database/guestbook.test.mjs`
Expected: FAIL at `before` with `ENOENT` for the migration file.

- [ ] **Step 3: Write the migration**

Write `supabase/migrations/20261026000000_guestbook.sql` implementing every item in the Interfaces block, wrapped in `begin; … commit;`, with a leading comment that it is additive and leaves `forma_` tables untouched. Functions `revoke all … from public` before their grants.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run db:test`
Expected: `pass 16`, `fail 0` (9 foundation + 7 guestbook).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261026000000_guestbook.sql tests/database/guestbook.test.mjs
git commit -m "feat: add guestbook schema, RPCs, policies and buckets with embedded Postgres tests"
```

---

### Task 3: Apply the migration to the hosted project

**Files:**
- Modify: `src/types/supabase.ts` (regenerated)

**Interfaces:**
- Produces: the hosted project `dzzufvejzbhgwiemcxwz` has the guestbook objects and both buckets; `src/types/supabase.ts` contains `guestbook_checkins`.

- [ ] **Step 1: Load the private database credentials into the shell without printing them**

Run: `set -a; . ./.env.supabase.local; set +a; npm run db:status`
Expected: a table listing `20261024000000` and `20261026000000` under Local; the Remote column shows whether the foundation migration was already applied. Never echo variables.

- [ ] **Step 2: Dry run, then push**

Run: `npm run db:plan`
Expected: the pending migration file(s) listed, no errors.
Run: `npm run db:push`
Expected: `Applying migration 20261026000000_guestbook.sql...` then `Finished supabase db push.`
Run: `npm run db:status`
Expected: both migrations present in Local and Remote.

- [ ] **Step 3: Regenerate types**

Run: `npm run db:types && grep -c guestbook_checkins src/types/supabase.ts`
Expected: `Generated src/types/supabase.ts…` and a count of at least 1.

- [ ] **Step 4: Commit**

```bash
git add src/types/supabase.ts
git commit -m "chore: apply guestbook migration to the hosted project and regenerate types"
```

---

### Task 4: Bawaslu brand assets and the four-colour theme

**Files:**
- Create: `assets/brand/bawaslu-kv.png` (copied source), `scripts/generate-brand-assets.cjs`, `src/domain/theme.ts`, `src/types/guestbook.ts`
- Generated: `assets/brand/bawaslu-logo.png`, `assets/brand/bawaslu-background.jpg`, `assets/brand/app-icon.png`, `assets/brand/adaptive-icon.png`, `assets/brand/favicon.png`
- Delete: `scripts/generate-brand-icons.cjs`
- Modify: `assets/brand/README.md`, `src/theme/index.tsx`, `src/components/ui.tsx`
- Test: `src/domain/theme.test.ts`

**Interfaces:**
- Produces `src/domain/theme.ts`:
  - `type ThemeColors = { accent: string; background: string; surface: string; text: string }`
  - `const BAWASLU: ThemeColors = { accent: "#ec1c24", background: "#00243f", surface: "#ffffff", text: "#1e1e1e" }`, `const GOLD = "#d1aa67"`
  - `isHexColor(value: string): boolean` — true only for `#` plus six hex digits, any case
  - `relativeLuminance(hex: string): number` (WCAG sRGB)
  - `contrastText(hex: string): "#ffffff" | "#1e1e1e"` — white when luminance < 0.4
  - `type Theme = { accent; onAccent; background; onBackground; surface; text; muted; border; inputSurface; overlay; gold; danger; success }` (all strings)
  - `deriveTheme(colors: ThemeColors): Theme` — `onAccent = contrastText(accent)`, `onBackground = contrastText(background)`, `muted = rgba(text, 0.65)`, `border = rgba(text, 0.18)`, `inputSurface = rgba(text, 0.04)`, `overlay = rgba(background, 0.72)`, `gold = GOLD`, `danger = "#c62828"`, `success = "#2e7d32"`
- Produces `src/types/guestbook.ts`: `Settings`, `CheckIn`, `Winner`, `CheckInResult` as plain snake_case row types:
  - `Settings = { id: 1; event_name: string; welcome_text: string; logo_path: string | null; background_path: string | null; accent_color: string; background_color: string; surface_color: string; text_color: string; whatsapp_number: string | null; updated_at: string }`
  - `CheckIn = { id: string; created_at: string; name: string; phone: string; email: string; jabatan: string; address: string; latitude: number | null; longitude: number | null; file_path: string | null; check_in_date: string; check_out_date: string }`
  - `Winner = { id: string; checkin_id: string; prize: string; drawn_at: string; drawn_by: string | null }`
  - `CheckInResult = { status: "created" | "duplicate"; created_at: string }`
- Produces `src/theme/index.tsx`: `ThemeProvider({ colors, children }: { colors: ThemeColors; children: ReactNode })` providing `deriveTheme(colors)`; `useTheme(): Theme`; `fonts`, `fontWeights` unchanged. `brand`, `light`, `dark` are removed.
- `ui.tsx` token mapping: Button `primary` = `accent` background, `onAccent` text; `secondary` = transparent with `border`, `text`; `ghost` = transparent, `text`; `danger` = `danger` background, white text; the `white` variant is removed. Field border `border` (`danger` on error), text `text`, background `inputSurface`, label `text`. Card `surface` + `border`. `T` default colour `text`. Badge tones `neutral | success | danger | gold`.

- [ ] **Step 1: Copy the key visual and write the asset script**

Run: `cp "/Users/FarizsMBP/Downloads/KV Bawaslu-05.png" assets/brand/bawaslu-kv.png && sips -g pixelWidth assets/brand/bawaslu-kv.png`
Expected: `pixelWidth: 4536`.
Write `scripts/generate-brand-assets.cjs` using `jimp-compact` through `@expo/image-utils` exactly as the deleted icon script did. Crops in source pixels: logo pill `crop(130, 130, 700, 220)` → `bawaslu-logo.png`; background `crop(0, 400, 4536, 2152)` → resize to 1600 px wide → JPEG, starting at quality 82 and lowering by 6 until the file is ≤ 240 KB → `bawaslu-background.jpg`; mark `crop(205, 170, 145, 145)` with pixels where r, g and b all exceed 240 made transparent → `app-icon.png` (1024, white background, mark height 640), `adaptive-icon.png` (1024, transparent, mark height 560), `favicon.png` (64, white, mark height 48). Print each output path and byte size.

- [ ] **Step 2: Generate and check the assets**

Run: `node scripts/generate-brand-assets.cjs && sips -g pixelWidth -g pixelHeight assets/brand/bawaslu-logo.png assets/brand/bawaslu-background.jpg && ls -l assets/brand`
Expected: logo 700 × 220, background 1600 × 759, `bawaslu-background.jpg` ≤ 245,760 bytes, `bawaslu-logo.png` ≤ 81,920 bytes. Open both with the Read tool and confirm the pill shows the full wordmark and the background has no logo pill.

- [ ] **Step 3: Rewrite `assets/brand/README.md`**

Source: the owner-supplied key visual and https://www.bawaslu.go.id/id; measured colours; the crop rectangles above; `node scripts/generate-brand-assets.cjs` regenerates everything; the key visual is kept unmodified.

- [ ] **Step 4: Write the failing theme tests**

```ts
// src/domain/theme.test.ts
it("picks readable text for the brand colours", () => {
  assert.equal(contrastText("#ec1c24"), "#ffffff");
  assert.equal(contrastText("#d1aa67"), "#1e1e1e");
  assert.equal(contrastText("#00243f"), "#ffffff");
  assert.equal(contrastText("#ffffff"), "#1e1e1e");
});
it("derives the Bawaslu theme", () => {
  const t = deriveTheme(BAWASLU);
  assert.equal(t.onAccent, "#ffffff"); assert.equal(t.onBackground, "#ffffff");
  assert.equal(t.gold, "#d1aa67"); assert.equal(t.muted, "rgba(30, 30, 30, 0.65)");
  assert.equal(t.border, "rgba(30, 30, 30, 0.18)"); assert.equal(t.overlay, "rgba(0, 36, 63, 0.72)");
});
it("validates hex colours", () => {
  assert.equal(isHexColor("#EC1C24"), true); assert.equal(isHexColor("#abc"), false); assert.equal(isHexColor("red"), false);
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot find module `./theme`.

- [ ] **Step 6: Implement `src/domain/theme.ts` and `src/types/guestbook.ts`**

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: `pass 3`.

- [ ] **Step 8: Rewrite `src/theme/index.tsx` and update `src/components/ui.tsx` to the token mapping**

`src/app/_layout.tsx` wraps `<Slot />` in `<ThemeProvider colors={BAWASLU}>` for now.

- [ ] **Step 9: Verify and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build:web`
Expected: all pass.

```bash
git add -A
git commit -m "feat: add Bawaslu brand assets and four-colour theme derivation"
```

---

### Task 5: Supabase client, settings, providers and the public page skeleton

**Files:**
- Create: `src/services/supabase.ts`, `src/services/settings.ts`, `src/components/Brand.tsx`, `tests/e2e/supabase-stub.ts`
- Modify: `src/app/_layout.tsx`, `src/app/index.tsx`, `playwright.config.ts` (header comment only)
- Test: `tests/e2e/public-page.spec.ts`

**Interfaces:**
- `src/services/supabase.ts`: `supabaseConfigured(): boolean`; `getSupabase(): SupabaseClient` singleton created with `{ auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }`; throws `Error("Konfigurasi Supabase belum diisi: EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.")` when either variable is empty.
- `src/services/settings.ts`: `DEFAULT_SETTINGS: Settings` (the migration's seed values, `updated_at: ""`); `fetchSettings(): Promise<Settings>` (`from("guestbook_settings").select("*").eq("id", 1).maybeSingle()`, defaults when null); `useSettings(): { settings: Settings; isLoading: boolean }` (query key `["settings"]`, `placeholderData: DEFAULT_SETTINGS`, `staleTime: 60_000`, on error returns defaults); `brandImageUrl(path: string | null): string | null` (`storage.from("guestbook-brand").getPublicUrl(path).data.publicUrl`); `settingsColors(settings): ThemeColors` — each colour column that fails `isHexColor` falls back to the matching `BAWASLU` value.
- `src/components/Brand.tsx` (web only, so plain DOM elements): `Backdrop({ children })` — a `div` with `backgroundColor: theme.background`, `backgroundImage: url(...)` from `brandImageUrl(settings.background_path)` or the bundled `bawaslu-background.jpg` (its `require(...)` resolves to a URL on web), `backgroundSize: "cover"`, `backgroundPosition: "left top"`, `minHeight: "100vh"`; `Logo({ width = 220 })` — an `<img alt={settings.event_name}>` sized 700:220 from `logo_path` or the bundled logo; `EventHeader()` — `Logo`, then `event_name` as `T size={26} weight="bold" accessibilityRole="header"` in `onBackground`, then `welcome_text` in `onBackground`.
- `src/app/_layout.tsx`: `QueryClientProvider` (`staleTime: 30000, retry: 1`) → `AppTheme` (reads `useSettings()`, renders `ThemeProvider colors={settingsColors(settings)}`) → `Slot`. When `!supabaseConfigured()` render only a centred `Card` with the configuration error text.
- `src/app/index.tsx`: `Backdrop` → scroll view, `maxWidth: 520`, centred → `EventHeader` → `Card` containing `T weight="bold"` "Formulir Check-in" (Task 6 replaces the card body).
- `tests/e2e/supabase-stub.ts`: `installSupabaseStub(page: Page, seed?: { settings?: Partial<Settings>; checkins?: CheckIn[]; winners?: Winner[]; admin?: { email: string; password: string }; failSettings?: boolean }): Promise<StubState>` where `StubState = { settings: Settings; checkins: CheckIn[]; winners: Winner[]; rpcCalls: Array<{ name: string; body: Record<string, unknown> }>; uploads: Array<{ bucket: string; path: string; contentType: string; bytes: number }>; signedPaths: string[]; rangeHeaders: string[] }`. Routes (globs match any host):
  - `**/rest/v1/guestbook_settings*` GET → `[settings]` (status 500 when `failSettings`); PATCH → merge body, respond `[settings]`.
  - `**/rest/v1/rpc/guestbook_check_in` POST → record call; `p_honeypot` non-empty → 400 `{ message: "spam" }`; duplicate by `phoneKey(p_phone)` or lower-cased e-mail → `{ status: "duplicate", created_at }`; else push a `CheckIn` (new uuid, `created_at` now) and return `{ status: "created", created_at }`.
  - `**/rest/v1/guestbook_checkins*` GET → rows sorted newest first, sliced by the `Range` header (`a-b`), header recorded in `rangeHeaders`, response `Content-Range: a-b/*`.
  - `**/rest/v1/guestbook_draw_winners*` GET → winners; DELETE with `id=eq.<id>` → remove.
  - `**/rest/v1/rpc/guestbook_draw_winner` POST → random unwon check-in or `{ status: "empty" }`, mirroring the SQL contract.
  - `**/auth/v1/token?grant_type=password` POST → matching credentials return a session whose `access_token` is an unsigned JWT with `exp` one day ahead, `expires_in: 86400`, `refresh_token: "stub-refresh"`, `user: { id, email, aud: "authenticated", role: "authenticated" }`; otherwise 400 `{ error: "invalid_grant", error_description: "Invalid login credentials" }`. `**/auth/v1/token?grant_type=refresh_token` → same session. `**/auth/v1/user` GET → the user. `**/auth/v1/logout*` POST → 204.
  - `**/storage/v1/object/guestbook-uploads/**` and `**/storage/v1/object/guestbook-brand/**` POST → record `{ bucket, path, contentType, bytes }`, respond `{ Key: "<bucket>/<path>" }`; `**/storage/v1/object/sign/**` POST → record the path, respond `{ signedURL: "/object/sign/<bucket>/<path>?token=stub" }`; `**/storage/v1/object/public/**` GET → a 1 × 1 PNG.
  - `https://tile.openstreetmap.org/**` → fulfil with a 1 × 1 PNG.
- `phoneKey(s)` in the stub mirrors `guestbook_phone_key`.

- [ ] **Step 1: Write the stub and the failing tests**

```ts
// tests/e2e/public-page.spec.ts
test("the public page shows the event name, welcome text and logo from settings", async ({ page }) => {
  await installSupabaseStub(page, { settings: { event_name: "Rakernas Bawaslu 2026", welcome_text: "Selamat datang, silakan check-in." } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rakernas Bawaslu 2026" })).toBeVisible();
  await expect(page.getByText("Selamat datang, silakan check-in.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Rakernas Bawaslu 2026" })).toBeVisible();
  await expect(page.getByText("Formulir Check-in")).toBeVisible();
});
test("the public page renders the Bawaslu defaults when settings cannot be loaded", async ({ page }) => {
  await installSupabaseStub(page, { failSettings: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Buku Tamu" })).toBeVisible();
  await expect(page.getByText("Formulir Check-in")).toBeVisible();
});
```

- [ ] **Step 2: Build with stub credentials and run the tests to verify they fail**

Run: `EXPO_PUBLIC_SUPABASE_URL=https://stub.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run build:web && PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e`
Expected: 2 failed (heading not found).

- [ ] **Step 3: Implement the services, `Brand.tsx`, the layout and the index page**

- [ ] **Step 4: Rebuild and run the tests to verify they pass**

Same two commands. Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: load event settings from Supabase and render the themed public page"
```

---

### Task 6: Check-in form, RPC submission, duplicate and validation feedback

**Files:**
- Create: `src/domain/checkin.ts`, `src/domain/phone.ts`, `src/domain/time.ts`, `src/services/checkins.ts`, `src/components/NativeInput.tsx`, `src/features/CheckIn.tsx`
- Modify: `src/app/index.tsx`
- Test: `src/domain/checkin.test.ts`, `src/domain/phone.test.ts`, `src/domain/time.test.ts`, `tests/e2e/checkin.spec.ts`

**Interfaces:**
- `src/domain/checkin.ts`: `checkInSchema` (zod) with messages: `name` min 2 `Nama wajib diisi`, max 120 `Nama maksimal 120 karakter`; `phone` → `phoneDigits(value).length` 8–15 else `Nomor telepon tidak valid`; `email` `E-mail tidak valid`, max 160; `jabatan` min 1 `Jabatan wajib diisi`, max 120; `address` min 1 `Alamat wajib diisi`, max 400; `check_in_date` regex `^\d{4}-\d{2}-\d{2}$` `Tanggal check in wajib diisi`; `check_out_date` same regex `Tanggal check out wajib diisi`; refine `check_out_date >= check_in_date` → `Tanggal check out tidak boleh sebelum tanggal check in` on `check_out_date`. `type CheckInInput = z.infer<typeof checkInSchema>`.
- `src/domain/phone.ts`: `phoneDigits(value: string): string` (digits only, leading `62` on more than 8 digits → `0`); `maskPhone(value: string): string` (digits; keep first 4 and last 2, stars between; if 6 digits or fewer keep the first 2 and star the rest); `whatsappLink(value: string): string` → `https://wa.me/` + digits with a leading `0` replaced by `62`.
- `src/domain/time.ts`: `formatWib(iso: string): string` → `dd/MM/yyyy HH:mm WIB` in `Asia/Jakarta` via `Intl.DateTimeFormat("id-ID", …)` parts.
- `src/services/checkins.ts`: `submitCheckIn(input: CheckInInput, extra: { file_path: string | null; honeypot: string }): Promise<CheckInResult>` calling `rpc("guestbook_check_in", { p_name, p_phone, … })`; throws `Error(error.message)` on failure.
- `src/components/NativeInput.tsx`: `DateInput({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string })` rendering a DOM `<input type="date">` styled like `Field` (44 px, 6 px radius, theme border/text), `aria-label={label}`.
- `src/features/CheckIn.tsx`: `CheckIn()` — the `Card` keeps the `Formulir Check-in` heading from Task 5 above the fields; react-hook-form with `zodResolver(checkInSchema)`, fields in the global order (Alamat is a multiline `Field` until Task 7 adds the map; Unggah Berkas is added in Task 7), honeypot `TextInput` with `accessibilityLabel="Kosongkan kolom ini"`, `aria-hidden`, `tabIndex={-1}`, style `{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }`; `Button label="Kirim" loading={submitting} loadingLabel="Mengirim…"`. Outcomes: created → heading `Terima kasih, {name}!`, a summary list of the submitted values, `Hubungi Panitia via WhatsApp` link (`href={whatsappLink(settings.whatsapp_number)}`, `target="_blank"`) only when a number is set, and a ghost button `Isi check-in lain` that resets the form; duplicate → `T accessibilityRole="alert"` `Nomor telepon atau e-mail ini sudah terdaftar pada {formatWib(created_at)}. Periksa kembali data Anda.`; RPC error `spam` → alert `Pengiriman ditolak. Coba lagi.`; any other error → its message.

- [ ] **Step 1: Write the failing unit tests**

```ts
// phone.test.ts
assert.equal(phoneDigits("+62 812-1111-2222"), "081211112222");
assert.equal(maskPhone("081211112222"), "0812******22");
assert.equal(maskPhone("+62 812-1111-2222"), "0812******22");
assert.equal(maskPhone("08123"), "08***");
assert.equal(whatsappLink("0812-3456-7890"), "https://wa.me/6281234567890");
assert.equal(whatsappLink("+62 812 3456 7890"), "https://wa.me/6281234567890");
// time.test.ts
assert.equal(formatWib("2026-10-26T03:05:00Z"), "26/10/2026 10:05 WIB");
// checkin.test.ts
const valid = { name: "Budi Santoso", phone: "0812 1111 2222", email: "budi@example.test", jabatan: "Staf", address: "Jl. MH Thamrin 14", check_in_date: "2026-11-02", check_out_date: "2026-11-04" };
assert.equal(checkInSchema.safeParse(valid).success, true);
const bad = checkInSchema.safeParse({ ...valid, name: "A", phone: "12", email: "x", check_out_date: "2026-11-01" });
assert.deepEqual(bad.error!.issues.map((i) => i.message).sort(),
  ["E-mail tidak valid", "Nama wajib diisi", "Nomor telepon tidak valid", "Tanggal check out tidak boleh sebelum tanggal check in"]);
```

- [ ] **Step 2: Run the unit tests to verify they fail, implement the three domain modules, run again**

Run: `npm test` — Expected after implementation: `pass 6` or more, `fail 0`.

- [ ] **Step 3: Write the failing browser tests**

```ts
// tests/e2e/checkin.spec.ts  (helper fillForm(page, overrides) fills every field with the `valid` values above; dates via getByLabel("Tanggal Check In").fill("2026-11-02"))
test("an attendee can check in and sees a thank-you with the organiser WhatsApp button", …)
// seed settings whatsapp_number "0812-3456-7890"; fill; click Kirim;
// expect heading "Terima kasih, Budi Santoso!" visible; link "Hubungi Panitia via WhatsApp" has href "https://wa.me/6281234567890";
// state.checkins.length === 1 and state.checkins[0].phone === "0812 1111 2222".
test("a repeated phone number is reported with the earlier check-in time and not saved again", …)
// seed one check-in with phone "081211112222", created_at "2026-10-26T03:05:00Z"; fill with phone "+62 812-1111-2222" and email "lain@example.test"; Kirim;
// expect alert containing "sudah terdaftar pada 26/10/2026 10:05 WIB"; state.checkins.length === 1.
test("validation messages appear in Bahasa before anything is sent", …)
// click Kirim on the empty form; expect each of "Nama wajib diisi", "Nomor telepon tidak valid", "E-mail tidak valid", "Jabatan wajib diisi", "Alamat wajib diisi", "Tanggal check in wajib diisi" visible;
// fill valid values but check-out "2026-11-01"; Kirim; expect "Tanggal check out tidak boleh sebelum tanggal check in"; state.rpcCalls.length === 0.
test("the hidden honeypot blocks bots", …)
// fill valid; page.getByLabel("Kosongkan kolom ini").fill("bot", { force: true }); Kirim; expect alert "Pengiriman ditolak. Coba lagi."; state.checkins.length === 0.
```

- [ ] **Step 4: Rebuild with stub credentials and run the browser tests to verify they fail**

Expected: the 4 new tests fail (no `Nama` field).

- [ ] **Step 5: Implement `NativeInput.tsx`, `checkins.ts`, `CheckIn.tsx`; mount it in `src/app/index.tsx`**

- [ ] **Step 6: Rebuild and run the whole browser suite**

Expected: `6 passed`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: public check-in form with RPC submission, duplicate and validation feedback"
```

---

### Task 7: Alamat map pin and Unggah Berkas

**Files:**
- Create: `src/features/checkin/MapPicker.tsx`, `src/services/uploads.ts`, `tests/fixtures/sample-2400.png`, `scripts/make-test-fixtures.cjs`
- Modify: `src/components/NativeInput.tsx`, `src/features/CheckIn.tsx`, `tests/e2e/supabase-stub.ts` (storage and tile routes if not yet present)
- Test: `tests/e2e/checkin-extras.spec.ts`

**Interfaces:**
- `MapPicker({ value, onChange }: { value: { latitude: number; longitude: number } | null; onChange: (v: { latitude: number; longitude: number } | null) => void })` — Leaflet map (`import "leaflet/dist/leaflet.css"`) in a `div` ref, 240 px tall, centre Jakarta `[-6.2, 106.816667]` zoom 11, OpenStreetMap tiles with attribution `© OpenStreetMap contributors`; clicking or dragging the `L.divIcon` marker calls `onChange`; a `Button label="Gunakan lokasi saya"` uses `navigator.geolocation.getCurrentPosition`, pans to zoom 16 and sets the pin; on error shows `Lokasi tidak tersedia. Anda tetap bisa mengisi alamat.`; the container has `accessibilityLabel="Peta lokasi"`.
- `src/services/uploads.ts`: `ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]`; `MAX_PDF_BYTES = 5 * 1024 * 1024`; `compressImage(file: File, maxSide: number): Promise<Blob>` (canvas, JPEG quality 0.82); `prepareUpload(file: File, maxSide = 1600): Promise<{ blob: Blob; extension: "jpg" | "pdf"; contentType: string }>` throwing `Berkas harus berupa gambar atau PDF` or `Ukuran berkas maksimal 5 MB`; `uploadCheckInFile(file: File): Promise<string>` → uploads to `guestbook-uploads` at `checkins/${crypto.randomUUID()}.${extension}` with `{ contentType, upsert: false }` and returns the path.
- `NativeInput.tsx` adds `FileInput({ label, accept, onChange, error, hint }: { label: string; accept: string; onChange: (file: File | null) => void; error?: string; hint?: string })` — a styled label button `Pilih berkas` wrapping a DOM `<input type="file" aria-label={label}>`, showing the chosen file name or `Belum ada berkas`.
- `CheckIn.tsx`: Alamat = multiline `Field` + `MapPicker`; Unggah Berkas = `FileInput label="Unggah Berkas (opsional)" accept="image/*,application/pdf"` with hint `Gambar atau PDF, maksimal 5 MB`; on submit, when a file is chosen the button shows `Mengunggah berkas…` during `uploadCheckInFile`, then `Mengirim…`; the returned path is passed as `file_path`, coordinates as `p_latitude`/`p_longitude` (null when no pin).

- [ ] **Step 1: Generate the fixture**

`scripts/make-test-fixtures.cjs` writes `tests/fixtures/sample-2400.png` (2400 × 1800, solid `#ec1c24` with a `#00243f` square) using `jimp-compact` as in Task 4. Run it; expected file size over 20 KB.

- [ ] **Step 2: Write the failing browser tests**

```ts
// tests/e2e/checkin-extras.spec.ts
test("the map pin and typed address are saved with the check-in", async ({ page, context }) => {
  // context.grantPermissions(["geolocation"]); context.setGeolocation({ latitude: -6.1754, longitude: 106.8272 });
  // fillForm; click "Gunakan lokasi saya"; Kirim; expect "Terima kasih"; const call = state.rpcCalls[0].body;
  // expect(call.p_latitude).toBeCloseTo(-6.1754, 3); expect(call.p_longitude).toBeCloseTo(106.8272, 3); expect(call.p_address).toBe("Jl. MH Thamrin 14");
});
test("an image upload is compressed to JPEG and attached; unsupported files are refused", async ({ page }) => {
  // setInputFiles(getByLabel("Unggah Berkas (opsional)"), "tests/fixtures/sample-2400.png"); fillForm; Kirim; expect "Terima kasih";
  // expect(state.uploads[0].contentType).toBe("image/jpeg"); expect(state.uploads[0].path).toMatch(/^checkins\/[0-9a-f-]+\.jpg$/);
  // expect(state.uploads[0].bytes).toBeLessThan(fixtureBytes); expect(state.rpcCalls[0].body.p_file_path).toBe(state.uploads[0].path);
  // click "Isi check-in lain"; setInputFiles({ name: "surat.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("x") });
  // expect(page.getByText("Berkas harus berupa gambar atau PDF")).toBeVisible(); expect(state.uploads.length).toBe(1);
});
```

- [ ] **Step A: Rebuild with stub credentials and run the browser suite to verify the new tests fail**

Expected: 2 failed (no map, no file input).

- [ ] **Step B: Implement `MapPicker.tsx`, `uploads.ts` and `FileInput`, and wire them into `CheckIn.tsx`**

- [ ] **Step C: Rebuild and run the browser suite**

Expected: `8 passed`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: map pin and compressed file upload on the check-in form"
```

---

### Task 8: Admin sign-in, gate and shell

**Files:**
- Create: `src/services/auth.ts`, `src/features/admin/Masuk.tsx`, `src/features/admin/AdminShell.tsx`, `src/app/admin/_layout.tsx`, `src/app/admin/index.tsx`
- Test: `tests/e2e/admin-masuk.spec.ts`

**Interfaces:**
- `src/services/auth.ts`: `signIn(email: string, password: string): Promise<void>` (`auth.signInWithPassword`; any error → `Error("E-mail atau kata sandi salah")`); `signOut(): Promise<void>`; `useSession(): { session: Session | null; loading: boolean }` (`getSession()` once, then `onAuthStateChange`).
- `Masuk()` — `Backdrop`, `Logo`, heading `Masuk Admin`, `Field label="E-mail"`, `Field label="Kata sandi" secureTextEntry`, `Button label="Masuk" loadingLabel="Memeriksa…"`, alert on error.
- `AdminShell({ children })` — top bar with `Logo width={120}`, event name, nav `Link`s `Daftar Check-in` (`/admin`), `Undian` (`/admin/undian`), `Tampilan` (`/admin/tampilan`), and `Button label="Keluar" variant="ghost"`; content area `maxWidth: 1100`.
- `src/app/admin/_layout.tsx`: `loading` → `T` `Memuat…`; no session → `<Masuk />`; else `<AdminShell><Slot /></AdminShell>`.
- `src/app/admin/index.tsx`: heading `Daftar Check-in` (Task 9 fills it).

- [ ] **Step 1: Write the failing tests**

```ts
test("admins must sign in and wrong passwords are explained", …)
// stub admin { email: "admin@bawaslu.test", password: "rahasia123" }; goto "/admin"; heading "Masuk Admin";
// fill wrong password → alert "E-mail atau kata sandi salah"; fill right → heading "Daftar Check-in"; links "Undian" and "Tampilan" visible; click "Keluar" → heading "Masuk Admin".
test("the admin area survives a reload while signed in", …)
// sign in; page.reload(); heading "Daftar Check-in" visible.
```

- [ ] **Step A: Rebuild with stub credentials and run the browser suite to verify the new tests fail**

Expected: 2 failed (no `Masuk Admin` heading).

- [ ] **Step B: Implement `auth.ts`, `Masuk.tsx`, `AdminShell.tsx` and the two admin route files**

- [ ] **Step C: Rebuild and run the browser suite**

Expected: `10 passed`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: admin sign-in gate and shell"
```

---

### Task 9: Daftar Check-in with paged loading, total, search, file links and auto refresh

**Files:**
- Modify: `src/services/checkins.ts`, `src/app/admin/index.tsx`
- Create: `src/features/admin/Daftar.tsx`
- Test: `tests/e2e/admin-daftar.spec.ts`

**Interfaces:**
- `checkins.ts` adds `PAGE = 1000`; `fetchAllCheckIns(): Promise<CheckIn[]>` (`select("*").order("created_at", { ascending: false }).range(offset, offset + PAGE - 1)` in a loop that stops when a page returns fewer than `PAGE` rows); `fetchWinners(): Promise<Winner[]>`; `signedFileUrl(path: string): Promise<string>` (`createSignedUrl(path, 300)`); `useCheckIns()` (query key `["checkins"]`, `refetchInterval: 10_000`); `useWinners()` (key `["winners"]`, same interval).
- `Daftar()` — `T accessibilityRole="header"` `Daftar Check-in`; `T` `Total check-in: {n.toLocaleString("id-ID")}`; `Field label="Cari nama, telepon, atau e-mail"` filtering case-insensitively on `name`, `phone`, `email`; `FlatList` of rows showing `formatWib(created_at)`, `name`, `jabatan`, `phone`, `email`, `check_in_date → check_out_date`, a `Badge tone="gold"` `Pemenang · {prize}` when a winner exists, and `Button small label="Lihat berkas"` when `file_path` is set (opens `await signedFileUrl(path)` with `window.open(url, "_blank")`); export buttons are added in Task 10.

- [ ] **Step 1: Write the failing tests**

```ts
test("the list loads every page and shows the total", …)
// seed exactly 2000 check-ins (generated, unique phones/e-mails); sign in; expect text "Total check-in: 2.000";
// expect(state.rangeHeaders).toEqual(["0-999", "1000-1999", "2000-2999"]).
test("search narrows the list by name, phone or e-mail", …)
// seed Budi (0812…), Siti (0813…), Agus (0815…); search "0813" → only Siti visible; search "SITI" → only Siti; clear → 3 rows.
test("an uploaded file opens through a signed link", …)
// seed one with file_path "checkins/abc.jpg"; const popup = page.waitForEvent("popup"); click "Lihat berkas";
// expect((await popup).url()).toContain("checkins/abc.jpg"); expect(state.signedPaths).toEqual(["checkins/abc.jpg"]).
```

- [ ] **Step A: Rebuild with stub credentials and run the browser suite to verify the new tests fail**

Expected: 3 failed (no total text).

- [ ] **Step B: Implement the `checkins.ts` additions and `Daftar.tsx`, and mount it in `src/app/admin/index.tsx`**

- [ ] **Step C: Rebuild and run the browser suite**

Expected: `13 passed`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: admin check-in list with paging, search, signed file links and polling"
```

---

### Task 10: Export to Excel and CSV

**Files:**
- Create: `src/domain/export.ts`, `src/services/download.ts`
- Modify: `src/features/admin/Daftar.tsx`
- Test: `src/domain/export.test.ts`, `tests/e2e/admin-export.spec.ts`

**Interfaces:**
- `export.ts`: `EXPORT_HEADERS = ["Waktu Check-in (WIB)", "Nama", "Nomor Telepon", "E-mail", "Jabatan", "Alamat", "Latitude", "Longitude", "Berkas", "Tanggal Check In", "Tanggal Check Out", "Hadiah", "Waktu Undian (WIB)"]`; `exportRows(checkins: CheckIn[], winners: Winner[]): string[][]` (header row first, newest first, times via `formatWib`, empty strings for nulls, prize and `formatWib(drawn_at)` for winners); `toCsv(rows: string[][]): string` (`﻿` BOM, CRLF, RFC 4180 quoting of fields containing `"`, `,`, or newlines); `toXlsx(rows: string[][]): Uint8Array` (SheetJS `aoa_to_sheet` with every cell `{ t: "s", v }`, sheet name `Check-in`, `XLSX.write(wb, { type: "array", bookType: "xlsx" })`); `exportFileName(eventName: string, ext: "csv" | "xlsx", date = new Date()): string` → `check-in-<slug>-<yyyymmdd>.<ext>` where slug is lower-case, non-alphanumerics collapsed to `-`.
- `download.ts`: `downloadFile(name: string, data: Blob): void` via an object URL and a temporary anchor.
- `Daftar.tsx` adds `Button label="Ekspor Excel"` and `Button label="Ekspor CSV" variant="secondary"` using the full loaded list (not the filtered one).

- [ ] **Step 1: Write the failing unit tests**

```ts
assert.equal(toCsv([["a", "b"], ["0812,1", 'say "hi"']]), '﻿a,b\r\n"0812,1","say ""hi"""\r\n');
const rows = exportRows([checkin({ phone: "081234567890", created_at: "2026-10-26T03:05:00Z" })], [winner({ prize: "Hadiah 1", drawn_at: "2026-10-26T04:00:00Z" })]);
assert.deepEqual(rows[0], EXPORT_HEADERS); assert.equal(rows[1][0], "26/10/2026 10:05 WIB"); assert.equal(rows[1][11], "Hadiah 1");
const wb = XLSX.read(toXlsx(rows), { type: "array" }); const cell = wb.Sheets["Check-in"]["C2"];
assert.equal(cell.t, "s"); assert.equal(cell.v, "081234567890");
assert.equal(exportFileName("Rakernas Bawaslu 2026", "xlsx", new Date("2026-10-26T00:00:00+07:00")), "check-in-rakernas-bawaslu-2026-20261026.xlsx");
```

- [ ] **Step 2: Run, fail, implement `export.ts`, run** — Expected `npm test` all pass.

- [ ] **Step 3: Write the failing browser test**

```ts
test("admins download the complete list as CSV and Excel with phone numbers intact", …)
// seed 3 check-ins incl. phone "081234567890"; sign in; const dl = page.waitForEvent("download"); click "Ekspor CSV";
// const text = fs.readFileSync(await (await dl).path(), "utf8"); expect(text.startsWith("﻿Waktu Check-in (WIB),Nama")).toBe(true);
// expect(text.trim().split("\r\n").length).toBe(4); expect(text).toContain("081234567890");
// click "Ekspor Excel" → download name ends with ".xlsx"; XLSX.read(fs.readFileSync(path)) → Sheets["Check-in"]["C2"].t === "s".
```

- [ ] **Step A: Rebuild with stub credentials and run the browser suite to verify the new tests fail**

Expected: 1 failed (no `Ekspor CSV` button).

- [ ] **Step B: Implement `download.ts` and add the two export buttons to `Daftar.tsx`**

- [ ] **Step C: Rebuild and run the browser suite**

Expected: `14 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: export check-ins to Excel and CSV"
```

---

### Task 11: Undian (lucky draw)

**Files:**
- Create: `src/services/draw.ts`, `src/features/admin/Undian.tsx`, `src/app/admin/undian.tsx`
- Test: `tests/e2e/admin-undian.spec.ts`

**Interfaces:**
- `draw.ts`: `type DrawResult = { status: "empty" } | { status: "drawn"; winner: Winner; checkin: Pick<CheckIn, "id" | "name" | "jabatan" | "phone" | "email"> }`; `drawWinner(prize: string): Promise<DrawResult>` (`rpc("guestbook_draw_winner", { p_prize })`); `removeWinner(id: string): Promise<void>` (`from("guestbook_draw_winners").delete().eq("id", id)`).
- `Undian()` — `Field label="Nama hadiah"` (default `Hadiah 1`), `Button label="Undi" loadingLabel="Mengundi…"`; result panel on `background` with `gold` name at `size={48} weight="bold"`, `jabatan`, `maskPhone(phone)`, prize; `status: "empty"` → `T accessibilityRole="alert"` `Semua peserta sudah mendapat hadiah.`; list `Pemenang sebelumnya` from `useWinners()` joined to `useCheckIns()` by id with `formatWib(drawn_at)`, prize and `Button small variant="danger" label="Hapus"` → `removeWinner` then invalidate `["winners"]`.

- [ ] **Step 1: Write the failing test**

```ts
test("the draw picks each attendee once, masks the phone and can be redrawn after removal", …)
// seed Budi (081211112222) and Siti (081333334444); sign in; click "Undian"; click "Undi"; const first = winner name shown (Budi or Siti);
// expect masked phone "0812******22" or "0813******44" visible; click "Undi" → the other name; click "Undi" → alert "Semua peserta sudah mendapat hadiah.";
// click the first "Hapus"; click "Undi" → the removed name is shown again; state.winners.length === 2.
```

- [ ] **Step A: Rebuild with stub credentials and run the browser suite to verify the new tests fail**

Expected: 1 failed (no `Undi` button).

- [ ] **Step B: Implement `draw.ts`, `Undian.tsx` and `src/app/admin/undian.tsx`**

- [ ] **Step C: Rebuild and run the browser suite**

Expected: `15 passed`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: lucky draw with winner history"
```

---

### Task 12: Tampilan (theme and branding settings)

**Files:**
- Modify: `src/services/settings.ts`, `src/components/NativeInput.tsx`
- Create: `src/features/admin/Tampilan.tsx`, `src/app/admin/tampilan.tsx`
- Test: `tests/e2e/admin-tampilan.spec.ts`

**Interfaces:**
- `settings.ts` adds `updateSettings(patch: Partial<Omit<Settings, "id" | "updated_at">>): Promise<Settings>` (`update(patch).eq("id", 1).select().single()`); `uploadBrandImage(kind: "logo" | "background", file: File): Promise<string>` — PNG/WebP logos ≤ 1 MB are uploaded as-is, otherwise images go through `compressImage` (logo 1200 px, background 1920 px); path `${kind}-${Date.now()}.${ext}` in `guestbook-brand`; returns the path.
- `NativeInput.tsx` adds `ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void })` — DOM `<input type="color" aria-label={label}>` beside the hex text.
- `Tampilan()` — fields `Nama acara`, `Teks sambutan` (multiline), `Nomor WhatsApp panitia`, `FileInput label="Logo"`, `FileInput label="Gambar latar"`, `ColorInput`s `Warna aksen`, `Warna latar`, `Warna permukaan`, `Warna teks`; `Button variant="secondary" label="Gunakan preset Bawaslu"` (sets the four `BAWASLU` colours and clears both image paths); a live preview box wrapping `EventHeader`-style content and a sample `Kirim` button in `ThemeProvider colors={draft}`; `Button label="Simpan" loadingLabel="Menyimpan…"` → uploads chosen files, `updateSettings`, invalidates `["settings"]`, shows `Tampilan disimpan.`; invalid hex → `Warna harus berformat #rrggbb`.

- [ ] **Step 1: Write the failing tests**

```ts
test("theme changes are saved and reflected on the public page", …)
// sign in; click "Tampilan"; fill "Nama acara" with "Rakernas Bawaslu 2026"; page.getByLabel("Warna aksen").fill("#005bbb"); click "Simpan"; expect "Tampilan disimpan.";
// goto "/"; heading "Rakernas Bawaslu 2026"; expect(page.getByRole("button", { name: "Kirim" })).toHaveCSS("background-color", "rgb(0, 91, 187)").
test("the Bawaslu preset restores the defaults and a logo upload is stored in the brand bucket", …)
// seed settings accent "#005bbb", logo_path "logo-1.png"; sign in; Tampilan; click "Gunakan preset Bawaslu"; expect getByLabel("Warna aksen") toHaveValue("#ec1c24");
// setInputFiles(getByLabel("Logo"), fixture png); Simpan; expect(state.uploads.at(-1).bucket).toBe("guestbook-brand"); expect(state.settings.logo_path).toMatch(/^logo-\d+\.(png|jpg)$/).
```

- [ ] **Step A: Rebuild with stub credentials and run the browser suite to verify the new tests fail**

Expected: 2 failed (no `Tampilan` form).

- [ ] **Step B: Implement the `settings.ts` additions, `ColorInput`, `Tampilan.tsx` and `src/app/admin/tampilan.tsx`**

- [ ] **Step C: Rebuild and run the browser suite**

Expected: `17 passed`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: admin theme and branding settings with live preview"
```

---

### Task 13: README, deployment notes, weight gate and final verification

**Files:**
- Create: `scripts/report-weight.cjs`, `tests/e2e/screenshots.spec.ts`
- Modify: `README.md`, `supabase/README.md` (first two paragraphs), `.env.example`, `package.json` (script `"weight": "node scripts/report-weight.cjs"`)

**Interfaces:**
- `report-weight.cjs`: sums gzipped bytes (`zlib.gzipSync`) of every `dist/_expo/static/js/web/*.js` whose name does not contain `admin`, `undian` or `tampilan`, plus the bytes of `assets/brand/bawaslu-background.jpg` and `bawaslu-logo.png`; prints a table; exits 1 when JavaScript exceeds 512,000 bytes or images exceed 307,200 bytes.
- `screenshots.spec.ts` writes `artifacts/public-390.png` (public form at 390 × 844) and `artifacts/admin-daftar-1280.png` (signed-in list at 1280 × 900).

- [ ] **Step 1: Write the weight script and run it on a production build**

Run: `npm run build:web && npm run weight`
Expected: table printed, exit 0. If it exits 1, stop and report the numbers to the owner before continuing (the spec's fallback is a separate plan).

- [ ] **Step 2: Rewrite `README.md`**

Sections, in order: what it is (one-event guest book, Bahasa, Bawaslu defaults); run locally (`npm ci`, `.env.local` with the two `EXPO_PUBLIC_` variables, `npm run web`); Supabase setup (`db:plan`/`db:push` with `.env.supabase.local`, buckets created by the migration, owner checklist: disable public sign-up in Authentication settings, add a user in Authentication → Users, run `insert into public.guestbook_admins (auth_user_id) select id from auth.users where email = '<admin e-mail>';` in the SQL editor); deploy (`npm run build:web`, publish `dist/`, SPA fallback: Netlify/Cloudflare `_redirects` line `/* /index.html 200`, Vercel `vercel.json` rewrite to `/index.html`; set the two variables where the build runs; HTTPS required for geolocation); admin guide (Daftar, Ekspor, Undian, Tampilan); data and privacy (exports contain personal data; delete after the event with `delete from public.guestbook_checkins;` and empty the `guestbook-uploads` bucket; free-plan 1 GB storage note); verification (commands and the counts from this plan: unit tests, `db:test` 16, browser tests 18, weight); limitations (one event, no captcha, OpenStreetMap tile usage policy, manual smoke test on a real phone still required). Remove the three trailing `# forma-attendance` lines.

- [ ] **Step 3: Update `supabase/README.md` and `.env.example`**

Supabase README: the application now uses the `guestbook_` tables; the `forma_` tables remain unused and untouched. `.env.example`: the two variables are required for the guest book.

- [ ] **Step 4: Screenshots and the complete verification run**

Run, in this order:
`EXPO_PUBLIC_SUPABASE_URL=https://stub.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run build:web && PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e`
Expected: `18 passed`.
`npm run typecheck && npm run lint && npm test && npm run db:test && npm run build:web && npm run weight`
Expected: all pass; the final build uses `.env.local`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: guest book README, deployment notes and weight gate"
```

- [ ] **Step 6: Report to the owner**

State the weight numbers, the test counts, that the hosted smoke test on a real phone is still required, and the admin checklist items that only the owner can complete.
