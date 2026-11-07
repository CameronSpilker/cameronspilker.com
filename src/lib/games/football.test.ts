/**
 * Run with `npm test`.
 *
 * The rules of Pixel Football, played with scripted dice so every drive here
 * goes the same way every time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS,
  FORMATIONS,
  HOLD_MS,
  PACE,
  QUARTER_HOLD_MS,
  QUARTER_MS,
  advance,
  fieldGoalChance,
  fieldGoalDistance,
  formation,
  newGame,
  press,
  regroup,
  visible,
  winner,
  yardsToGo,
  type State,
} from "./football.ts";

/** Always the same number: never moves a defender, and every kick misses. */
const still = () => 0.99;
/** Always zero: every defender moves on every beat, and every kick is good. */
const keen = () => 0;

/** A board with nobody in the way, so a test can run as far as it likes. */
function openField(state: State): State {
  return { ...state, defenders: [{ x: 90, lane: 0 }] };
}

function run(state: State, yards: number): State {
  let s = state;
  for (let i = 0; i < yards; i++) s = press(s, "forward", still).state;
  return s;
}

test("a game opens with the home side on its own 20, first and ten", () => {
  const s = newGame("rookie", still);
  assert.equal(s.phase, "ready");
  assert.equal(s.offense, "home");
  assert.equal(s.ballOn, 20);
  assert.equal(s.down, 1);
  assert.equal(s.toGo, 10);
  assert.equal(s.quarter, 1);
  assert.equal(s.clockMs, QUARTER_MS);
  assert.equal(s.defenders.length, 5);
});

test("no formation puts a defender right in front of the runner", () => {
  for (const f of FORMATIONS) {
    assert.equal(f.length, 5);
    for (const [x] of f) assert.ok(x >= 2, `defender at x=${x}`);
  }
  for (const r of [0, 0.3, 0.6, 0.99]) {
    for (const d of formation(() => r)) assert.ok(d.x >= 2);
  }
});

test("the first press snaps the ball, and nothing moves before it", () => {
  const s = newGame("pro", keen);
  const waited = advance(s, 10_000, keen).state;
  assert.deepEqual(waited, s, "ready does not run the clock or the defence");

  const step = press(s, "up", keen);
  assert.equal(step.state.phase, "live");
  assert.deepEqual(step.events, ["snap", "step"]);
  assert.equal(step.state.runner.lane, 0);
});

test("the runner cannot leave the field sideways", () => {
  let s = newGame("rookie", still);
  s = press(s, "up", still).state;
  const blocked = press(s, "up", still);
  assert.equal(blocked.state.runner.lane, 0);
  assert.deepEqual(blocked.events, []);
});

test("running into a defender is a tackle where you stand", () => {
  let s = { ...newGame("rookie", still), defenders: [{ x: 4, lane: 1 }] };
  s = run(s, 3);
  assert.equal(s.runner.x, 3);
  const step = press(s, "forward", still);
  assert.equal(step.state.phase, "result");
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: 3, firstDown: false });
  assert.equal(step.state.ballOn, 23);
  assert.equal(step.state.down, 2);
  assert.equal(step.state.toGo, 7);
});

test("ten yards on a play is a first down", () => {
  let s = openField(newGame("rookie", still));
  s = run(s, 12);
  s = { ...s, defenders: [{ x: 13, lane: 1 }] };
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: 12, firstDown: true });
  assert.ok(step.events.includes("firstDown"));
  assert.equal(step.state.ballOn, 32);
  assert.equal(step.state.down, 1);
  assert.equal(step.state.toGo, 10);
});

test("near the goal, the line to gain is the goal line", () => {
  let s = openField(newGame("rookie", still));
  s = { ...s, ballOn: 85 };
  s = run(s, 11);
  s = { ...s, defenders: [{ x: 12, lane: 1 }] };
  const step = press(s, "forward", still);
  assert.equal(step.state.ballOn, 96);
  assert.equal(step.state.down, 1);
  assert.equal(step.state.toGo, 4);
});

test("crossing the goal line scores seven and the other side starts at its 20", () => {
  let s = openField(newGame("rookie", still));
  s = { ...s, ballOn: 95 };
  s = run(s, 4);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "touchdown", gain: 5 });
  assert.deepEqual(step.state.score, { home: 7, away: 0 });
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.board, "home", "the board still shows the scoring play");
  assert.equal(step.state.ballOn, 20);
  assert.equal(step.state.longestRun, 5);
});

test("short on fourth down hands the ball over at the spot", () => {
  let s = { ...newGame("rookie", still), defenders: [{ x: 4, lane: 1 }] };
  s = { ...s, ballOn: 40, down: 4, toGo: 5 };
  s = run(s, 3);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "turnover", gain: 3 });
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 57);
});

test("kicking is only for fourth down, before the snap", () => {
  const s = newGame("rookie", still);
  assert.deepEqual(press(s, "kick", still).events, []);
  const fourth = { ...s, down: 4 as const };
  const live = press(fourth, "up", still).state;
  assert.deepEqual(press(live, "kick", still).events, []);
});

test("field goal range runs out at 52 yards, and long kicks are less likely", () => {
  assert.equal(fieldGoalDistance(80), 37);
  assert.equal(fieldGoalDistance(65), 52);
  assert.equal(fieldGoalDistance(64), null);
  assert.ok(fieldGoalChance(20) > fieldGoalChance(40));
  assert.ok(fieldGoalChance(40) > fieldGoalChance(52));
  assert.ok(fieldGoalChance(52) > 0);
});

