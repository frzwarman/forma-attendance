import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

before(async () => {
  db = new PGlite();
  // Minimal Supabase Auth and Storage contracts; SQL and RLS execute in a real embedded Postgres.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid, created_at timestamptz default now());
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    $$;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.buckets, storage.objects to anon, authenticated;
  `);
  for (const migration of ["20261026000000_guestbook.sql", "20261026120000_guestbook_optional_jabatan.sql"]) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await db.exec(`
    insert into auth.users values ('${id(1)}'), ('${id(2)}');
    insert into public.guestbook_admins (auth_user_id) values ('${id(1)}');
  `);
});
after(async () => db?.close());

async function asUser(userId, run, role = "authenticated") {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || ""]);
    await db.exec(`set local role ${role}`);
    return await run();
  } finally {
    await db.exec("rollback");
  }
}
// Rows created by the check-in RPC must outlive the test transaction, so these run without rollback.
async function asRole(userId, role, run) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId || ""]);
  await db.exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const defaults = {
  name: "Budi Santoso", phone: "0812 1111 2222", email: "budi@example.test", jabatan: "Staf",
  address: "Jl. MH Thamrin 14", latitude: null, longitude: null, file: null,
  in: "2026-11-02", out: "2026-11-04", honeypot: null,
};
async function checkIn(overrides = {}) {
  const v = { ...defaults, ...overrides };
  const { rows } = await db.query(
    "select public.guestbook_check_in($1, $2, $3, $4, $5, $6::double precision, $7::double precision, $8, $9::date, $10::date, $11) as result",
    [v.name, v.phone, v.email, v.jabatan, v.address, v.latitude, v.longitude, v.file, v.in, v.out, v.honeypot],
  );
  return rows[0].result;
}
const draw = async (prize = "Hadiah") => (await db.query("select public.guestbook_draw_winner($1) as result", [prize])).rows[0].result;

test("guestbook tables have RLS and no direct client writes", async () => {
  const { rows } = await db.query(`
    select c.relname, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
      has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
      has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
      has_table_privilege('authenticated', c.oid, 'INSERT') as auth_insert,
      has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_update
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'guestbook_%' order by 1
  `);
  assert.deepEqual(rows.map((r) => r.relname), ["guestbook_admins", "guestbook_checkins", "guestbook_draw_winners", "guestbook_settings"]);
  for (const row of rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    for (const flag of ["anon_insert", "anon_update", "anon_delete"]) assert.equal(row[flag], false, `${row.relname}: ${flag}`);
  }
  const byName = Object.fromEntries(rows.map((r) => [r.relname, r]));
  for (const table of ["guestbook_checkins", "guestbook_admins"]) {
    assert.equal(byName[table].auth_insert, false, table);
    assert.equal(byName[table].auth_update, false, table);
  }
});

test("phone keys normalise formatting and the +62 prefix", async () => {
  for (const input of ["+62 812-3456-7890", "62812 3456 7890", "0812-3456-7890", "(0812) 34567890"]) {
    assert.equal((await db.query("select public.guestbook_phone_key($1) as k", [input])).rows[0].k, "081234567890", input);
  }
  assert.equal((await db.query("select public.guestbook_phone_key($1) as k", ["+1 415 555 0100"])).rows[0].k, "14155550100");
});

test("anonymous check-in succeeds once and reports the duplicate's time", async () => {
  const first = await asRole(null, "anon", () => checkIn());
  assert.equal(first.status, "created");
  assert.equal(typeof first.created_at, "string");
  const second = await asRole(null, "anon", () => checkIn({ phone: "+62 812-1111-2222", email: "lain@example.test" }));
  assert.deepEqual(second, { status: "duplicate", created_at: first.created_at });
  const third = await asRole(null, "anon", () => checkIn({ phone: "0813 0000 0000", email: "BUDI@example.test" }));
  assert.equal(third.status, "duplicate");
  await assert.rejects(() => asUser(null, () => db.query("select * from public.guestbook_checkins"), "anon"), /permission denied/);
  await asUser(id(1), async () => {
    const { rows } = await db.query("select phone from public.guestbook_checkins");
    assert.deepEqual(rows, [{ phone: "0812 1111 2222" }]);
  });
});

test("the check-in function rejects invalid input", async () => {
  const cases = [
    [{ honeypot: "x" }, /spam/],
    [{ in: "2026-11-02", out: "2026-11-01" }, /check out/],
    [{ name: "A" }, /Nama/],
    [{ email: "bad" }, /E-mail/],
    [{ phone: "12" }, /telepon/],
    [{ file: "other/x.jpg" }, /Berkas/],
  ];
  for (const [overrides, expected] of cases) {
    await assert.rejects(() => asUser(null, () => checkIn({ ...overrides, phone: overrides.phone ?? "0819 9999 9999", email: overrides.email ?? "new@example.test" }), "anon"), expected);
  }
  await asUser(id(1), async () => {
    assert.equal((await db.query("select count(*)::int as n from public.guestbook_checkins")).rows[0].n, 1);
  });
});

test("only admins read check-ins, settings are public, and only admins update settings", async () => {
  await asUser(id(2), async () => {
    assert.equal((await db.query("select * from public.guestbook_checkins")).rows.length, 0);
    assert.equal((await db.query("update public.guestbook_settings set event_name = 'X'")).affectedRows, 0);
    await assert.rejects(() => draw(), /admin/);
  });
  await asUser(id(1), async () => {
    assert.equal((await db.query("select * from public.guestbook_checkins")).rows.length, 1);
    assert.equal((await db.query("update public.guestbook_settings set event_name = 'Rakernas'")).affectedRows, 1);
    assert.equal((await db.query("select event_name from public.guestbook_settings")).rows[0].event_name, "Rakernas");
  });
  await asUser(null, async () => {
    assert.equal((await db.query("select event_name from public.guestbook_settings")).rows[0].event_name, "Buku Tamu");
    await assert.rejects(() => db.query("update public.guestbook_settings set event_name = 'X'"), /permission denied/);
  }, "anon");
});

test("draws pick each attendee at most once and only for admins", async () => {
  await asRole(null, "anon", () => checkIn({ name: "Siti Rahma", phone: "0813 2222 3333", email: "siti@example.test" }));
  await asRole(null, "anon", () => checkIn({ name: "Agus Wijaya", phone: "0815 4444 5555", email: "agus@example.test" }));
  await asUser(id(1), async () => {
    const results = [await draw("Hadiah 1"), await draw("Hadiah 2"), await draw("Hadiah 3")];
    for (const r of results) {
      assert.equal(r.status, "drawn");
      assert.equal(typeof r.checkin.name, "string");
      assert.equal(r.winner.checkin_id, r.checkin.id);
    }
    assert.equal(new Set(results.map((r) => r.winner.checkin_id)).size, 3);
    assert.deepEqual(await draw(), { status: "empty" });
    const removed = results[1];
    assert.equal((await db.query("delete from public.guestbook_draw_winners where id = $1", [removed.winner.id])).affectedRows, 1);
    const again = await draw("Hadiah 2");
    assert.equal(again.winner.checkin_id, removed.winner.checkin_id);
  });
});

test("storage policies allow anonymous uploads only into checkins/ and admin reads", async () => {
  const { rows: buckets } = await db.query("select id, public, file_size_limit::int as limit from storage.buckets where id like 'guestbook-%' order by id");
  assert.deepEqual(buckets, [
    { id: "guestbook-brand", public: true, limit: 5242880 },
    { id: "guestbook-uploads", public: false, limit: 5242880 },
  ]);
  const insert = (bucket, name) => db.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);
  // A rejected statement aborts the transaction, so each rejection gets its own session.
  await asUser(null, async () => {
    await insert("guestbook-uploads", "checkins/a.jpg");
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
  }, "anon");
  await assert.rejects(() => asUser(null, () => insert("guestbook-uploads", "other/a.jpg"), "anon"), /policy/);
  await assert.rejects(() => asUser(null, () => insert("guestbook-brand", "logo.png"), "anon"), /policy/);
  await asUser(id(2), async () => {
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
  });
  await assert.rejects(() => asUser(id(2), () => insert("guestbook-brand", "logo.png")), /policy/);
  await asUser(id(1), async () => {
    await insert("guestbook-uploads", "checkins/b.jpg");
    await insert("guestbook-brand", "logo.png");
    assert.equal((await db.query("select * from storage.objects")).rows.length, 2);
  });
});

// Runs last: it leaves rows behind that earlier tests would otherwise count.
test("jabatan is optional: missing or blank values are stored as null and long ones are refused", async () => {
  const given = await asRole(null, "anon", () => checkIn({ name: "Dewi Lestari", phone: "0821 1000 2000", email: "dewi@example.test", jabatan: "Kepala Bagian" }));
  const missing = await asRole(null, "anon", () => checkIn({ name: "Rudi Hartono", phone: "0821 1000 3000", email: "rudi@example.test", jabatan: null }));
  const blank = await asRole(null, "anon", () => checkIn({ name: "Nina Sari", phone: "0821 1000 4000", email: "nina@example.test", jabatan: "   " }));
  for (const result of [given, missing, blank]) assert.equal(result.status, "created");
  await assert.rejects(
    () => asUser(null, () => checkIn({ phone: "0821 1000 5000", email: "panjang@example.test", jabatan: "x".repeat(121) }), "anon"),
    /Jabatan/,
  );
  await asUser(id(1), async () => {
    const { rows } = await db.query(
      "select email, jabatan from public.guestbook_checkins where email in ('dewi@example.test', 'rudi@example.test', 'nina@example.test') order by email",
    );
    assert.deepEqual(rows, [
      { email: "dewi@example.test", jabatan: "Kepala Bagian" },
      { email: "nina@example.test", jabatan: null },
      { email: "rudi@example.test", jabatan: null },
    ]);
  });
});
