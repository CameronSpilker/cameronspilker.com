/**
 * Run with `npm test`.
 *
 * The player's own top ten against the computer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCORES, addScore, parseScores, today, type HighScore } from "./scores.ts";

const s = (you: number, cpu: number, date = "2026-11-08", level: HighScore["level"] = "rookie"): HighScore => ({ you, cpu, level, date });

test("the first game is the top score", () => {
  assert.deepEqual(addScore([], s(7, 3)), { list: [s(7, 3)], rank: 1 });
});

test("more points ranks higher, then a bigger margin, then the older game", () => {
  let list: HighScore[] = [];
  list = addScore(list, s(7, 3)).list;
  list = addScore(list, s(14, 21)).list;
  list = addScore(list, s(7, 0)).list;
  const tie = addScore(list, s(7, 0, "2026-11-09"));
  assert.deepEqual(tie.list, [s(14, 21), s(7, 0), s(7, 0, "2026-11-09"), s(7, 3)]);
  assert.equal(tie.rank, 3, "an equal later score goes below the earlier one");
});

test("a game where you never scored does not make the list, even an empty one", () => {
  assert.deepEqual(addScore([], s(0, 0)), { list: [], rank: null });
  assert.deepEqual(addScore([], s(0, 21)), { list: [], rank: null });
});

test("the list keeps ten, and a score below all ten does not make it", () => {
  let list: HighScore[] = [];
  for (let i = 1; i <= MAX_SCORES; i++) list = addScore(list, s(i * 7, 0)).list;
  assert.equal(list.length, MAX_SCORES);
  const low = addScore(list, s(1, 7));
  assert.equal(low.rank, null);
  assert.equal(low.list, list);
  const high = addScore(list, s(100, 0));
  assert.equal(high.rank, 1);
  assert.equal(high.list.length, MAX_SCORES);
  assert.equal(high.list[MAX_SCORES - 1].you, 14, "the lowest score drops off");
});

test("saved lists are read back safely and in order", () => {
  assert.deepEqual(parseScores(null), []);
  assert.deepEqual(parseScores("nope"), []);
  const raw = [s(3, 0), { you: -1, cpu: 0, level: "rookie", date: "2026-11-08" }, s(10, 7, "2026-11-01", "pro"), { you: 5 }, s(3, 0, "bad")];
  assert.deepEqual(parseScores(raw), [s(10, 7, "2026-11-01", "pro"), s(3, 0)]);
});

test("today is the local date as YYYY-MM-DD", () => {
  assert.equal(today(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});