test("a good field goal is three points", () => {
  const s = { ...newGame("rookie", still), ballOn: 80, down: 4 as const, toGo: 3 };
  const step = press(s, "kick", keen);
  assert.deepEqual(step.state.outcome, { kind: "fieldGoal", distance: 37 });
  assert.deepEqual(step.state.score, { home: 3, away: 0 });
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 20);
});

test("a missed field goal gives the ball back where it was kicked from", () => {
  const s = { ...newGame("rookie", still), ballOn: 70, down: 4 as const, toGo: 3 };
  const step = press(s, "kick", still);
  assert.equal(step.state.outcome?.kind, "missedKick");
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 30);
});

test("out of range, a kick is a punt, and one into the end zone comes out to the 20", () => {
  const s = { ...newGame("rookie", still), ballOn: 30, down: 4 as const, toGo: 8 };
  const short = press(s, "kick", keen);
  assert.deepEqual(short.state.outcome, { kind: "punt", distance: 30, touchback: false });
  assert.equal(short.state.ballOn, 40);

  const deep = press({ ...s, ballOn: 60 }, "kick", still);
  assert.deepEqual(deep.state.outcome, { kind: "punt", distance: 50, touchback: true });
  assert.equal(deep.state.ballOn, 20);
});

test("the defence closes on the beat and makes the tackle", () => {
  let s = newGame("pro", keen);
  s = press(s, "forward", keen).state;
  assert.equal(s.phase, "live");
  for (let i = 0; i < 40 && s.phase === "live"; i++) s = advance(s, PACE.pro.beatMs, keen).state;
  assert.equal(s.phase, "result");
  assert.equal(s.outcome?.kind, "tackle");
});

test("defenders never share a square", () => {
  let s = newGame("pro", keen);
  s = press(s, "forward", keen).state;
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30 && s.phase === "live"; i++) {
    s = advance(s, PACE.pro.beatMs, rng).state;
    const keys = s.defenders.map((d) => `${d.x},${d.lane}`);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("the clock only runs while a play is live", () => {
  let s = newGame("rookie", still);
  s = press(s, "forward", still).state;
  s = advance(s, 1_000, still).state;
  assert.equal(s.clockMs, QUARTER_MS - 1_000);
});

test("after the hold the board lines up again", () => {
  let s = newGame("rookie", still);
  s = run(s, 3);
  s = press(s, "forward", still).state;
  assert.equal(s.holdMs, HOLD_MS);
  s = advance(s, HOLD_MS - 1, still).state;
  assert.equal(s.phase, "result");
  s = advance(s, 1, still).state;
  assert.equal(s.phase, "ready");
  assert.equal(s.runner.x, 0);
});

test("a play that outlasts the clock ends the quarter, and halftime flips the ball", () => {
  let s = newGame("rookie", still);
  s = { ...s, quarter: 2, clockMs: 100 };
  s = press(s, "forward", still).state;
  s = advance(s, 500, still).state;
  assert.equal(s.clockMs, 0);
  assert.equal(s.phase, "live", "the play goes on after the clock runs out");
  s = { ...s, defenders: [{ x: s.runner.x + 1, lane: s.runner.lane }] };
  s = press(s, "forward", still).state;
  assert.equal(s.phase, "result");
  assert.equal(s.quarterOver, true);
  assert.equal(s.holdMs, QUARTER_HOLD_MS);

  const next = advance(s, QUARTER_HOLD_MS, still);
  assert.deepEqual(next.events, ["quarter"]);
  assert.equal(next.state.quarter, 3);
  assert.equal(next.state.clockMs, QUARTER_MS);
  assert.equal(next.state.offense, "away");
  assert.equal(next.state.ballOn, 20);
});

test("the end of the fourth quarter is the end of the game", () => {
  let s = newGame("rookie", still);
  s = { ...s, quarter: 4, clockMs: 0, score: { home: 10, away: 3 } };
  s = run(s, 1);
  s = press({ ...s, defenders: [{ x: 2, lane: 1 }] }, "forward", still).state;
  const end = advance(s, QUARTER_HOLD_MS, still);
  assert.equal(end.state.phase, "final");
  assert.deepEqual(end.events, ["final"]);
  assert.equal(winner(end.state), "home");
  assert.deepEqual(press(end.state, "forward", still).events, []);
});

test("yards to go counts down during the run", () => {
  let s = openField(newGame("rookie", still));
  s = run(s, 2);
  assert.equal(yardsToGo(s), 8);
});

test("the screen keeps the runner in the second column and drops what scrolls off", () => {
  const s = { ...newGame("rookie", still), defenders: [{ x: 0, lane: 0 }, { x: 7, lane: 2 }, { x: 8, lane: 0 }] };
  const v = visible(s);
  assert.deepEqual(v.runner, { x: 1, lane: 1 });
  assert.deepEqual(v.defenders, [
    { x: 1, lane: 0 },
    { x: COLUMNS - 1, lane: 2 },
  ]);
});

test("defenders left behind come back in at the far edge", () => {
  const runner = { x: 10, lane: 1 };
  const out = regroup([{ x: 8, lane: 0 }, { x: 9, lane: 1 }, { x: 12, lane: 2 }], runner, () => 0);
  assert.deepEqual(out[0], { x: 17, lane: 0 }, "two behind is off screen, so it regroups");
  assert.deepEqual(out[1], { x: 9, lane: 1 }, "one behind is still on screen and still chasing");
  assert.deepEqual(out[2], { x: 12, lane: 2 });
});
