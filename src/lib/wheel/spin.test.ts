/**
 * Run with `npm test`.
 *
 * The one promise a wheel makes is that the slice under the pointer is the
 * winner it announces. These check that for every slice, at many starting
 * angles, and that every spin goes forward.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LABEL, parseOptions, pickIndex, targetRotation, winnerAt } from "./spin.ts";

test("the wheel stops on the slice it picked, from any start", () => {
  for (const n of [1, 2, 3, 5, 8, 13, 37, 100]) {
    for (let index = 0; index < n; index++) {
      for (const current of [0, 17.5, 359, 360 * 7 + 123, -45]) {
        for (const offset of [0, 0.5, 0.999]) {
          const target = targetRotation(current, index, n, 5, offset);
          assert.equal(winnerAt(target, n), index, `n=${n} index=${index} current=${current}`);
          assert.ok(target - current >= 5 * 360, "spins at least the asked turns, forward");
        }
      }
    }
  }
});

test("winnerAt reads the slice under twelve o'clock", () => {
  // Unturned, the pointer sits at the start of slice 0.
  assert.equal(winnerAt(0, 4), 0);
  // A small clockwise turn brings the last slice under the pointer.
  assert.equal(winnerAt(10, 4), 3);
  assert.equal(winnerAt(-10, 4), 0);
});

test("pickIndex stays in range", () => {
  assert.equal(pickIndex(5, () => 0), 0);
  assert.equal(pickIndex(5, () => 0.999999), 4);
  assert.equal(pickIndex(5, () => 1), 4);
  assert.throws(() => pickIndex(0));
});

test("parseOptions splits lines, or commas on one line", () => {
  assert.deepEqual(parseOptions("Pizza\n  Tacos \n\nSushi"), ["Pizza", "Tacos", "Sushi"]);
  assert.deepEqual(parseOptions("a, b,,c"), ["a", "b", "c"]);
  assert.deepEqual(parseOptions("x".repeat(60)), ["x".repeat(MAX_LABEL)]);
  assert.deepEqual(parseOptions("   "), []);
});
