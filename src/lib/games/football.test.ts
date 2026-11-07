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
  COVERAGE,
  FORMATIONS,
  HOLD_MS,
  KICKOFF_FROM,
  PACE,
  QUARTER_HOLD_MS,
  QUARTER_MS,
  advance,
  clockReading,
  fieldGoalChance,
  fieldGoalDistance,
  fieldPosition,
  formation,
  newGame,
  press,
  regroup,
  visible,
  winner,
  yardsToGo,
  type Spot,
  type State,
} from "./football.ts";

/** Always the same high number: never moves a defender, and every kick misses or goes long. */
const still = () => 0.99;
/** Always zero: every defender moves on every beat, every kick is good and short. */
const keen = () => 0;

/** First and ten for the home side on its own 20, with the defence placed by hand. */
function scrimmage(defenders: Spot[] = [{ x: 90, lane: 0 }], extra: Partial<State> = {}): State {
  return {
    ...newGame("rookie"),
    phase: "ready",
    offense: "home",
    board: "home",
    ballOn: 20,
    lineAt: 20,
    defenders,
    ...extra,
  };
}

function run(state: State, yards: number): State {
  let s = state;
  for (let i = 0; i < yards; i++) s = press(s, "forward", still).state;
  return s;
}

test("a game opens with the away side kicking off to the home side", () => {
  const s = newGame("rookie");
  assert.equal(s.phase, "kickoff");
  assert.equal(s.offense, "away");
  assert.equal(s.ballOn, KICKOFF_FROM);
  assert.equal(s.quarter, 1);
  assert.equal(s.clockMs, QUARTER_MS);
  assert.deepEqual(s.defenders, []);
  assert.deepEqual(advance(s, 10_000, still).state, s, "nothing happens until the kick");
  assert.deepEqual(press(s, "up", still).events, [], "only Kick or Run kicks off");
});

test("a kickoff short of the end zone is run back by the receiving side", () => {
  // keen: 40 yards from the 35, so it lands on the receiver's 25.
  const step = press(newGame("rookie"), "kick", keen);
  assert.deepEqual(step.events, ["kick", "returnReady"]);
  const s = step.state;
  assert.equal(s.phase, "ready");
  assert.equal(s.offense, "home");
  assert.equal(s.ballOn, 25);
  assert.deepEqual(s.returning, { kind: "kickoff", yards: 40 });
  assert.equal(s.defenders.length, 5);
});

test("a kickoff into the end zone is a touchback at the 20", () => {
  const s = { ...newGame("rookie"), ballOn: 40 };
  const step = press(s, "kick", still); // 65 yards from the 40
  assert.deepEqual(step.state.outcome, { kind: "touchback", kick: "kickoff", distance: 65 });
  assert.equal(step.state.offense, "home");
  assert.equal(step.state.ballOn, 20);
  const next = advance(step.state, HOLD_MS, still).state;
  assert.equal(next.phase, "ready");
  assert.equal(next.returning, null);
});

test("a return ends in first and ten where the runner goes down", () => {
  let s = press(newGame("rookie"), "kick", keen).state;
  s = { ...s, defenders: [{ x: 7, lane: 1 }] };
  s = run(s, 6);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "return", gain: 6 });
  assert.equal(step.state.ballOn, 31);
  assert.equal(step.state.down, 1);
  assert.equal(step.state.toGo, 10);
  assert.equal(step.state.returning, null);
});

test("no formation puts a defender right in front of the runner", () => {
  for (const f of [...FORMATIONS, ...COVERAGE]) {
    assert.equal(f.length, 5);
    for (const [x] of f) assert.ok(x >= 2, `defender at x=${x}`);
  }
  for (const r of [0, 0.3, 0.6, 0.99]) {
    for (const d of formation(() => r)) assert.ok(d.x >= 2);
  }
});

test("the first press snaps the ball, and nothing moves before it", () => {
  const s = scrimmage();
  assert.deepEqual(advance(s, 10_000, keen).state, s, "ready does not run the clock or the defence");
  const step = press(s, "up", keen);
  assert.equal(step.state.phase, "live");
  assert.deepEqual(step.events, ["snap", "step"]);
  assert.equal(step.state.runner.lane, 0);
});

test("the runner cannot leave the field sideways", () => {
  const s = press(scrimmage(), "up", still).state;
  const blocked = press(s, "up", still);
  assert.equal(blocked.state.runner.lane, 0);
  assert.deepEqual(blocked.events, []);
});

test("running into a defender is a tackle where you stand, and the tackler is marked", () => {
  let s = scrimmage([{ x: 4, lane: 1 }]);
  s = run(s, 3);
  const step = press(s, "forward", still);
  assert.equal(step.state.phase, "result");
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: 3, firstDown: false });
  assert.deepEqual(step.state.tackler, { x: 4, lane: 1 });
  assert.equal(step.state.ballOn, 23);
  assert.equal(step.state.down, 2);
  assert.equal(step.state.toGo, 7);
});

