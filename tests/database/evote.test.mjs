import assert from "node:assert/strict";
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
