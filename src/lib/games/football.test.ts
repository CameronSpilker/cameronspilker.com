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
  LONGEST_KICK,
  PACE,
  QUARTER_MS,
  advance,
  clockReading,
  columnYards,
  fieldGoalChance,
  fieldGoalDistance,
  fieldPosition,
  formation,
  gained,
  newGame,
  press,
  winner,
  yardsToGo,
  type Spot,
  type State,
} from "./football.ts";

/** Always the same high number: never moves a defender, and every kick ends up a long punt. */
const still = () => 0.99;
/** Always zero: every defender moves on every beat, and every field goal is good. */
const keen = () => 0;

/** First and ten for the home side on its own 20, with the defence placed by hand. */
function snap(defenders: Spot[] = [], extra: Partial<State> = {}): State {
  return { ...newGame("rookie", still), defenders, ...extra };
}

function run(state: State, yards: number): State {
  let s = state;
  for (let i = 0; i < yards; i++) s = press(s, "forward", still).state;
  return s;
}

test("a game opens with home on its own 20, first and ten, runner at the end of the screen", () => {
  const s = newGame("rookie", still);
  assert.equal(s.phase, "ready");
  assert.equal(s.offense, "home");
  assert.equal(s.ballOn, 20);
  assert.equal(s.down, 1);
  assert.equal(s.toGo, 10);
  assert.equal(s.quarter, 1);
  assert.equal(s.clockMs, QUARTER_MS);
  assert.deepEqual(s.runner, { x: 0, lane: 1 });
});

test("the defence lines up three across, a linebacker, and a safety deep", () => {
  const d = formation(keen);
  assert.equal(d.length, 5);
  assert.deepEqual(d.slice(0, 3), [
    { x: 3, lane: 0 },
    { x: 3, lane: 1 },
    { x: 3, lane: 2 },
  ]);
  assert.equal(d[3].x, 5);
  assert.equal(d[4].x, 8);
});

test("running straight never earns a first down on its own, on either level", () => {
  // The line is 3 yards off, so a runner who never dodges gets 2 yards a play,
  // 8 over four downs: short of the 10 needed. Played out with the real defence.
  for (const difficulty of ["rookie", "pro"] as const) {
    let s = newGame(difficulty, keen);
    for (let play = 0; play < 4; play++) {
      for (let t = 0; t < 200 && (s.phase === "ready" || s.phase === "live"); t++) {
        s = press(s, "forward", keen).state;
        s = advance(s, 50, keen).state;
      }
      assert.ok(s.outcome && "gain" in s.outcome && s.outcome.gain <= 2, `${difficulty}: ${JSON.stringify(s.outcome)}`);
      assert.notEqual(s.outcome && s.outcome.kind === "tackle" && s.outcome.firstDown, true);
      s = press(s, "status", keen).state;
    }
    assert.equal(s.offense, "away", `${difficulty}: four straight runs should end in a turnover`);
  }
});

test("pro reacts 50% faster than rookie", () => {
  assert.equal(PACE.rookie.beatMs / PACE.pro.beatMs, 1.5);
});

test("the first arrow snaps the ball, and nothing moves before it", () => {
  const s = newGame("pro", keen);
  assert.deepEqual(advance(s, 10_000, keen).state, s, "ready does not run the clock or the defence");
  const step = press(s, "up", keen);
  assert.equal(step.state.phase, "live");
  assert.deepEqual(step.events, ["snap", "step"]);
  assert.equal(step.state.runner.lane, 0);
});

test("the runner goes forward or across, never off the side", () => {
  const s = press(snap(), "up", still).state;
  assert.deepEqual(press(s, "up", still).events, []);
  assert.equal(run(s, 2).runner.x, 2);
});

test("off the far end of the screen, the runner starts the next 9 yards and keeps the count", () => {
  let s = run(snap([{ x: 5, lane: 0 }]), COLUMNS - 1);
  assert.equal(s.runner.x, 8);
  s = press(s, "forward", still).state;
  assert.equal(s.runner.x, 0);
  assert.equal(s.screenAt, 9);
  assert.equal(gained(s), 9);
  assert.deepEqual(s.defenders, [{ x: 5, lane: 0 }], "the defence stays where it stood");
  assert.deepEqual(columnYards(s).slice(0, 2), [29, 30]);
});

