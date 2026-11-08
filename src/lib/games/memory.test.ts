/**
 * Run with `npm test`.
 *
 * Color Echo's rules, played with a scripted random source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { completed, newGame, pick, press, round, startInput, tempo, type Pad, type State } from "./memory.ts";

/** A random source that returns pads in this order, then repeats it. */
function script(...pads: Pad[]) {
  let i = 0;
  return () => (pads[i++ % pads.length] + 0.5) / 4;
}

/** Repeat the whole current sequence back. */
function repeat(state: State, rng: () => number) {
  let s = startInput(state);
  let result = "ignored";
  for (const pad of s.sequence) ({ state: s, result } = press(s, pad, rng));
  return { state: s, result };
}

test("pick maps the random range onto the four pads", () => {
  assert.equal(pick(() => 0), 0);
  assert.equal(pick(() => 0.26), 1);
  assert.equal(pick(() => 0.99), 3);
  assert.equal(pick(() => 1), 3);
});

test("a game starts on round 1 with one pad to watch", () => {
  const s = newGame(10, script(2));
  assert.deepEqual(s.sequence, [2]);
  assert.equal(s.phase, "show");
  assert.equal(round(s), 1);
  assert.equal(completed(s), 0);
});

test("presses are ignored while the sequence plays", () => {
  const s = newGame(10, script(2));
  assert.equal(press(s, 2, script(0)).result, "ignored");
});

test("repeating the sequence adds one pad and plays it back", () => {
  const rng = script(1, 3, 0);
  const { state, result } = repeat(newGame(10, rng), rng);
  assert.equal(result, "round");
  assert.equal(state.phase, "show");
  assert.deepEqual(state.sequence, [1, 3]);
  assert.equal(completed(state), 1);
});

test("a right press partway through keeps the round going", () => {
  const rng = script(1, 3, 0);
  let s = repeat(newGame(10, rng), rng).state;
  s = startInput(s);
  const step = press(s, 1, rng);
  assert.equal(step.result, "correct");
  assert.equal(step.state.input, 1);
  assert.equal(step.state.phase, "input");
});

test("one wrong press ends the game and remembers the right pad", () => {
  const rng = script(1, 3, 0);
  let s = repeat(newGame(10, rng), rng).state;
  s = startInput(s);
  s = press(s, 1, rng).state;
  const step = press(s, 2, rng);
  assert.equal(step.result, "wrong");
  assert.equal(step.state.phase, "lost");
  assert.equal(step.state.expected, 3);
  assert.equal(completed(step.state), 1);
});

test("finishing round 10 wins a 10 round game", () => {
  const rng = script(0, 1, 2, 3);
  let s = newGame(10, rng);
  for (let r = 1; r < 10; r++) s = repeat(s, rng).state;
  assert.equal(round(s), 10);
  const last = repeat(s, rng);
  assert.equal(last.result, "won");
  assert.equal(last.state.phase, "won");
  assert.equal(completed(last.state), 10);
});

test("endless keeps adding pads past 10", () => {
  const rng = script(3, 2, 1);
  let s = newGame(null, rng);
  for (let r = 1; r <= 12; r++) s = repeat(s, rng).state;
  assert.equal(s.phase, "show");
  assert.equal(round(s), 13);
});

test("playback speeds up at rounds 5, 9 and 13", () => {
  const on = [1, 4, 5, 8, 9, 12, 13, 30].map((r) => tempo(r).onMs);
  assert.deepEqual(on, [580, 580, 460, 460, 360, 360, 280, 280]);
});
