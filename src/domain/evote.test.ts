import assert from "node:assert/strict";
import { it } from "node:test";
import { normalizeOptions, pickInstruction, pollProblem, sameVote, shares, togglePick, voteSubtitle, voteTitle } from "./evote";

it("cleans the admin's options: trimmed, blanks dropped, repeats ignoring case dropped with the first spelling kept", () => {
  assert.deepEqual(normalizeOptions([" Round table ", "", "   ", "Classroom", "round table", "Classroom "]), ["Round table", "Classroom"]);
});

it("accepts 2 to 20 options of up to 120 characters and 1 to all of them per person", () => {
  assert.equal(pollProblem(["A", "B"], 1), null);
  assert.equal(pollProblem(["A", "B"], 2), null);
  const twenty = Array.from({ length: 20 }, (_, i) => `Pilihan ${i + 1}`);
  assert.equal(pollProblem(twenty, 20), null);
  assert.equal(pollProblem(["x".repeat(120), "B"], 1), null);
});

it("rejects too few or too many options, an over-long option and an impossible number of picks", () => {
  const cases: [string[], number][] = [
    [["A"], 1],
    [[], 1],
    [Array.from({ length: 21 }, (_, i) => `Pilihan ${i + 1}`), 1],
    [["x".repeat(121), "B"], 1],
    [["A", "B"], 0],
    [["A", "B"], 3],
    [["A", "B"], 1.5],
  ];
  for (const [options, maxPicks] of cases) assert.notEqual(pollProblem(options, maxPicks), null, `${options.length} options, ${maxPicks} picks`);
});

it("with one pick, a tap replaces the choice; tapping it again takes it back", () => {
  assert.deepEqual(togglePick([], 0, 1), [0]);
  assert.deepEqual(togglePick([0], 1, 1), [1]);
  assert.deepEqual(togglePick([1], 1, 1), []);
});

it("with several picks, taps add up to the limit in the admin's order and a picked option comes off again", () => {
  assert.deepEqual(togglePick([], 2, 2), [2]);
  assert.deepEqual(togglePick([2], 0, 2), [0, 2]);
  // Full: a third option does not go in.
  assert.deepEqual(togglePick([0, 2], 1, 2), [0, 2]);
  assert.deepEqual(togglePick([0, 2], 0, 2), [2]);
});

it("saving the same options in the same order with the same number of picks carries on the vote", () => {
  const poll = { options: ["Round table", "Classroom"], max_picks: 1 };
  assert.equal(sameVote(poll, ["Round table", "Classroom"], 1), true);
  assert.equal(sameVote(null, ["Round table", "Classroom"], 1), false);
  assert.equal(sameVote(poll, ["Classroom", "Round table"], 1), false);
  assert.equal(sameVote(poll, ["Round table", "Classroom"], 2), false);
  assert.equal(sameVote(poll, ["Round table", "U-shape"], 1), false);
  assert.equal(sameVote(poll, ["Round table", "Classroom", "U-shape"], 1), false);
});

it("shows the admin's title and subtitle, trimmed, and falls back when they are blank", () => {
  assert.equal(voteTitle({ title: " Layout Ruangan Rakernas " }, "Hasil E-Vote"), "Layout Ruangan Rakernas");
  assert.equal(voteTitle({ title: "" }, "Hasil E-Vote"), "Hasil E-Vote");
  assert.equal(voteTitle({ title: "   " }, "E-Vote"), "E-Vote");
  assert.equal(voteSubtitle({ subtitle: " Mau duduk bagaimana? ", max_picks: 1 }), "Mau duduk bagaimana?");
  assert.equal(voteSubtitle({ subtitle: "", max_picks: 1 }), pickInstruction(1));
  assert.equal(voteSubtitle({ subtitle: "  ", max_picks: 3 }), "Pilih maksimal 3 dari pilihan di bawah");
});

it("gives each option's share of the people who voted, in whole percent", () => {
  assert.deepEqual(shares([58, 33], 91), [64, 36]);
  // Several picks each: shares of voters, so they add up to more than 100.
  assert.deepEqual(shares([3, 2, 1], 4), [75, 50, 25]);
  assert.deepEqual(shares([0, 0], 0), [0, 0]);
});