test("running into a defender is a tackle where you stand, and the tackler is marked", () => {
  let s = run(snap([{ x: 4, lane: 1 }]), 3);
  const step = press(s, "forward", still);
  assert.equal(step.state.phase, "result");
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: 3, firstDown: false });
  assert.deepEqual(step.state.tackler, { x: 4, lane: 1 });
  assert.equal(step.state.ballOn, 23);
  assert.equal(step.state.down, 2);
  assert.equal(step.state.toGo, 7);
  s = step.state;
  assert.equal(advance(s, 60_000, still).state, s, "the board waits");
  assert.deepEqual(press(s, "forward", still).events, [], "arrows do not set up the next play");
});

test("Status or Score sets up the next play", () => {
  const s = press(run(snap([{ x: 4, lane: 1 }]), 3), "forward", still).state;
  for (const input of ["status", "score"] as const) {
    const next = press(s, input, still).state;
    assert.equal(next.phase, "ready");
    assert.deepEqual(next.runner, { x: 0, lane: 1 });
    assert.equal(next.tackler, null);
    assert.equal(next.lineAt, 23);
  }
});

test("ten yards on a play is a first down", () => {
  let s = run(snap(), 12);
  s = { ...s, defenders: [{ x: 4, lane: 1 }] };
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "tackle", gain: 12, firstDown: true });
  assert.ok(step.events.includes("firstDown"));
  assert.equal(step.state.ballOn, 32);
  assert.equal(step.state.toGo, 10);
});

test("a touchdown is seven, and the other side starts on its own 20", () => {
  const s = run(snap([], { ballOn: 95, lineAt: 95 }), 4);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "touchdown", gain: 5 });
  assert.deepEqual(step.state.score, { home: 7, away: 0 });
  assert.equal(step.state.board, "home", "the board still shows the scoring play");
  const next = press(step.state, "status", still).state;
  assert.equal(next.offense, "away");
  assert.equal(next.ballOn, 20);
});

test("short on fourth down hands the ball over where the runner went down", () => {
  const s = run(snap([{ x: 4, lane: 1 }], { ballOn: 40, lineAt: 40, down: 4, toGo: 5 }), 3);
  const step = press(s, "forward", still);
  assert.deepEqual(step.state.outcome, { kind: "turnover", gain: 3 });
  assert.deepEqual(step.events, ["turnover"]);
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 57);
});

test("kicking is only for fourth down, before the snap", () => {
  const s = snap();
  assert.deepEqual(press(s, "kick", still).events, []);
  const fourth = { ...s, down: 4 as const };
  assert.deepEqual(press(press(fourth, "up", still).state, "kick", still).events, []);
});

test("in range, the kick can be a field goal, and closer kicks are likelier", () => {
  assert.equal(fieldGoalDistance(80), 37);
  assert.equal(fieldGoalDistance(64), null);
  assert.ok(fieldGoalChance(20) > fieldGoalChance(40));
  const step = press(snap([], { ballOn: 80, down: 4, toGo: 3 }), "kick", keen);
  assert.deepEqual(step.state.outcome, { kind: "fieldGoal", distance: 37 });
  assert.deepEqual(step.events, ["fieldGoal"]);
  assert.deepEqual(step.state.score, { home: 3, away: 0 });
  assert.equal(step.state.offense, "away");
  assert.equal(step.state.ballOn, 20);
});

test("otherwise the kick is a punt of 1 to 65 yards, two whistles, and the other side takes over", () => {
  const short = press(snap([], { ballOn: 30, down: 4, toGo: 8 }), "kick", keen);
  assert.deepEqual(short.state.outcome, { kind: "punt", distance: 1, touchback: false });
  assert.deepEqual(short.events, ["turnover"]);
  assert.equal(short.state.ballOn, 69);

  const long = press(snap([], { ballOn: 40, down: 4, toGo: 8 }), "kick", still);
  assert.deepEqual(long.state.outcome, { kind: "punt", distance: LONGEST_KICK, touchback: true });
  assert.equal(long.state.ballOn, 20);
});