test("running backwards loses yards", () => {
  let s = scrimmage([{ x: -3, lane: 1 }]);
  s = press(s, "back", still).state;
  s = press(s, "back", still).state;
  const step = press(s, "back", still);
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: -2, firstDown: false });
  assert.equal(step.state.ballOn, 18);
  assert.equal(step.state.toGo, 12);
});

test("tackled in your own end zone is a safety: two points, and you kick to them from your 20", () => {
  let s = scrimmage(undefined, { ballOn: 2, lineAt: 2 });
  s = press(s, "back", still).state;
  s = press(s, "back", still).state;
  s = press(s, "back", still).state;
  s = { ...s, defenders: [{ x: -4, lane: 1 }] };
  const step = press(s, "back", still);
  assert.deepEqual(step.state.outcome, { kind: "safety" });
  assert.deepEqual(step.events, ["safety"]);
  assert.deepEqual(step.state.score, { home: 0, away: 2 });
  const next = advance(step.state, HOLD_MS, still).state;
  assert.equal(next.phase, "kickoff");
  assert.equal(next.offense, "home");
  assert.equal(next.ballOn, 20);
});

test("the back of the end zone is as far as the runner can go", () => {
  let s = scrimmage(undefined, { ballOn: 1, lineAt: 1 });
  for (let i = 0; i < 15; i++) s = press(s, "back", still).state;
  assert.equal(s.ballOn + s.runner.x, -9);
});

test("ten yards on a play is a first down", () => {
  let s = run(scrimmage(), 12);
  s = { ...s, defenders: [{ x: 13, lane: 1 }] };
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: 12, firstDown: true });
  assert.ok(step.events.includes("firstDown"));
  assert.equal(step.state.ballOn, 32);
  assert.equal(step.state.down, 1);
  assert.equal(step.state.toGo, 10);
});

test("near the goal, the line to gain is the goal line", () => {
  let s = run(scrimmage(undefined, { ballOn: 85, lineAt: 85 }), 11);
  s = { ...s, defenders: [{ x: 12, lane: 1 }] };
  const step = press(s, "forward", still);
  assert.equal(step.state.ballOn, 96);
  assert.equal(step.state.down, 1);
  assert.equal(step.state.toGo, 4);
});

test("a touchdown is seven, and the scoring side kicks off", () => {
  const s = run(scrimmage(undefined, { ballOn: 95, lineAt: 95 }), 4);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "touchdown", gain: 5 });
  assert.deepEqual(step.state.score, { home: 7, away: 0 });
  assert.equal(step.state.board, "home", "the board still shows the scoring play");
  assert.equal(step.state.longestRun, 5);
  const next = advance(step.state, HOLD_MS, still).state;
  assert.equal(next.phase, "kickoff");
  assert.equal(next.offense, "home");
});

test("short on fourth down hands the ball over at the spot", () => {
  let s = scrimmage([{ x: 4, lane: 1 }], { ballOn: 40, lineAt: 40, down: 4, toGo: 5 });
  s = run(s, 3);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "turnover", gain: 3 });
  assert.deepEqual(step.events, ["turnover"]);
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 57);
});

test("kicking is only for fourth down, before the snap, and never on a return", () => {
  const s = scrimmage();
  assert.deepEqual(press(s, "kick", still).events, []);
  const fourth = { ...s, down: 4 as const };
  assert.deepEqual(press(press(fourth, "up", still).state, "kick", still).events, []);
  assert.deepEqual(press({ ...fourth, returning: { kind: "punt" as const, yards: 40 } }, "kick", still).events, []);
});

test("field goal range runs out at 52 yards, and long kicks are less likely", () => {
  assert.equal(fieldGoalDistance(80), 37);
  assert.equal(fieldGoalDistance(65), 52);
  assert.equal(fieldGoalDistance(64), null);
  assert.ok(fieldGoalChance(20) > fieldGoalChance(40));
  assert.ok(fieldGoalChance(40) > fieldGoalChance(52));
  assert.ok(fieldGoalChance(52) > 0);
});

test("a good field goal is three points, then a kickoff", () => {
  const step = press(scrimmage(undefined, { ballOn: 80, down: 4, toGo: 3 }), "kick", keen);
  assert.deepEqual(step.state.outcome, { kind: "fieldGoal", distance: 37 });
  assert.deepEqual(step.state.score, { home: 3, away: 0 });
  assert.equal(advance(step.state, HOLD_MS, still).state.phase, "kickoff");
});

test("a missed field goal gives the ball back where it was kicked from", () => {
  const step = press(scrimmage(undefined, { ballOn: 70, down: 4, toGo: 3 }), "kick", still);
  assert.equal(step.state.outcome?.kind, "missedKick");
  assert.deepEqual(step.events, ["turnover"]);
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 30);
});

test("out of range, a kick is a punt: run back if it lands in play, a touchback if not", () => {
  const s = scrimmage(undefined, { ballOn: 30, down: 4, toGo: 8 });
  const short = press(s, "kick", keen);
  assert.equal(short.state.phase, "ready");
  assert.equal(short.state.offense, "away");
  assert.equal(short.state.ballOn, 40);
  assert.deepEqual(short.state.returning, { kind: "punt", yards: 30 });

  const deep = press({ ...s, ballOn: 60 }, "kick", still);
  assert.deepEqual(deep.state.outcome, { kind: "touchback", kick: "punt", distance: 50 });
  assert.equal(deep.state.ballOn, 20);
});

