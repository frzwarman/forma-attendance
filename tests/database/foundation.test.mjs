import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

before(async () => {
  db = new PGlite();
  // Minimal Supabase Auth contract; SQL and RLS execute in a real embedded Postgres.
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
  `);
  await db.exec(await readFile(new URL("../../supabase/migrations/20261024000000_workforce_foundation.sql", import.meta.url), "utf8"));
  await db.exec(`
    insert into auth.users values ('${id(1)}'), ('${id(2)}'), ('${id(3)}'), ('${id(4)}');
    insert into public.forma_organizations (id, name) values ('${id(10)}', 'Team A'), ('${id(20)}', 'Team B');
    insert into public.forma_departments (id, organization_id, name) values ('${id(11)}', '${id(10)}', 'Engineering'), ('${id(21)}', '${id(20)}', 'Engineering');
    insert into public.forma_employees (id, organization_id, auth_user_id, name, email, role) values
      ('${id(101)}', '${id(10)}', '${id(1)}', 'Employee A', 'a@example.test', 'employee'),
      ('${id(102)}', '${id(10)}', '${id(2)}', 'Admin A', 'admin@example.test', 'admin'),
      ('${id(103)}', '${id(20)}', '${id(3)}', 'Employee B', 'b@example.test', 'employee'),
      ('${id(104)}', '${id(10)}', '${id(4)}', 'Inactive A', 'inactive@example.test', 'employee');
    update public.forma_employees set active = false where id = '${id(104)}';
    insert into public.forma_shifts (id, organization_id, name, start_time, end_time) values ('${id(31)}', '${id(10)}', 'Regular', '09:00', '18:00');
    insert into public.forma_schedules (id, organization_id, employee_id, shift_id, work_date, scheduled_start, scheduled_end) values
      ('${id(41)}', '${id(10)}', '${id(101)}', '${id(31)}', '2026-10-24', '2026-10-24T02:00Z', '2026-10-24T11:00Z'),
      ('${id(42)}', '${id(10)}', '${id(101)}', '${id(31)}', '2026-10-25', '2026-10-25T02:00Z', '2026-10-25T11:00Z');
    insert into public.forma_attendance_sessions (id, organization_id, employee_id, schedule_id, clock_in, status) values
      ('${id(51)}', '${id(10)}', '${id(101)}', '${id(41)}', '2026-10-24T02:00Z', 'Working');
    insert into public.forma_attendance_events (organization_id, employee_id, session_id, event_type, verification, idempotency_key) values
      ('${id(10)}', '${id(101)}', '${id(51)}', 'in', 'GPS', 'first-punch');
    insert into public.forma_requests (organization_id, employee_id, kind, request_type, attendance_date, requested_time, reason) values
      ('${id(10)}', '${id(101)}', 'correction', 'Forgot to clock in', '2026-10-23', '09:00', 'Missed the clock in yesterday.'),
      ('${id(20)}', '${id(103)}', 'correction', 'Forgot to clock in', '2026-10-23', '09:00', 'Missed the clock in yesterday.');
    insert into public.forma_audit_logs (organization_id, actor_id, action, entity_id) values
      ('${id(10)}', '${id(102)}', 'request.approved', '${id(51)}');
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

test("all 15 application tables have RLS and no direct client write grants", async () => {
  const { rows } = await db.query(`
    select c.relname, c.relrowsecurity,
      has_table_privilege('authenticated', c.oid, 'INSERT') as can_insert,
      has_table_privilege('authenticated', c.oid, 'UPDATE') as can_update,
      has_table_privilege('authenticated', c.oid, 'DELETE') as can_delete,
      has_table_privilege('authenticated', c.oid, 'TRUNCATE') as can_truncate
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'forma_%'
  `);
  assert.equal(rows.length, 15);
  for (const row of rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    for (const flag of ["can_insert", "can_update", "can_delete", "can_truncate"]) assert.equal(row[flag], false, `${row.relname}: ${flag}`);
  }
});

test("employees can read only their own records and organization settings", async () => {
  await asUser(id(1), async () => {
    assert.deepEqual((await db.query("select id from public.forma_employees")).rows, [{ id: id(101) }]);
    assert.deepEqual((await db.query("select id from public.forma_organizations")).rows, [{ id: id(10) }]);
    assert.deepEqual((await db.query("select id from public.forma_departments")).rows, [{ id: id(11) }]);
    assert.equal((await db.query("select * from public.forma_requests")).rows.length, 1);
    assert.equal((await db.query("select * from public.forma_audit_logs")).rows.length, 0);
    assert.equal((await db.query("select * from public.forma_attendance_events")).rows.length, 1);
  });
});

test("administrators can read their organization but cannot read another organization", async () => {
  await asUser(id(2), async () => {
    assert.equal((await db.query("select * from public.forma_employees")).rows.length, 3);
    assert.equal((await db.query("select * from public.forma_requests")).rows.length, 1);
    assert.equal((await db.query("select * from public.forma_audit_logs")).rows.length, 1);
    assert.equal((await db.query("select * from public.forma_organizations where id = $1", [id(20)])).rows.length, 0);
  });
});

test("inactive and unprovisioned Auth users cannot read workforce data", async () => {
  for (const userId of [id(4), id(99), null]) {
    await asUser(userId, async () => {
      for (const table of ["forma_employees", "forma_organizations", "forma_requests", "forma_departments", "forma_audit_logs"]) {
        assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table);
      }
    });
  }
});

test("anonymous callers cannot read tables or execute membership helpers", async () => {
  await assert.rejects(() => asUser(null, () => db.query("select * from public.forma_employees"), "anon"), /permission denied/);
  await assert.rejects(() => asUser(null, () => db.query("select public.forma_is_admin($1)", [id(10)]), "anon"), /permission denied/);
});

test("employees and administrators cannot promote roles or write raw attendance", async () => {
  for (const userId of [id(1), id(2)]) {
    await assert.rejects(() => asUser(userId, () => db.query("update public.forma_employees set role = 'admin'")), /permission denied/);
    await assert.rejects(() => asUser(userId, () => db.query("delete from public.forma_attendance_events")), /permission denied/);
    await assert.rejects(() => asUser(userId, () => db.query("truncate public.forma_audit_logs")), /permission denied/);
  }
});

test("foreign keys prevent cross-organization references and mismatched session owners", async () => {
  await assert.rejects(() => db.query("update public.forma_employees set department_id = $1 where id = $2", [id(21), id(101)]), /foreign key/);
  await assert.rejects(() => db.query("update public.forma_attendance_sessions set employee_id = $1 where id = $2", [id(102), id(51)]), /foreign key/);
});

test("duplicate event retries and simultaneous open sessions are constrained", async () => {
  await assert.rejects(() => db.exec(`
    insert into public.forma_attendance_events (organization_id, employee_id, session_id, event_type, verification, idempotency_key)
    values ('${id(10)}', '${id(101)}', '${id(51)}', 'out', 'GPS', 'first-punch');
  `), /unique constraint/);
  await assert.rejects(() => db.exec(`
    insert into public.forma_attendance_events (organization_id, employee_id, session_id, event_type, verification, idempotency_key)
    values ('${id(10)}', '${id(101)}', '${id(51)}', 'in', 'GPS', 'another-key');
  `), /unique constraint/);
  await assert.rejects(() => db.exec(`
    insert into public.forma_attendance_sessions (organization_id, employee_id, schedule_id, clock_in, status)
    values ('${id(10)}', '${id(101)}', '${id(42)}', '2026-10-25T02:00Z', 'Working');
  `), /unique constraint/);
});

test("invalid request shape, coordinates and reversed clock times are rejected", async () => {
  await assert.rejects(() => db.exec(`
    insert into public.forma_requests (organization_id, employee_id, kind, request_type, reason)
    values ('${id(10)}', '${id(101)}', 'leave', 'Annual leave', 'A planned family vacation.');
  `), /check constraint/);
  await assert.rejects(() => db.exec(`
    insert into public.forma_locations (organization_id, name, latitude, longitude, radius_meters)
    values ('${id(10)}', 'Invalid', 'NaN', 106, 150);
  `), /check constraint/);
  await assert.rejects(() => db.query("update public.forma_attendance_sessions set clock_out = '2026-10-23T02:00Z' where id = $1", [id(51)]), /check constraint/);
});
