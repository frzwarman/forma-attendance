import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { guestbookDatabase } from "./guestbook-db.mjs";

let db;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const OTHER = id(2);
// A phone's E-Vote ID: 16 random bytes as hex.
const device = (n) => n.toString(16).padStart(32, "0");

before(async () => {
  db = await guestbookDatabase();
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${OTHER}');
    insert into public.guestbook_admins (auth_user_id) values ('${ADMIN}');
  `);
});
after(async () => db?.close());
beforeEach(async () => db.exec("delete from public.guestbook_ballots; delete from public.guestbook_polls;"));

// Runs as a client role; nothing is rolled back, so polls and ballots carry over to the next call.
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
const savePoll = (options, maxPicks, userId = ADMIN) =>
  as("authenticated", userId, () => one("select public.guestbook_save_poll($1::text[], $2::int) as result", [options, maxPicks]));
const closePoll = (userId = ADMIN) => as("authenticated", userId, () => one("select public.guestbook_close_poll() as result"));
const results = (userId = ADMIN) => as("authenticated", userId, () => one("select public.guestbook_poll_results() as result"));
const vote = (pollId, deviceId, picks) =>
  as("anon", "", () => one("select public.guestbook_cast_ballot($1::uuid, $2::text, $3::int[]) as result", [pollId, deviceId, picks]));
// What the vote page reads: the latest poll, through the public select.
const currentPoll = () => as("anon", "", async () => (await db.query("select * from public.guestbook_polls order by created_at desc limit 1")).rows[0]);
// The job pg_cron runs every 10 seconds: sends the votes cast since its last run.
const sendQueued = async () => (await db.query("select private.guestbook_sheet_send_queued_votes() as n")).rows[0].n;
const ballotCount = async () => Number((await db.query("select count(*) as n from public.guestbook_ballots")).rows[0].n);

test("E-Vote tables: anyone reads the vote's options, nobody reads ballots or writes either table directly", async () => {
  const { rows } = await db.query(`
    select c.relname, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
      has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
      has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') as anon_write,
      has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE') or has_table_privilege('authenticated', c.oid, 'DELETE') as auth_write
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('guestbook_polls', 'guestbook_ballots') order by 1
  `);
  assert.deepEqual(rows, [
    { relname: "guestbook_ballots", relrowsecurity: true, anon_select: false, auth_select: false, anon_write: false, auth_write: false },
    { relname: "guestbook_polls", relrowsecurity: true, anon_select: true, auth_select: true, anon_write: false, auth_write: false },
  ]);
});

test("only admins save, close and see the results", async () => {
  await assert.rejects(savePoll(["Round table", "Classroom"], 1, OTHER), /Hanya admin/);
  await assert.rejects(as("anon", "", () => one("select public.guestbook_save_poll($1::text[], 1) as result", [["A", "B"]])));
  await savePoll(["Round table", "Classroom"], 1);
  await assert.rejects(closePoll(OTHER), /Hanya admin/);
  await assert.rejects(results(OTHER), /Hanya admin/);
  await assert.rejects(as("anon", "", () => one("select public.guestbook_poll_results() as result")));
  assert.equal((await currentPoll()).is_open, true);
});

test("saving opens a vote with the options trimmed, which the public page reads", async () => {
  const poll = await savePoll([" Round table ", "Classroom"], 1);
  assert.deepEqual(poll.options, ["Round table", "Classroom"]);
  assert.equal(poll.max_picks, 1);
  assert.equal(poll.is_open, true);
  const current = await currentPoll();
  assert.equal(current.id, poll.id);
  assert.deepEqual(current.options, ["Round table", "Classroom"]);
});

test("saving refuses blank, repeated, too few, too many or over-long options and an impossible number of picks", async () => {
  const twentyOne = Array.from({ length: 21 }, (_, i) => `Pilihan ${i + 1}`);
  for (const [options, maxPicks] of [
    [["Round table"], 1],
    [null, 1],
    [["Round table", "  "], 1],
    [["Round table", "round table "], 1],
    [twentyOne, 1],
    [["x".repeat(121), "Classroom"], 1],
    [["Round table", "Classroom"], 0],
    [["Round table", "Classroom"], 3],
    [["Round table", "Classroom"], null],
  ])
    await assert.rejects(savePoll(options, maxPicks), `${JSON.stringify(options)?.slice(0, 40)} / ${maxPicks}`);
  assert.equal(await currentPoll(), undefined);
  const twenty = twentyOne.slice(0, 20);
  assert.equal((await savePoll(twenty, 20)).options.length, 20);
});

test("a phone votes once per vote: a second ballot from it is not counted and gets its first picks back", async () => {
  const poll = await savePoll(["Round table", "Classroom"], 1);
  assert.deepEqual(await vote(poll.id, device(1), [0]), { status: "recorded", picks: [0] });
  assert.deepEqual(await vote(poll.id, device(1), [1]), { status: "already", picks: [0] });
  assert.deepEqual(await vote(poll.id, device(2), [1]), { status: "recorded", picks: [1] });
  assert.equal(await ballotCount(), 2);
  assert.deepEqual(await results(), { poll: { ...(await currentPoll()), created_at: poll.created_at }, voters: 2, counts: [1, 1] });
});

test("a ballot needs 1 to the allowed number of different, existing options and a well-formed phone ID", async () => {
  const poll = await savePoll(["Round table", "Classroom", "U-shape"], 2);
  for (const [deviceId, picks] of [
    [device(1), []],
    [device(1), null],
    [device(1), [0, 1, 2]],
    [device(1), [1, 1]],
    [device(1), [3]],
    [device(1), [-1]],
    [device(1), [0, null]],
    ["abc", [0]],
    [null, [0]],
    [device(1).toUpperCase().replace(/0/g, "A"), [0]],
    [`${device(1)}0`, [0]],
  ])
    await assert.rejects(vote(poll.id, deviceId, picks), `${deviceId} ${JSON.stringify(picks)}`);
  assert.equal(await ballotCount(), 0);
  // Stored in the admin's order whatever order the phone sends.
  assert.deepEqual(await vote(poll.id, device(1), [2, 0]), { status: "recorded", picks: [0, 2] });
});

test("results count each option once per phone that picked it, alongside how many phones voted", async () => {
  const poll = await savePoll(["Round table", "Classroom", "U-shape"], 2);
  await vote(poll.id, device(1), [0, 1]);
  await vote(poll.id, device(2), [1]);
  await vote(poll.id, device(3), [1, 2]);
  const { voters, counts, poll: shown } = await results();
  assert.equal(voters, 3);
  assert.deepEqual(counts, [1, 3, 1]);
  assert.deepEqual(shown.options, ["Round table", "Classroom", "U-shape"]);
  assert.equal(shown.max_picks, 2);
});

test("before the first vote the results are empty and closing does nothing", async () => {
  assert.deepEqual(await results(), { poll: null, voters: 0, counts: [] });
  assert.equal(await closePoll(), null);
  assert.equal(await currentPoll(), undefined);
});

test("closing stops new ballots but keeps the count; saving the same options opens it again with the count kept", async () => {
  const poll = await savePoll(["Round table", "Classroom"], 1);
  await vote(poll.id, device(1), [0]);
  const closed = await closePoll();
  assert.equal(closed.id, poll.id);
  assert.equal(closed.is_open, false);
  assert.equal((await currentPoll()).is_open, false);
  assert.deepEqual(await vote(poll.id, device(2), [1]), { status: "closed" });
  // A phone that voted before the close still gets its picks back.
  assert.deepEqual(await vote(poll.id, device(1), [1]), { status: "already", picks: [0] });
  assert.equal(await ballotCount(), 1);

  const reopened = await savePoll(["Round table", "Classroom"], 1);
  assert.equal(reopened.id, poll.id);
  assert.equal(reopened.is_open, true);
  assert.deepEqual(await vote(poll.id, device(2), [1]), { status: "recorded", picks: [1] });
  assert.deepEqual((await results()).counts, [1, 1]);
});

test("saving different options, order or number of picks starts a new vote: counted from zero, every phone votes again", async () => {
  const first = await savePoll(["Round table", "Classroom"], 1);
  await vote(first.id, device(1), [0]);
  for (const [options, maxPicks] of [
    [["Round table", "Classroom", "U-shape"], 1],
    [["Classroom", "Round table"], 1],
    [["Classroom", "Round table"], 2],
  ]) {
    const before = (await currentPoll()).id;
    const next = await savePoll(options, maxPicks);
    assert.notEqual(next.id, before, `${options} / ${maxPicks}`);
    assert.deepEqual((await currentPoll()).id, next.id);
    assert.deepEqual(await results(), { poll: { ...(await currentPoll()), created_at: next.created_at }, voters: 0, counts: options.map(() => 0) });
  }
  const current = await currentPoll();
  assert.deepEqual(await vote(current.id, device(1), [0, 1]), { status: "recorded", picks: [0, 1] });
  // A ballot for the earlier vote, from a page opened before the change, is not counted.
  assert.deepEqual(await vote(first.id, device(2), [0]), { status: "changed" });
  assert.deepEqual(await vote(id(99), device(2), [0]), { status: "changed" });
  // The earlier votes' ballots stay in the database.
  assert.equal(await ballotCount(), 2);
});

test("TYPE LAYOUT answers from the registration form join the vote under way: one ballot per attendee, once", async () => {
  // As in production on 04-11-2026: the vote's options, and a phone that already voted on /vote.
  const poll = await savePoll(["Round table", "Classroom table"], 1);
  await vote(poll.id, device(1), [0]);
  const checkIn = (n, answers) =>
    as("anon", "", () =>
      db.query(
        `select public.guestbook_check_in(p_name => $1, p_phone => $2, p_email => $3, p_jabatan => null, p_address => null,
           p_latitude => null, p_longitude => null, p_file_path => null, p_check_in_date => null, p_check_out_date => null,
           p_answers => $4::jsonb)`,
        [`Tamu Layout ${n}`, `0822 5000 ${String(n).padStart(4, "0")}`, `layout${n}@example.test`, answers ? JSON.stringify(answers) : null],
      ),
    );
  await checkIn(1, { "TYPE LAYOUT": "CLASS ROOM" });
  await checkIn(2, { "TYPE LAYOUT": "ROUNDTABLE" });
  await checkIn(3, { "TYPE LAYOUT": " class room ", "MATERI SENTINEL": "MATERI SESI KESATU" });
  await checkIn(4, { "MATERI SENTINEL": "MATERI SESI KEDUA" });
  await checkIn(5, null);
  const migration = await readFile(new URL("../../supabase/migrations/20261112000000_guestbook_evote_type_layout.sql", import.meta.url), "utf8");

  await db.exec(migration);
  // Round table: the phone and ROUNDTABLE; Classroom table: both CLASS ROOM answers. 1 phone + 3 attendees voted.
  assert.deepEqual(await results().then(({ voters, counts }) => ({ voters, counts })), { voters: 4, counts: [2, 2] });
  // Applied again, nobody is added twice.
  await db.exec(migration);
  assert.deepEqual(await results().then(({ voters, counts }) => ({ voters, counts })), { voters: 4, counts: [2, 2] });

  // A vote under way without those options (another question) gets nothing.
  const other = await savePoll(["Nasi goreng", "Soto"], 1);
  await db.exec(migration);
  assert.deepEqual(await results().then(({ poll: shown, voters }) => ({ id: shown.id, voters })), { id: other.id, voters: 0 });
});

test("each vote is copied to the sheet's E-Vote tab with its time and picks only; a resend sends every vote again", async () => {
  const bodies = async () => (await db.query("select body from net.sent order by id")).rows.map((row) => row.body);
  const code = (pollId, deviceId) => createHash("md5").update(`${pollId}:${deviceId}`).digest("hex");
  const poll = await savePoll(["Round table", "Classroom table", "U-shape"], 2);
  await db.exec("delete from net.sent");
  // No sheet set up: nothing is sent, and the vote counts.
  assert.deepEqual(await vote(poll.id, device(1), [0]), { status: "recorded", picks: [0] });
  await sendQueued();
  assert.deepEqual(await bodies(), []);

  await db.query("insert into private.guestbook_sheet (url, secret) values ($1, $2)", ["https://script.google.com/macros/s/AKfycbx-evote/exec", "s".repeat(32)]);
  try {
    await vote(poll.id, device(2), [2, 0]);
    // Nothing goes out while the attendee votes: the next batch takes it.
    assert.deepEqual(await bodies(), []);
    await sendQueued();
    const [request] = await bodies();
    assert.equal(request.secret, "s".repeat(32));
    assert.equal(request.rows, undefined);
    assert.equal(request.votes.length, 1);
    const [sent] = request.votes;
    assert.equal(sent.id, code(poll.id, device(2)));
    assert.deepEqual(sent.cells.map(([header]) => header), ["Waktu (WIB)", "Pilihan"]);
    assert.match(sent.cells[0][1], /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} WIB$/);
    assert.equal(sent.cells[1][1], "Round table, U-shape");
    // Nothing that ties the vote to a phone.
    assert.ok(!JSON.stringify(request).includes(device(2)));
    // A phone voting again sends nothing.
    await db.exec("delete from net.sent");
    assert.equal((await vote(poll.id, device(2), [1])).status, "already");
    await sendQueued();
    assert.deepEqual(await bodies(), []);

    // A TYPE LAYOUT answer moved from the form shows when its attendee checked in, not when it was moved.
    const { rows: [attendee] } = await as("anon", "", () =>
      db.query(
        `select (public.guestbook_check_in(p_name => 'Tamu Sheet', p_phone => '0822 6000 0001', p_email => 'sheet@example.test',
           p_jabatan => null, p_address => null, p_latitude => null, p_longitude => null, p_file_path => null,
           p_check_in_date => null, p_check_out_date => null)) as r`,
      ),
    );
    assert.equal(attendee.r.status, "created");
    await db.exec(`update public.guestbook_checkins set created_at = '2026-11-04 01:23:00+00', last_checked_in_at = '2026-11-04 02:34:00+00'
                    where email = 'sheet@example.test'`);
    await db.query(
      `insert into public.guestbook_ballots (poll_id, device_id, picks)
       select $1, md5('form:' || id::text), '{1}' from public.guestbook_checkins where email = 'sheet@example.test'`,
      [poll.id],
    );
    await sendQueued();
    const [moved] = (await bodies()).flatMap((body) => body.votes ?? []);
    assert.deepEqual(moved.cells, [["Waktu (WIB)", "04/11/2026 09:34 WIB"], ["Pilihan", "Classroom table"]]);

    // A resend sends every vote again (the sheet updates their rows by ID).
    await db.exec("delete from net.sent");
    await db.query("select private.guestbook_sheet_resend()");
    const resent = (await bodies()).flatMap((body) => body.votes ?? []);
    assert.deepEqual(resent.map((row) => row.cells[1][1]).sort(), ["Classroom table", "Round table", "Round table, U-shape"]);
  } finally {
    await db.exec("delete from private.guestbook_sheet; delete from net.sent");
  }
});

test("a vote counts, and the batch job carries on, when copying to the sheet fails", async () => {
  const poll = await savePoll(["Round table", "Classroom table"], 1);
  await db.query("insert into private.guestbook_sheet (url, secret) values ($1, $2)", ["https://script.google.com/macros/s/AKfycbx-down/exec", "s".repeat(32)]);
  const httpPost = (body) => `create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint ${body}`;
  await db.exec(httpPost(`language plpgsql as $$ begin raise exception 'Google is down'; end $$`));
  try {
    assert.deepEqual(await vote(poll.id, device(1), [1]), { status: "recorded", picks: [1] });
    await sendQueued();
    assert.deepEqual((await results()).counts, [0, 1]);
  } finally {
    await db.exec(httpPost(`language sql as $$ insert into net.sent (url, body) values (url, body) returning id $$`));
    await db.exec("delete from private.guestbook_sheet");
  }
});

const resetPoll = (userId = ADMIN) => as("authenticated", userId, () => one("select public.guestbook_reset_poll() as result"));

test("Reset hitungan starts the same vote again from zero: every phone votes again, earlier votes stay stored", async () => {
  await assert.rejects(resetPoll(), /Belum ada voting/);
  const poll = await savePoll(["Round table", "Classroom table"], 1);
  await vote(poll.id, device(1), [0]);
  await vote(poll.id, device(2), [1]);
  await assert.rejects(resetPoll(OTHER), /Hanya admin/);
  await assert.rejects(as("anon", "", () => one("select public.guestbook_reset_poll() as result")));
  const fresh = await resetPoll();
  assert.notEqual(fresh.id, poll.id);
  assert.deepEqual([fresh.options, fresh.max_picks, fresh.is_open], [["Round table", "Classroom table"], 1, true]);
  assert.deepEqual(await results().then(({ poll: shown, voters, counts }) => ({ id: shown.id, voters, counts })), { id: fresh.id, voters: 0, counts: [0, 0] });
  // A phone that voted votes again; a ballot for the earlier count is not counted.
  assert.deepEqual(await vote(fresh.id, device(1), [1]), { status: "recorded", picks: [1] });
  assert.deepEqual(await vote(poll.id, device(3), [0]), { status: "changed" });
  // The earlier votes stay in the database.
  assert.equal(await ballotCount(), 3);
  // A closed vote stays closed after a reset.
  await closePoll();
  assert.equal((await resetPoll()).is_open, false);
});

test("Reset hitungan empties the sheet's E-Vote tab, and a resend sends only the votes of the count under way", async () => {
  const bodies = async () => (await db.query("select body from net.sent order by id")).rows.map((row) => row.body);
  const poll = await savePoll(["Round table", "Classroom table"], 1);
  await vote(poll.id, device(1), [0]);
  await db.query("insert into private.guestbook_sheet (url, secret) values ($1, $2)", ["https://script.google.com/macros/s/AKfycbx-reset/exec", "s".repeat(32)]);
  await db.exec("delete from net.sent");
  try {
    const fresh = await resetPoll();
    assert.deepEqual(await bodies(), [{ secret: "s".repeat(32), votes_reset: true }]);
    await vote(fresh.id, device(2), [1]);
    await db.exec("delete from net.sent");
    await db.query("select private.guestbook_sheet_resend()");
    assert.deepEqual((await bodies()).flatMap((body) => body.votes ?? []).map((row) => row.cells[1][1]), ["Classroom table"]);
  } finally {
    await db.exec("delete from private.guestbook_sheet; delete from net.sent");
  }
});

test("votes reach the sheet in batches every 10 seconds: a burst of 150 votes is 2 requests, each vote once", async () => {
  const { rows: jobs } = await db.query("select schedule, command from cron.jobs where name = 'guestbook-sheet-votes'");
  assert.deepEqual(jobs, [{ schedule: "10 seconds", command: "select private.guestbook_sheet_send_queued_votes()" }]);
  const bodies = async () => (await db.query("select body from net.sent order by id")).rows.map((row) => row.body);
  const poll = await savePoll(["Round table", "Classroom table"], 1);
  await db.query("insert into private.guestbook_sheet (url, secret) values ($1, $2)", ["https://script.google.com/macros/s/AKfycbx-burst/exec", "s".repeat(32)]);
  await db.exec("delete from net.sent");
  try {
    for (let n = 1; n <= 150; n++) await vote(poll.id, device(n), [n % 2]);
    assert.deepEqual(await bodies(), []);
    assert.equal(await sendQueued(), 150);
    const requests = await bodies();
    assert.deepEqual(requests.map((body) => body.votes.length), [100, 50]);
    assert.equal(new Set(requests.flatMap((body) => body.votes.map((row) => row.id))).size, 150);
    // The next run finds nothing new.
    assert.equal(await sendQueued(), 0);
    assert.equal((await bodies()).length, 2);
  } finally {
    await db.exec("delete from private.guestbook_sheet; delete from net.sent");
  }
});

test("votes still waiting for the batch when Reset hitungan is pressed are not sent; without a sheet the list is emptied all the same", async () => {
  const bodies = async () => (await db.query("select body from net.sent order by id")).rows.map((row) => row.body);
  const waiting = async () => Number((await db.query("select count(*) as n from private.guestbook_sheet_vote_queue")).rows[0].n);
  const poll = await savePoll(["Round table", "Classroom table"], 1);
  await vote(poll.id, device(1), [0]);
  assert.equal(await waiting(), 1);
  assert.equal(await sendQueued(), 0);
  assert.equal(await waiting(), 0);

  await db.query("insert into private.guestbook_sheet (url, secret) values ($1, $2)", ["https://script.google.com/macros/s/AKfycbx-queue/exec", "s".repeat(32)]);
  await db.exec("delete from net.sent");
  try {
    await vote(poll.id, device(2), [1]);
    const fresh = await resetPoll();
    await vote(fresh.id, device(3), [1]);
    assert.equal(await sendQueued(), 1);
    const requests = await bodies();
    assert.deepEqual(requests[0], { secret: "s".repeat(32), votes_reset: true });
    assert.deepEqual(requests.slice(1).flatMap((body) => body.votes.map((row) => row.cells[1][1])), ["Classroom table"]);
    assert.equal(await waiting(), 0);
  } finally {
    await db.exec("delete from private.guestbook_sheet; delete from net.sent");
  }
});