test("the defence closes on the beat and makes the tackle", () => {
  let s = press(scrimmage(formation(keen)), "forward", keen).state;
  for (let i = 0; i < 40 && s.phase === "live"; i++) s = advance(s, PACE.pro.beatMs, keen).state;
  assert.equal(s.phase, "result");
  assert.equal(s.outcome?.kind, "tackle");
  assert.ok(s.tackler);
});

test("defenders never share a square", () => {
  let s = press(scrimmage(formation(keen), { difficulty: "pro" }), "forward", keen).state;
  let seed = 1;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30 && s.phase === "live"; i++) {
    s = advance(s, PACE.pro.beatMs, rng).state;
    const keys = s.defenders.map((d) => `${d.x},${d.lane}`);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("the clock only runs while a play is live, and reads in football minutes", () => {
  let s = scrimmage();
  assert.equal(clockReading(s), "15.0");
  s = press(s, "forward", still).state;
  s = advance(s, QUARTER_MS / 2, still).state;
  assert.equal(clockReading(s), "7.5");
  s = advance(s, QUARTER_MS, still).state;
  assert.equal(clockReading(s), "0.0");
});

test("after the hold the board lines up again", () => {
  let s = run(scrimmage([{ x: 4, lane: 1 }]), 3);
  s = press(s, "forward", still).state;
  assert.equal(s.holdMs, HOLD_MS);
  s = advance(s, HOLD_MS - 1, still).state;
  assert.equal(s.phase, "result");
  s = advance(s, 1, still).state;
  assert.equal(s.phase, "ready");
  assert.equal(s.runner.x, 0);
  assert.equal(s.tackler, null);
});

test("a play that outlasts the clock ends the quarter, and the second half opens with a kickoff", () => {
  let s = scrimmage(undefined, { quarter: 2, clockMs: 100 });
  s = press(s, "forward", still).state;
  s = advance(s, 500, still).state;
  assert.equal(s.clockMs, 0);
  assert.equal(s.phase, "live", "the play goes on after the clock runs out");
  s = { ...s, defenders: [{ x: s.runner.x + 1, lane: s.runner.lane }] };
  s = press(s, "forward", still).state;
  assert.equal(s.quarterOver, true);
  assert.equal(s.holdMs, QUARTER_HOLD_MS);

  const next = advance(s, QUARTER_HOLD_MS, still);
  assert.deepEqual(next.events, ["quarter"]);
  assert.equal(next.state.quarter, 3);
  assert.equal(next.state.clockMs, QUARTER_MS);
  assert.equal(next.state.phase, "kickoff");
  assert.equal(next.state.offense, "home", "home received first, so home kicks to open the second half");
});

test("the end of the fourth quarter is the end of the game", () => {
  let s = scrimmage([{ x: 2, lane: 1 }], { quarter: 4, clockMs: 0, score: { home: 10, away: 3 } });
  s = run(s, 1);
  s = press(s, "forward", still).state;
  const end = advance(s, QUARTER_HOLD_MS, still);
  assert.equal(end.state.phase, "final");
  assert.deepEqual(end.events, ["final"]);
  assert.equal(winner(end.state), "home");
  assert.deepEqual(press(end.state, "forward", still).events, []);
});

test("yards to go counts down during the run", () => {
  assert.equal(yardsToGo(run(scrimmage(), 2)), 8);
});

test("field position reads as a yard line and the half it is in", () => {
  assert.deepEqual(fieldPosition(scrimmage()), { yard: 20, side: "home" });
  assert.deepEqual(fieldPosition(scrimmage(undefined, { ballOn: 65 })), { yard: 35, side: "away" });
  assert.deepEqual(fieldPosition(scrimmage(undefined, { offense: "away", ballOn: 30 })), { yard: 30, side: "away" });
  assert.deepEqual(fieldPosition(scrimmage(undefined, { ballOn: 50 })), { yard: 50, side: null });
});

test("defenders left behind come back in at the far edge", () => {
  const runner = { x: 10, lane: 1 };
  const out = regroup([{ x: 7, lane: 0 }, { x: 8, lane: 1 }, { x: 12, lane: 2 }], runner, () => 0);
  assert.deepEqual(out[0], { x: 16, lane: 0 }, "three behind is off screen, so it regroups");
  assert.deepEqual(out[1], { x: 8, lane: 1 }, "two behind is still on screen and still chasing");
  assert.deepEqual(out[2], { x: 12, lane: 2 });
});

test("the screen keeps the runner in the third column and drops what scrolls off", () => {
  const s = scrimmage([{ x: -2, lane: 0 }, { x: 6, lane: 2 }, { x: 7, lane: 0 }]);
  const v = visible(s);
  assert.deepEqual(v.runner, { x: 2, lane: 1 });
  assert.deepEqual(v.defenders, [
    { x: 0, lane: 0 },
    { x: COLUMNS - 1, lane: 2 },
  ]);
});
