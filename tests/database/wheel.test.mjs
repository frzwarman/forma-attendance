import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { guestbookDatabase } from "./guestbook-db.mjs";

let db;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const OTHER = id(2);

before(async () => {
  db = await guestbookDatabase();
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${OTHER}');
    insert into public.guestbook_admins (auth_user_id) values ('${ADMIN}');
  `);
});
after(async () => db?.close());
beforeEach(async () => db.exec("delete from public.guestbook_wheel_entries"));

// Runs as a client role; nothing is rolled back, so the list carries over to the next call.
async function as(role, userId, run) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId || ""]);
  await db.exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]?.result;
// Unggah daftar peserta: entries is what the page sends (undefined: SQL null).
const importWheel = (entries, userId = ADMIN) =>
  as("authenticated", userId, () => one("select public.guestbook_wheel_import($1::jsonb) as result", [JSON.stringify(entries) ?? null]));
const spin = (prize, userId = ADMIN) => as("authenticated", userId, () => one("select public.guestbook_wheel_spin($1::text) as result", [prize]));
// What the Undian page reads: the list in file order, through the admin's select.
const wheel = (userId = ADMIN) =>
  as("authenticated", userId, async () => (await db.query("select * from public.guestbook_wheel_entries order by position")).rows);
const shown = async (userId) => (await wheel(userId)).map(({ position, name, note, prize, won_at }) => ({ position, name, note, prize, won_at }));

test("wheel entries: admins read them; a client may set won_at and prize only, never add, remove or rename", async () => {
  const { rows } = await db.query(`
    select c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') as anon_any,
      has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
      has_table_privilege('authenticated', c.oid, 'INSERT') as auth_insert,
      has_table_privilege('authenticated', c.oid, 'DELETE') as auth_delete,
      has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_update_all,
      (select jsonb_object_agg(col, has_column_privilege('authenticated', c.oid, col, 'UPDATE'))
         from unnest(array['position', 'name', 'note', 'prize', 'won_at']) as col) as auth_update_columns
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'guestbook_wheel_entries'
  `);
  assert.deepEqual(rows, [{
    relrowsecurity: true, anon_any: false, auth_select: true, auth_insert: false, auth_delete: true, auth_update_all: false,
    auth_update_columns: { position: false, name: false, note: false, prize: true, won_at: true },
  }]);
});

test("a signed-in non-admin sees no entries and changes none; anonymous visitors are refused", async () => {
  await importWheel([{ name: "Budi" }, { name: "Siti" }]);
  assert.deepEqual(await wheel(OTHER), []);
  const sneaky = await as("authenticated", OTHER, () => db.query("update public.guestbook_wheel_entries set won_at = now(), prize = 'Curang'"));
  assert.equal(sneaky.affectedRows, 0);
  await assert.rejects(as("anon", "", () => db.query("select * from public.guestbook_wheel_entries")), /permission denied/);
  assert.deepEqual((await shown()).map(({ name, won_at, prize }) => [name, won_at, prize]), [["Budi", null, ""], ["Siti", null, ""]]);
});

test("only admins upload the list", async () => {
  await assert.rejects(importWheel([{ name: "Budi" }], OTHER), /Hanya admin yang dapat mengatur undian/);
  await assert.rejects(as("anon", "", () => one(`select public.guestbook_wheel_import('[{"name": "Budi"}]'::jsonb) as result`)), /permission denied/);
  assert.deepEqual(await wheel(), []);
});

test("an upload that is not a list of 1 to 2000 names, or has a blank or over-long name or message, is refused whole and the list stays", async () => {
  await importWheel([{ name: "Tetap" }]);
  for (const [entries, message] of [
    [undefined, /Daftar peserta tidak valid/],
    [null, /Daftar peserta tidak valid/],
    [{ name: "Budi" }, /Daftar peserta tidak valid/],
    ["Budi", /Daftar peserta tidak valid/],
    [[], /Isi 1 sampai 2000 peserta/],
    [Array.from({ length: 2001 }, (_, i) => ({ name: `Peserta ${i + 1}` })), /Isi 1 sampai 2000 peserta/],
    [[{ name: "Budi" }, { name: "  " }], /Nama di baris 2 kosong/],
    [[{ name: "Budi" }, { note: "Tanpa nama" }], /Nama di baris 2 kosong/],
    [[{ name: "Budi" }, { name: null }], /Nama di baris 2 kosong/],
    [[{ name: "x".repeat(121) }], /Nama di baris 1 terlalu panjang \(maksimal 120 karakter\)/],
    [[{ name: "Budi" }, { name: "Siti" }, { name: "Agus", note: "x".repeat(2001) }], /Kesan & pesan di baris 3 terlalu panjang \(maksimal 2000 karakter\)/],
  ])
    await assert.rejects(importWheel(entries), message);
  assert.deepEqual((await shown()).map(({ position, name }) => [position, name]), [[1, "Tetap"]]);
  // The limits themselves pass.
  assert.equal(await importWheel([{ name: "x".repeat(120), note: "y".repeat(2000) }]), 1);
  assert.equal(await importWheel(Array.from({ length: 2000 }, (_, i) => ({ name: `Peserta ${i + 1}` }))), 2000);
});

test("a valid list replaces the one before it, winners included: names and messages trimmed, numbered in file order", async () => {
  assert.equal(await importWheel([{ name: "  Budi Santoso ", note: " Acaranya seru, lanjutkan! " }, { name: "Siti Rahma" }, { name: "Agus Canny", note: null }]), 3);
  assert.deepEqual(await shown(), [
    { position: 1, name: "Budi Santoso", note: "Acaranya seru, lanjutkan!", prize: "", won_at: null },
    { position: 2, name: "Siti Rahma", note: "", prize: "", won_at: null },
    { position: 3, name: "Agus Canny", note: "", prize: "", won_at: null },
  ]);
  assert.equal((await spin("Sepeda")).status, "drawn");
  assert.equal(await importWheel([{ name: "Dewi Lestari" }, { name: "Rudi Hartono" }]), 2);
  assert.deepEqual(await shown(), [
    { position: 1, name: "Dewi Lestari", note: "", prize: "", won_at: null },
    { position: 2, name: "Rudi Hartono", note: "", prize: "", won_at: null },
  ]);
});

test("each spin draws one of the names still on the wheel, with the time and the prize trimmed, until none is left", async () => {
  await importWheel([{ name: "Budi", note: "Seru!" }, { name: "Siti" }, { name: "Agus" }]);
  await assert.rejects(spin("Hadiah", OTHER), /Hanya admin yang dapat mengatur undian/);
  await assert.rejects(as("anon", "", () => one("select public.guestbook_wheel_spin('Hadiah') as result")), /permission denied/);
  await assert.rejects(spin("x".repeat(121)), /Nama hadiah maksimal 120 karakter/);
  assert.deepEqual((await shown()).map((e) => e.won_at), [null, null, null]);

  const drawn = [await spin(" Sepeda "), await spin("x".repeat(120)), await as("authenticated", ADMIN, () => one("select public.guestbook_wheel_spin() as result"))];
  for (const result of drawn) {
    assert.equal(result.status, "drawn");
    assert.deepEqual(Object.keys(result.entry).sort(), ["id", "name", "note", "position", "prize", "won_at"]);
    assert.match(result.entry.won_at, /^\d{4}-\d{2}-\d{2}T/);
  }
  assert.deepEqual(drawn.map((result) => result.entry.name).sort(), ["Agus", "Budi", "Siti"]);
  assert.deepEqual(drawn.map((result) => result.entry.prize), ["Sepeda", "x".repeat(120), ""]);
  assert.deepEqual(await spin("Hadiah 4"), { status: "empty" });
  // The winners stay on the list with what they won; the message travels with the entry.
  const list = await shown();
  for (const { entry } of drawn) {
    const stored = list.find((e) => e.name === entry.name);
    assert.deepEqual([stored.prize, stored.note, stored.won_at.getTime()], [entry.prize, entry.note, new Date(entry.won_at).getTime()], entry.name);
  }
});

test("a winner put back on the wheel (won_at cleared, prize emptied) is drawn again; nothing else about an entry can change", async () => {
  await importWheel([{ name: "Budi" }]);
  const first = await spin("Sepeda");
  assert.equal(first.status, "drawn");
  assert.deepEqual(await spin("Sepeda"), { status: "empty" });
  const putBack = (userId) =>
    as("authenticated", userId, () => db.query("update public.guestbook_wheel_entries set won_at = null, prize = '' where id = $1", [first.entry.id]));
  assert.equal((await putBack(OTHER)).affectedRows, 0);
  assert.equal((await putBack(ADMIN)).affectedRows, 1);
  assert.deepEqual((await shown()).map(({ name, won_at, prize }) => [name, won_at, prize]), [["Budi", null, ""]]);
  const again = await spin("Sepeda");
  assert.equal(again.status, "drawn");
  assert.equal(again.entry.id, first.entry.id);
  // Names, messages and the order come from the uploaded file only; the list is replaced, never edited.
  for (const change of ["name = 'Curang'", "note = 'x'", "position = 9"])
    await assert.rejects(as("authenticated", ADMIN, () => db.query(`update public.guestbook_wheel_entries set ${change} where id = $1`, [first.entry.id])), /permission denied/);
  // Hapus on the list: only an admin deletes a row, and only by its id (safeupdate refuses a bare delete).
  await assert.rejects(as("anon", "", () => db.query("delete from public.guestbook_wheel_entries where id = $1", [first.entry.id])), /permission denied/);
  assert.equal((await as("authenticated", OTHER, () => db.query("delete from public.guestbook_wheel_entries where id = $1", [first.entry.id]))).affectedRows, 0);
  await assert.rejects(as("authenticated", ADMIN, () => db.query("insert into public.guestbook_wheel_entries (position, name) values (2, 'Tambahan')")), /permission denied/);
  assert.deepEqual((await shown()).map(({ name, prize }) => [name, prize]), [["Budi", "Sepeda"]]);
  assert.equal((await as("authenticated", ADMIN, () => db.query("delete from public.guestbook_wheel_entries where id = $1", [first.entry.id]))).affectedRows, 1);
  assert.deepEqual(await shown(), []);
});
