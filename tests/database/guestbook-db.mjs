import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrations = new URL("../../supabase/migrations/", import.meta.url);

// Embedded Postgres with minimal Supabase Auth and Storage contracts and every
// guestbook migration applied in order. Used by the tests and the demo export.
export async function guestbookDatabase() {
  const db = new PGlite();
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
    -- pg_net: http_post only queues the request, here into net.sent for the tests to read.
    create schema net;
    create table net.sent (id bigserial primary key, url text, body jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
    returns bigint language sql as $$ insert into net.sent (url, body) values (url, body) returning id $$;
  `);
  const files = (await readdir(migrations)).filter((name) => /^\d+_guestbook.*\.sql$/.test(name)).sort();
  for (const name of files) {
    // PGlite has no pg_net extension; the stand-in above takes its place.
    const sql = (await readFile(new URL(name, migrations), "utf8")).replace("create extension if not exists pg_net with schema extensions;", "");
    await db.exec(sql);
  }
  return db;
}