test("the defence closes on the beat and makes the tackle", () => {
  let s = press(newGame("pro", keen), "forward", keen).state;
  for (let i = 0; i < 40 && s.phase === "live"; i++) s = advance(s, PACE.pro.beatMs, keen).state;
  assert.equal(s.phase, "result");
  assert.ok(s.tackler);
});

test("the defence moves one tackler per beat", () => {
  let s = press(newGame("rookie", keen), "up", keen).state;
  const before = s.defenders;
  s = advance(s, PACE.rookie.beatMs, keen).state;
  const moved = s.defenders.filter((d, i) => d.x !== before[i].x || d.lane !== before[i].lane);
  assert.equal(moved.length, 1);
});

test("defenders never share a square", () => {
  let s = press(newGame("pro", keen), "forward", keen).state;
  let seed = 1;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30 && s.phase === "live"; i++) {
    s = advance(s, PACE.pro.beatMs, rng).state;
    const keys = s.defenders.map((d) => `${d.x},${d.lane}`);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("the clock only runs while a play is live, and reads in football minutes", () => {
  let s = snap();
  assert.equal(clockReading(s), "15.0");
  s = press(s, "forward", still).state;
  s = advance(s, QUARTER_MS / 2, still).state;
  assert.equal(clockReading(s), "7.5");
  s = advance(s, QUARTER_MS, still).state;
  assert.equal(clockReading(s), "0.0");
});

test("quarters: possession carries over, except the second half opens with away on its own 20", () => {
  // A play that outlasts the clock still finishes, then the quarter ends.
  let s = snap([], { quarter: 1, clockMs: 100, ballOn: 50, lineAt: 50 });
  s = advance(press(s, "forward", still).state, 500, still).state;
  assert.equal(s.phase, "live");
  s = press({ ...s, defenders: [{ x: 2, lane: 1 }] }, "forward", still).state;
  assert.equal(s.quarterOver, true);
  let next = press(s, "status", still).state;
  assert.equal(next.quarter, 2);
  assert.equal(next.clockMs, QUARTER_MS);
  assert.equal(next.offense, "home");
  assert.equal(next.ballOn, 51);

  s = { ...snap([{ x: 1, lane: 1 }], { quarter: 2, clockMs: 0 }), phase: "live" };
  s = press(s, "forward", still).state;
  next = press(s, "status", still).state;
  assert.equal(next.quarter, 3);
  assert.equal(next.offense, "away");
  assert.equal(next.ballOn, 20);
  assert.equal(next.down, 1);
});

test("the end of the fourth quarter is the end of the game", () => {
  const s = { ...snap([{ x: 1, lane: 1 }], { quarter: 4, clockMs: 0, score: { home: 10, away: 3 } }), phase: "live" as const };
  const end = press(s, "forward", still);
  assert.equal(end.state.phase, "final");
  assert.ok(end.events.includes("final"));
  assert.equal(winner(end.state), "home");
  assert.deepEqual(press(end.state, "status", still).events, []);
});

test("yards to go counts down during the run, and goes blank inside the 10", () => {
  assert.equal(yardsToGo(run(snap(), 2)), 8);
  assert.equal(yardsToGo(snap([], { ballOn: 91 })), null);
  assert.equal(yardsToGo(snap([], { ballOn: 90 })), 10);
});

test("field position reads as a yard line and the half it is in", () => {
  assert.deepEqual(fieldPosition(snap()), { yard: 20, side: "home" });
  assert.deepEqual(fieldPosition(snap([], { ballOn: 65 })), { yard: 35, side: "away" });
  assert.deepEqual(fieldPosition(snap([], { offense: "away", ballOn: 30 })), { yard: 30, side: "away" });
  assert.deepEqual(fieldPosition(snap([], { ballOn: 50 })), { yard: 50, side: null });
});
