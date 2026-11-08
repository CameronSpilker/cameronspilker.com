/**
 * Run with `npm test`.
 *
 * The computer opponent: it runs, it dodges, it kicks when it should.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CPU_TAP_MS, cpuMove, type Skill } from "./cpu.ts";
import { advance, newGame, press, type Difficulty, type Spot, type State } from "./football.ts";

const still = () => 0.99;

function at(defenders: Spot[], extra: Partial<State> = {}): State {
  return { ...newGame("rookie", still), offense: "away", board: "away", defenders, ...extra };
}

test("with nobody near, the computer runs", () => {
  assert.equal(cpuMove(at([{ x: 8, lane: 0 }]), still), "forward");
});

test("with a defender right in front, it steps into an open lane", () => {
  const move = cpuMove(at([{ x: 1, lane: 1 }]), still);
  assert.ok(move === "up" || move === "down");
});

test("boxed in mid play, it waits for a gap; before the snap it always snaps", () => {
  const box = [{ x: 1, lane: 1 }, { x: 0, lane: 0 }, { x: 0, lane: 2 }];
  assert.equal(cpuMove(at(box, { phase: "live" }), still), null);
  assert.notEqual(cpuMove(at(box), still), null);
});

test("on fourth and long it kicks, on fourth and short it goes for it", () => {
  assert.equal(cpuMove(at([], { down: 4, toGo: 7 }), still), "kick");
  assert.equal(cpuMove(at([{ x: 8, lane: 0 }], { down: 4, toGo: 1 }), still), "forward");
});

test("it does nothing once the play is over", () => {
  assert.equal(cpuMove({ ...at([]), phase: "result" }, still), null);
});

test("left to itself, the computer plays every snap through to an outcome", () => {
  // Four plays by the computer against the real defence. It must never stall.
  let s: State = { ...newGame("rookie", Math.random), offense: "away", board: "away" };
  let finished = 0;
  for (let play = 0; play < 4 && s.phase !== "final"; play++) {
    for (let t = 0; t < 2_000 && (s.phase === "ready" || s.phase === "live"); t++) {
      const move = cpuMove(s, Math.random);
      if (move) s = press(s, move, Math.random).state;
      s = advance(s, 120, Math.random).state;
    }
    if (s.outcome) finished++;
    if (s.phase === "result") s = press(s, "status", Math.random).state;
  }
  assert.equal(finished, 4);
});

test("it will not step next to a defender when a safe move exists", () => {
  // Forward would put it beside the defender at (2, 1); stepping up keeps it clear.
  const move = cpuMove(at([{ x: 2, lane: 1 }, { x: 5, lane: 0 }], { phase: "live" }), still);
  assert.notEqual(move, "forward");
});

/** A seeded random source, so the averages below come out the same on every run. */
function seeded(seed: number) {
  let n = seed;
  return () => (n = (n * 16807) % 2147483647) / 2147483647;
}

/** Average yards a play for the computer at one skill against one level of defence. */
function averageGain(skill: Skill, defence: Difficulty, plays: number): number {
  const rng = seeded(7);
  let total = 0;
  for (let p = 0; p < plays; p++) {
    let s: State = { ...newGame(defence, rng), offense: "away", board: "away" };
    for (let t = 0; t < 3_000 && (s.phase === "ready" || s.phase === "live"); t++) {
      const move = cpuMove(s, rng, skill);
      if (move) s = press(s, move, rng).state;
      s = advance(s, CPU_TAP_MS[skill], rng).state;
    }
    if (s.outcome && "gain" in s.outcome) total += s.outcome.gain;
  }
  return total / plays;
}

test("the computer gets past the line instead of running into it", () => {
  // Running straight gets exactly 2 yards a play; the computer has to do better than that.
  assert.ok(averageGain("rookie", "rookie", 300) > 2.5);
  assert.ok(averageGain("pro", "pro", 300) > 3.5);
});

test("the Pro computer is clearly better than the Rookie one", () => {
  assert.ok(averageGain("pro", "pro", 300) > averageGain("rookie", "pro", 300) + 1);
});
