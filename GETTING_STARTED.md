# Getting started

A step-by-step guide to installing and running the Buku Tamu (event guest book) for the first time. For what the app does and how it is built, see [README.md](README.md).

There are two ways to start:

- **Use the existing Supabase project.** Ask the project owner for the two public values in step 3 and an admin login. You only need Node.js.
- **Set up your own Supabase project.** Follow step 5 as well. You also need a Supabase account and the Supabase CLI.

## 1. Install the tools

| Tool | Needed for | Get it |
| --- | --- | --- |
| Node.js 24 LTS (22.13 or newer also works) | everything | https://nodejs.org (npm is included) |
| Supabase CLI | step 5 only: creating or updating the database | macOS: `brew install supabase/tap/supabase`. Windows: `scoop install supabase`. Other options: https://supabase.com/docs/guides/local-development/cli/getting-started |
| Google Chrome | browser tests only | https://www.google.com/chrome |
| `cwebp` | only when regenerating brand images | macOS: `brew install webp` |

Check Node.js:

```sh
node --version   # v24.x (or v22.13+)
```

On Windows, run the commands below in **Git Bash** (comes with Git for Windows) or **WSL**, so the `cp` and `set -a` lines work as written.

## 2. Get the code and install dependencies

Unzip the project (or clone it), open a terminal in that folder, then:

```sh
npm ci
```

`npm ci` installs the exact versions from `package-lock.json` into `node_modules/`. It takes a few minutes the first time. Never copy `node_modules` from another computer; always install it.

## 3. Point the app at Supabase

```sh
cp .env.example .env.local
```

Open `.env.local` and fill in:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Both values are in the Supabase dashboard under **Project Settings → API** (Project URL, and the publishable or anon key). They are public client values and end up in the website anyway. Never put the database password, a secret key or the service-role key in this file.

Keep `.env.local` as the only `.env…` file in the project root. Expo's development server reads every root file whose name starts with `.env`, and an unexpected name such as `.env.supabase.local` breaks `npm run web`.

## 4. Run it

```sh
npm run web
```

Open:

- http://localhost:8081 for the public check-in page (the event slideshow opens first; close it to see the form)
- http://localhost:8081/admin for the admin area (sign in with an admin account; see step 5 to create one)

Stop the server with `Ctrl+C`. If port 8081 is taken, use `npm run web -- --port 8082`.

## 5. Set up your own Supabase project (first time only)

Skip this if you use the existing project.

1. **Create a project** at https://supabase.com/dashboard. The Singapore region is closest for Indonesian users. Save the database password it shows.
2. **Sign in to the CLI:**

   ```sh
   supabase login
   ```

3. **Store the private CLI values** in `supabase/.env.cli.local` (this file is git-ignored; never share or commit it):

   ```dotenv
   SUPABASE_PROJECT_REF=<the 20-letter reference from the project URL>
   SUPABASE_DB_PASSWORD=<the database password>
   ```

4. **Link and create the database objects:**

   ```sh
   npm run db:link
   set -a; . ./supabase/.env.cli.local; set +a   # loads the password for the next commands, without printing it
   npm run db:plan                                 # dry run: lists the migrations it would apply
   npm run db:push                                 # applies them
   npm run db:status                               # every migration should show in both columns
   ```

   This creates the guest book tables, functions, security rules and the two storage buckets. The first migration also creates unused `forma_` tables from an earlier prototype; they are harmless.

5. **Create the first admin.** In the dashboard, open **Authentication → Users → Add user**, enter an e-mail and password, and tick **Auto Confirm User**. Then, in the **SQL Editor**, run (with that e-mail):

   ```sql
   insert into public.guestbook_admins (auth_user_id)
   select id from auth.users where lower(email) = lower('admin@example.org')
   on conflict do nothing
   returning auth_user_id;
   ```

   The result must show one row. Then, under **Authentication → Sign In / Providers**, turn off **Allow new users to sign up**.

6. **Copy the Project URL and publishable key** into `.env.local` (step 3) and restart `npm run web`.

7. **Optional demo data.** To show the admin list and the exports with content, paste `supabase/seed/demo-checkins.sql` into the SQL Editor and run it: 48 fictional attendees, about half checked out, three prize winners. Before the real event, run `supabase/seed/remove-demo-checkins.sql` the same way.

## 6. Check that everything works (optional)

```sh
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # unit tests
npm run db:test     # database rules, run against the real migrations in embedded Postgres (no Supabase needed)
npm run demo:export # writes sample exports to artifacts/contoh-ekspor-check-in.xlsx and .csv
```

Browser tests run against a production build with Supabase replaced by test stubs:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://stub.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub-key npm run build:web
npx playwright install chromium          # once; or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to your Chrome
npm run test:e2e
```

## 7. Build and deploy

```sh
npm run build:web
```

This writes the website to `dist/` using the values in `.env.local`. (After running the browser tests, rebuild like this before deploying, so the test stub values are not deployed.)

The live site runs on Cloudflare Workers, configured by `wrangler.jsonc`:

```sh
npx wrangler login
npx wrangler deploy
```

For your own Cloudflare account, change `"name"` in `wrangler.jsonc` first; it becomes part of the address (`<name>.<your-subdomain>.workers.dev`). When deploying from GitHub with Workers Builds instead, set the build command to `npm run build`, the deploy command to `npx wrangler deploy`, and add the two `EXPO_PUBLIC_` values as build variables.

When the database changes (a new file in `supabase/migrations/`), apply it with step 5.4 before deploying the website that needs it.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| "Konfigurasi Supabase belum diisi" | `.env.local` is missing or empty. Fill it in (step 3) and restart `npm run web`. |
| `npm run web` shows a 500 error mentioning a `.env…` file | Move any extra `.env…` file out of the project root; private CLI values belong in `supabase/.env.cli.local`. |
| `/admin` says "Akun ini belum menjadi admin" | The account signed in but has no admin grant. Run the SQL in step 5.5 with that e-mail. |
| `npm ci` warns about the Node.js version | Use Node.js 24 LTS. |
| `db:push` asks for a password or fails to connect | Run the `set -a; . ./supabase/.env.cli.local; set +a` line in the same terminal first, and check `npm run db:link` succeeded. |
| *Ambil foto* (camera) does nothing | Browsers allow the camera only on `https://` or `localhost`, and the user must allow access. |
