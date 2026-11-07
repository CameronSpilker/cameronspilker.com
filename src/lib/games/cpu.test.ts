/**
 * Run with `npm test`.
 *
 * The computer opponent: it runs, it dodges, it kicks when it should.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpuMove } from "./cpu.ts";
import { advance, newGame, press, type Spot, type State } from "./football.ts";

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
