# Supabase database setup

The guest book application reads and writes the `guestbook_` tables created by `20261026000000_guestbook.sql` (settings, check-ins, draw winners, admins, two Storage buckets and the check-in and draw RPCs). The earlier `forma_` workforce tables from the first migration remain in place, unused and untouched; the sections below about them are kept for reference.

The initial hosted project is [Forma Workforce](https://supabase.com/dashboard/project/dzzufvejzbhgwiemcxwz), reference `dzzufvejzbhgwiemcxwz`, in Singapore (`ap-southeast-1`). Its first migration is `20261024000000_workforce_foundation.sql`. Public connection settings are saved in the ignored `.env.local`; private CLI database credentials are in the separate ignored `.env.supabase.local`.

The initial migration creates 15 `forma_` tables: organizations, departments, locations, employees, attendance policies, shifts, schedules, attendance sessions, raw attendance events, requests, yearly leave entitlements, approvals, attendance adjustments, notifications, and audit logs. All references involving employees, locations, schedules, and requests are organization-scoped. UUID identifiers replace the demo's `emp-1`/`hq` identifiers.

Every table has Row Level Security and explicit grants. An authenticated employee may read their own records and their organization's settings. HR administrators may read their organization's records and audit logs. Inactive, anonymous, and unprovisioned users cannot read workforce records. **Direct client writes are disabled**, including for HR. Server-validated, transactional write functions are a separate implementation stage; the membership helper functions are not attendance or approval APIs.

No demo employees, fake passwords, photos, or sample attendance are uploaded. Storage buckets are deferred until uploads, retention, and authenticated access are implemented.

## Connect an account and project

The Supabase CLI must be installed. The project uses the host CLI rather than silently downloading a different CLI version through `npx`.

```sh
npm run db:login
```

For the account setup performed from this workspace, the generated database password and project reference are stored in the ignored `.env.supabase.local` file with owner-only permissions. Keep it private. For another checkout, create that file with these fields:

```dotenv
SUPABASE_PROJECT_REF=your_twenty_letter_project_ref
SUPABASE_DB_PASSWORD=your_database_password
```

Then link and inspect the pending migration:

```sh
npm run db:link
npm run db:status
npm run db:plan
```

`db:link` loads the private environment file and lets the CLI use the database password without printing it or embedding it in the command. Supabase CLI account credentials are stored by the CLI, separately from the application's preferences.

## Apply and verify

```sh
npm run db:test
npm run db:push
npm run db:status
npm run db:types
```

`db:plan` is a dry run. `db:push` applies only pending migration files and records their versions. Run it against the intended linked project. Do not use `db reset --linked`, `--include-seed`, or migration-history repair to get around unexpected differences. If an existing remote project has migrations absent locally, reconcile its migration history first.

`db:types` refreshes `src/types/supabase.ts` from the linked hosted schema and preserves the previous file if generation fails. Run it after applying schema changes.

The database tests execute the actual migration using embedded PostgreSQL (PGlite), with a small test substitute for Supabase Auth roles and `auth.uid()`. They verify RLS isolation, denied client writes, cross-organization foreign keys, invalid record rejection, and duplicate punch/open-session constraints. They do not replace testing the hosted Auth, PostgREST, or Storage services.

For a full local Supabase stack, install Docker and run `supabase start`. Seeding is disabled. The local Auth URL is configured for Expo web on port 8081; hosted Auth settings must be configured separately before real sign-in is implemented.

## Provisioning and application integration still required

The trusted provisioning path must create a real organization, its settings, and employee rows linked to actual `auth.users.id` values. Do not identify members by demo IDs or let users assign their own organization or HR role. A Supabase account used for CLI administration is separate from an employee's application login.

Before replacing the mock repository:

1. Implement real Supabase Auth and derive the employee and HR role from database membership. Disable the demo role switcher and demo reset in connected mode. Use SecureStore on native; the existing web token boundary requires a server session design.
2. Implement attendance, request, approval, location, and notification mutations through validated database functions or a trusted server. Use database time, transaction locking, and idempotency checks. A unique constraint alone does not return a successful retry response.
3. Apply approved corrections through adjustment records, preserve raw events, and reconcile approved leave with schedules. Enforce leave-year balances, holidays, overlap checks, shift-specific location requirements, break rules, and overtime policy on the server.
4. Add a Supabase implementation of `WorkforceRepository`, map SQL rows to the current domain types, paginate reads, and remove screen dependencies on demo organization constants.
5. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for that implementation. A publishable key is client configuration, not an employee login or an administrator secret. Never put the database password, CLI token, secret API key, or legacy service-role key in an `EXPO_PUBLIC_` variable.

## Rollback and data preservation

This migration is additive and does not modify existing tables or import local demo storage. The `forma_` prefix avoids reusing unrelated table names; an existing conflicting object makes the migration fail rather than overwrite it. The migration is transactional.

The application remains on the previous demo path, so database setup does not require an application rollback. After successful deployment, leave the unused tables in place if postponing integration. Preserve data and create a reviewed forward migration for any subsequent schema changes. There is deliberately no automatic destructive down migration. Do not delete the applied migration file from version control.

References: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [CLI link and push](https://supabase.com/docs/reference/cli), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
