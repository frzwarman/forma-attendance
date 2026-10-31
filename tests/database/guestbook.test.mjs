import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { guestbookDatabase } from "./guestbook-db.mjs";

let db;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

before(async () => {
  db = await guestbookDatabase();
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

test("checking in again with the same phone or e-mail is welcomed and recorded on the one row", async () => {
  const first = await asRole(null, "anon", () => checkIn());
  assert.equal(first.status, "created");
  assert.equal(typeof first.created_at, "string");
  const second = await asRole(null, "anon", () => checkIn({ name: "Orang Lain", phone: "+62 812-1111-2222", email: "lain@example.test" }));
  assert.equal(second.status, "returning");
  assert.equal(second.created_at, first.created_at);
  assert.equal(typeof second.last_checked_in_at, "string");
  assert.equal(second.checkout_token, undefined);
  const third = await asRole(null, "anon", () => checkIn({ name: " budi santoso ", phone: "0813 0000 0000", email: "BUDI@example.test" }));
  assert.equal(third.status, "returning");
  // The stored name typed again: a check-out code for this visit. Another name gets none.
  assert.match(third.checkout_token, /^[0-9a-f-]{36}$/);
  await assert.rejects(() => asUser(null, () => db.query("select * from public.guestbook_checkins"), "anon"), /permission denied/);
  await asUser(id(1), async () => {
    // The stored details stay: typing someone's number does not rename them.
    const { rows } = await db.query("select name, phone, email, checkin_count, last_checked_in_at is not null as again from public.guestbook_checkins");
    assert.deepEqual(rows, [{ name: "Budi Santoso", phone: "0812 1111 2222", email: "budi@example.test", checkin_count: 3, again: true }]);
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
    { id: "guestbook-event", public: true, limit: 20971520 },
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
  await assert.rejects(() => asUser(null, () => insert("guestbook-event", "docs/a/1.jpg"), "anon"), /policy/);
  await assert.rejects(() => asUser(id(2), () => insert("guestbook-event", "docs/a/1.jpg")), /policy/);
  await asUser(id(1), async () => {
    await insert("guestbook-uploads", "checkins/b.jpg");
    await insert("guestbook-brand", "logo.png");
    await insert("guestbook-event", "docs/a/1.jpg");
    assert.equal((await db.query("select * from storage.objects")).rows.length, 3);
  });
  // Event pages are public, like the brand images.
  await asUser(null, async () => {
    await db.exec("set local role postgres");
    await insert("guestbook-event", "docs/b/1.jpg");
    await db.exec("set local role anon");
    assert.deepEqual((await db.query("select name from storage.objects")).rows, [{ name: "docs/b/1.jpg" }]);
  }, "anon");
});

test("the event information is public, only admins change it, and it must be a small JSON object", async () => {
  const content = { mentimeter_url: null, rundown: null, speakers: [], materials: [] };
  const update = (value) => db.query("update public.guestbook_settings set event_content = $1::jsonb", [value]);
  await asUser(id(2), async () => assert.equal((await update(JSON.stringify(content))).affectedRows, 0));
  await assert.rejects(() => asUser(null, () => update(JSON.stringify(content)), "anon"), /permission denied/);
  await asUser(id(1), async () => {
    assert.equal((await update(JSON.stringify(content))).affectedRows, 1);
    await asRole(null, "anon", async () => {
      assert.deepEqual((await db.query("select event_content from public.guestbook_settings")).rows[0].event_content, content);
    });
  });
  await assert.rejects(() => asUser(id(1), () => update("[]")), /check/);
  await assert.rejects(() => asUser(id(1), () => update(JSON.stringify({ text: "x".repeat(200001) }))), /check/);
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

test("a check-in without dates gets today's Jakarta date and no check-out yet", async () => {
  const result = await asRole(null, "anon", () =>
    checkIn({ name: "Tono Wibowo", phone: "0821 1000 6000", email: "tono@example.test", in: null, out: null }),
  );
  assert.equal(result.status, "created");
  await asUser(id(1), async () => {
    const { rows } = await db.query(
      "select check_in_date = (now() at time zone 'Asia/Jakarta')::date as today, check_out_date from public.guestbook_checkins where email = 'tono@example.test'",
    );
    assert.deepEqual(rows, [{ today: true, check_out_date: null }]);
  });
});

// Named arguments, as PostgREST calls the function. The form no longer asks for an address.
async function checkInNamed({ email, phone, room = null, address = null }) {
  const { rows } = await db.query(
    `select public.guestbook_check_in(p_name => 'Tamu Hotel', p_phone => $1, p_email => $2, p_jabatan => null,
       p_address => $4, p_latitude => null, p_longitude => null, p_file_path => null,
       p_check_in_date => null, p_check_out_date => null, p_room_number => $3) as result`,
    [phone, email, room, address],
  );
  return rows[0].result;
}

test("the hotel room number and the address are optional; a room is trimmed and at most 20 characters", async () => {
  const given = await asRole(null, "anon", () => checkInNamed({ email: "kamar1@example.test", phone: "0821 2000 1000", room: "  1205 " }));
  const blank = await asRole(null, "anon", () => checkInNamed({ email: "kamar2@example.test", phone: "0821 2000 2000", room: "   ", address: "  " }));
  // An older client sends an address and no p_room_number at all.
  const older = await asRole(null, "anon", () => checkIn({ name: "Tamu Lama", phone: "0821 2000 3000", email: "kamar3@example.test" }));
  for (const result of [given, blank, older]) assert.equal(result.status, "created");
  await assert.rejects(
    () => asUser(null, () => checkInNamed({ email: "kamar4@example.test", phone: "0821 2000 4000", room: "x".repeat(21) }), "anon"),
    /Nomor kamar/,
  );
  await assert.rejects(
    () => asUser(null, () => checkInNamed({ email: "kamar5@example.test", phone: "0821 2000 5000", address: "x".repeat(401) }), "anon"),
    /Alamat/,
  );
  await asUser(id(1), async () => {
    const { rows } = await db.query(
      "select email, room_number, address from public.guestbook_checkins where email like 'kamar%@example.test' order by email",
    );
    assert.deepEqual(rows, [
      { email: "kamar1@example.test", room_number: "1205", address: null },
      { email: "kamar2@example.test", room_number: null, address: null },
      { email: "kamar3@example.test", room_number: null, address: "Jl. MH Thamrin 14" },
    ]);
  });
});

test("the division is stored trimmed, at most 120 characters, and optional for older clients", async () => {
  const named = (email, phone, divisi) =>
    db.query(
      `select public.guestbook_check_in(p_name => 'Tamu Divisi', p_phone => $1, p_email => $2, p_jabatan => null,
         p_address => null, p_latitude => null, p_longitude => null, p_file_path => null,
         p_check_in_date => null, p_check_out_date => null, p_divisi => $3) as result`,
      [phone, email, divisi],
    );
  await asRole(null, "anon", () => named("divisi1@example.test", "0821 3000 1000", "  Divisi Hukum "));
  await asRole(null, "anon", () => checkIn({ name: "Tamu Lama", phone: "0821 3000 2000", email: "divisi2@example.test" }));
  await assert.rejects(() => asUser(null, () => named("divisi3@example.test", "0821 3000 3000", "x".repeat(121)), "anon"), /Divisi/);
  await asUser(id(1), async () => {
    const { rows } = await db.query("select email, divisi from public.guestbook_checkins where email like 'divisi%@example.test' order by email");
    assert.deepEqual(rows, [
      { email: "divisi1@example.test", divisi: "Divisi Hukum" },
      { email: "divisi2@example.test", divisi: null },
    ]);
  });
});

test("answers to added questions are stored as label -> text, and anything else is refused", async () => {
  const named = (email, phone, answers) =>
    db.query(
      `select public.guestbook_check_in(p_name => 'Tamu Pertanyaan', p_phone => $1, p_email => $2, p_jabatan => null,
         p_address => null, p_latitude => null, p_longitude => null, p_file_path => null,
         p_check_in_date => null, p_check_out_date => null, p_answers => $3::jsonb) as result`,
      [phone, email, answers === undefined ? null : JSON.stringify(answers)],
    );
  await asRole(null, "anon", () => named("jawab1@example.test", "0821 4000 1000", { "Ukuran kaos": "M", "Asal instansi": "Bawaslu Jabar" }));
  await asRole(null, "anon", () => named("jawab2@example.test", "0821 4000 2000", {}));
  for (const [n, answers] of [
    [3, ["M"]],
    [4, { "Ukuran kaos": 3 }],
    [5, { "Catatan": "x".repeat(1001) }],
    [6, { "": "kosong" }],
    [7, Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`P${i}`, "ya"]))],
  ])
    await assert.rejects(() => asUser(null, () => named(`jawab${n}@example.test`, `0821 4000 ${n}000`, answers), "anon"), /Jawaban tidak valid/);
  await asUser(id(1), async () => {
    const { rows } = await db.query("select email, answers from public.guestbook_checkins where email like 'jawab%@example.test' order by email");
    assert.deepEqual(rows, [
      { email: "jawab1@example.test", answers: { "Ukuran kaos": "M", "Asal instansi": "Bawaslu Jabar" } },
      { email: "jawab2@example.test", answers: null },
    ]);
  });
});

test("the form's questions are public, only admins change them, and they must be a JSON array", async () => {
  const fields = [{ id: "f_kaos", label: "Ukuran kaos", type: "select", required: true, options: ["S", "M"] }];
  const update = (value) => db.query("update public.guestbook_settings set form_fields = $1::jsonb", [value]);
  await asUser(id(2), async () => assert.equal((await update(JSON.stringify(fields))).affectedRows, 0));
  await assert.rejects(() => asUser(null, () => update(JSON.stringify(fields)), "anon"), /permission denied/);
  await asUser(id(1), async () => {
    assert.equal((await update(JSON.stringify(fields))).affectedRows, 1);
    assert.deepEqual((await db.query("select form_fields from public.guestbook_settings")).rows[0].form_fields, fields);
  });
  await assert.rejects(() => asUser(id(1), () => update("{}")), /check/);
});

test("a check-in returns a check-out code that checks the attendee out once", async () => {
  const wati = { name: "Wati Lestari", phone: "0821 1000 7000", email: "wati@example.test", in: null, out: null };
  const created = await asRole(null, "anon", () => checkIn(wati));
  assert.equal(created.status, "created");
  assert.match(created.checkout_token, /^[0-9a-f-]{36}$/);
  const checkOut = async (token) => (await db.query("select public.guestbook_check_out($1) as r", [token])).rows[0].r;
  const first = await asRole(null, "anon", () => checkOut(created.checkout_token));
  assert.equal(first.status, "checked_out");
  assert.equal(first.name, "Wati Lestari");
  assert.equal(typeof first.checked_out_at, "string");
  const again = await asRole(null, "anon", () => checkOut(created.checkout_token));
  assert.deepEqual(again, { ...first, status: "already" });
  await assert.rejects(() => asUser(null, () => checkOut("00000000-0000-4000-8000-000000000000"), "anon"), /tidak dikenal/);
  await asUser(id(1), async () => {
    const { rows } = await db.query(
      "select checked_out_at is not null as out, checkout_token_hash <> $1 as hashed from public.guestbook_checkins where email = 'wati@example.test'",
      [created.checkout_token],
    );
    assert.deepEqual(rows, [{ out: true, hashed: true }]);
  });
  // Back for the next session: present again, with a new code that replaces the old one.
  const repeat = await asRole(null, "anon", () => checkIn(wati));
  assert.equal(repeat.status, "returning");
  assert.notEqual(repeat.checkout_token, created.checkout_token);
  await asUser(id(1), async () => {
    const { rows } = await db.query("select checked_out_at, checkin_count from public.guestbook_checkins where email = 'wati@example.test'");
    assert.deepEqual(rows, [{ checked_out_at: null, checkin_count: 2 }]);
  });
  await assert.rejects(() => asUser(null, () => checkOut(created.checkout_token), "anon"), /tidak dikenal/);
  assert.equal((await asRole(null, "anon", () => checkOut(repeat.checkout_token))).status, "checked_out");
});

test("admins check out one attendee, undo it, and check out everyone still present", async () => {
  const adminCheckOut = (checkin, undo = false) => db.query("select public.guestbook_admin_check_out($1, $2) as at", [checkin, undo]);
  const target = (await asUser(id(1), () => db.query("select id from public.guestbook_checkins where email = 'dewi@example.test'"))).rows[0].id;
  await assert.rejects(() => asUser(id(2), () => adminCheckOut(target)), /admin/);
  await assert.rejects(() => asUser(null, () => adminCheckOut(target), "anon"), /permission denied/);
  await asUser(id(1), async () => {
    assert.ok((await adminCheckOut(target)).rows[0].at);
    assert.equal((await adminCheckOut(target, true)).rows[0].at, null);
    const open = Number((await db.query("select count(*) from public.guestbook_checkins where checked_out_at is null")).rows[0].count);
    assert.ok(open > 1);
    assert.equal((await db.query("select public.guestbook_check_out_all() as n")).rows[0].n, open);
    assert.equal(Number((await db.query("select count(*) from public.guestbook_checkins where checked_out_at is null")).rows[0].count), 0);
  });
});

test("the demo seed adds 48 attendees, about half checked out, hotel rooms for 36, three winners; it is repeatable and removable", async () => {
  const seed = await readFile(new URL("../../supabase/seed/demo-checkins.sql", import.meta.url), "utf8");
  const remove = await readFile(new URL("../../supabase/seed/remove-demo-checkins.sql", import.meta.url), "utf8");
  const counts = async () =>
    (
      await db.query(`
        select count(*)::int as checkins, count(checked_out_at)::int as out, count(room_number)::int as rooms,
          (select count(*)::int from public.guestbook_draw_winners w
             join public.guestbook_checkins c on c.id = w.checkin_id
            where c.email_key like '%@example.com') as winners
        from public.guestbook_checkins where email_key like '%@example.com'`)
    ).rows[0];
  const before = (await db.query("select count(*)::int as n from public.guestbook_checkins")).rows[0].n;
  await db.exec(seed);
  const first = await counts();
  assert.equal(first.checkins, 48);
  assert.ok(first.out >= 15 && first.out <= 30, `checked out: ${first.out}`);
  assert.equal(first.winners, 3);
  assert.equal(first.rooms, 36);
  await db.exec(seed);
  assert.deepEqual(await counts(), first);
  await db.exec(remove);
  assert.deepEqual(await counts(), { checkins: 0, out: 0, rooms: 0, winners: 0 });
  assert.equal((await db.query("select count(*)::int as n from public.guestbook_checkins")).rows[0].n, before);
});

test("check-ins are copied to the Google Sheet: added, updated, deleted, and nothing before it is set up", async () => {
  const sent = async () => (await db.query("select body from net.sent order by id")).rows.map((row) => row.body);
  const cells = (row) => Object.fromEntries(row.cells);
  await db.exec("delete from net.sent");
  const sari = { name: "Sari Dewi", phone: "0899 3000 4000", email: "sari.sheet@example.test", in: null, out: null };
  await asRole(null, "anon", () => checkIn(sari));
  assert.deepEqual(await sent(), []);

  // Closed to attendees and admins; a URL that is not an Apps Script web app is refused.
  await assert.rejects(() => asUser(id(1), () => db.query("select * from private.guestbook_sheet")), /permission denied/);
  await assert.rejects(() => asUser(null, () => db.query("select private.guestbook_sheet_resend()"), "anon"), /permission denied/);
  await assert.rejects(() => db.query("insert into private.guestbook_sheet (url, secret) values ('https://example.com/x', $1)", ["s".repeat(32)]), /check/);
  await db.query("insert into private.guestbook_sheet (url, secret) values ('https://script.google.com/a/macros/pensieve.id/s/AKfy_1/exec', $1)", ["s".repeat(32)]);
  await db.exec("delete from private.guestbook_sheet");
  const url = "https://script.google.com/macros/s/AKfycbx-test_123/exec";
  await db.query("insert into private.guestbook_sheet (url, secret) values ($1, $2)", [url, "s".repeat(32)]);

  await asRole(null, "anon", () => checkIn({ name: "Tono Wijaya", phone: "0899 5000 6000", email: "tono.sheet@example.test", in: null, out: null }));
  let [request] = await sent();
  assert.equal(request.secret, "s".repeat(32));
  assert.equal(request.rows.length, 1);
  const tono = request.rows[0];
  assert.deepEqual(tono.cells.map(([header]) => header), [
    "Waktu Check-in (WIB)", "Check-in Terakhir (WIB)", "Jumlah Check-in", "Waktu Check-out (WIB)", "Nama", "Nomor Telepon", "E-mail",
    "Divisi", "Nomor Kamar Hotel", "Berkas", "Hadiah", "Waktu Undian (WIB)",
  ]);
  assert.match(cells(tono)["Waktu Check-in (WIB)"], /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/);
  assert.equal(cells(tono)["Nomor Telepon"], "0899 5000 6000");
  assert.equal(cells(tono)["Jumlah Check-in"], "1");
  assert.equal(cells(tono)["Check-in Terakhir (WIB)"], "");

  // Checking in again and checking out update the same row, matched by ID.
  await db.exec("delete from net.sent");
  const repeat = await asRole(null, "anon", () => checkIn({ name: "Tono Wijaya", phone: "0899 5000 6000", email: "tono.sheet@example.test", in: null, out: null }));
  await asRole(null, "anon", () => db.query("select public.guestbook_check_out($1)", [repeat.checkout_token]));
  const [again, out] = await sent();
  assert.equal(again.rows[0].id, tono.id);
  assert.equal(cells(again.rows[0])["Jumlah Check-in"], "2");
  assert.match(cells(out.rows[0])["Waktu Check-out (WIB)"], /WIB$/);

  // A prize shows on the winner's row.
  await db.exec("delete from net.sent");
  await db.query("insert into public.guestbook_draw_winners (checkin_id, prize) values ($1, 'Sepeda')", [tono.id]);
  [request] = await sent();
  assert.equal(cells(request.rows[0])["Hadiah"], "Sepeda");

  // Check out semua: one statement, every changed row in requests of at most 100.
  await db.exec("delete from net.sent");
  const open = (await db.query("select count(*)::int as n from public.guestbook_checkins where checked_out_at is null")).rows[0].n;
  await asRole(id(1), "authenticated", () => db.query("select public.guestbook_check_out_all()"));
  const all = await sent();
  assert.equal(all.flatMap((body) => body.rows).length, open);
  assert.ok(all.every((body) => body.rows.length <= 100));

  // Resending sends every check-in; a deleted one is removed from the sheet.
  await db.exec("delete from net.sent");
  const total = (await db.query("select private.guestbook_sheet_resend() as n")).rows[0].n;
  assert.equal((await sent()).flatMap((body) => body.rows).length, total);
  await db.exec("delete from net.sent");
  await db.query("delete from public.guestbook_checkins where email = 'tono.sheet@example.test'");
  assert.deepEqual((await sent()).map((body) => body.delete).filter(Boolean), [[tono.id]]);

  // A failing send never blocks a check-in.
  await db.exec(`alter function net.http_post(text, jsonb, jsonb, jsonb, int) rename to http_post_ok;
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
    returns bigint language plpgsql as $$ begin raise exception 'down'; end $$;`);
  try {
    const result = await asRole(null, "anon", () => checkIn({ name: "Rina Putri", phone: "0899 7000 8000", email: "rina.sheet@example.test", in: null, out: null }));
    assert.equal(result.status, "created");
  } finally {
    await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, int);
      alter function net.http_post_ok(text, jsonb, jsonb, jsonb, int) rename to http_post;
      delete from private.guestbook_sheet;`);
  }
});
