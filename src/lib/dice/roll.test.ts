/**
 * Run with `npm test`.
 *
 * A dice roller makes one promise: every face is as likely as every other.
 * These check the rejection step that makes that exact, then roll a lot of
 * real dice through the crypto source and check the spread.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIE_SIDES,
  MAX_GROUPS,
  MAX_PER_GROUP,
  clampCount,
  contrast,
  edgeFor,
  INK_LIGHT,
  inkFor,
  normalizeHex,
  notation,
  parseSavedGroups,
  randomFace,
  rollGroups,
  shapeKey,
  type DiceGroup,
} from "./roll.ts";

const RANGE = 2 ** 32;

/** A source that hands back these values in order, and counts the draws. */
function scripted(values: number[]) {
  let i = 0;
  const source = () => {
    if (i >= values.length) throw new Error("Drew more than expected.");
    return values[i++];
  };
  return Object.assign(source, { drawn: () => i });
}

test("faces cover 1 to sides and nothing else", () => {
  for (const sides of DIE_SIDES) {
    assert.equal(randomFace(sides, scripted([0])), 1);
    assert.equal(randomFace(sides, scripted([sides - 1])), sides);
    assert.equal(randomFace(sides, scripted([sides])), 1);
  }
});

test("draws in the biased tail are thrown away and redrawn", () => {
  for (const sides of DIE_SIDES) {
    const limit = RANGE - (RANGE % sides);
    // The last accepted draw is the top face.
    assert.equal(randomFace(sides, scripted([limit - 1])), sides);
    if (limit < RANGE) {
      // Every draw at or past the limit is rejected, however many come.
      const source = scripted([limit, RANGE - 1, limit + 1, 4]);
      assert.equal(randomFace(sides, source), (4 % sides) + 1);
      assert.equal(source.drawn(), 4);
    }
  }
});

test("every face has exactly the same number of accepted draws", () => {
  // Accepted draws are [0, limit), and limit is a multiple of sides, so each
  // remainder appears limit / sides times. This is the whole fairness claim.
  for (const sides of DIE_SIDES) {
    const limit = RANGE - (RANGE % sides);
    assert.equal(limit % sides, 0);
    assert.ok(limit > RANGE / 2, "rejection stays rare");
  }
});

test("real rolls spread evenly over every face", () => {
  // Chi-squared goodness of fit. The thresholds sit near p = 0.00001 for each
  // die's degrees of freedom, so an honest source fails about once in a
  // hundred thousand runs, and a source that skipped faces or leaned on low
  // ones fails every time.
  const critical: Record<number, number> = { 4: 25, 6: 28, 8: 31, 10: 34, 12: 37, 20: 50, 100: 162 };
  for (const sides of DIE_SIDES) {
    const rolls = sides * 4000;
    const counts = new Array(sides + 1).fill(0);
    for (let i = 0; i < rolls; i++) {
      const face = randomFace(sides);
      assert.ok(Number.isInteger(face) && face >= 1 && face <= sides);
      counts[face]++;
    }
    const expected = rolls / sides;
    let chi = 0;
    for (let f = 1; f <= sides; f++) chi += (counts[f] - expected) ** 2 / expected;
    assert.ok(chi < critical[sides], `d${sides}: chi squared ${chi.toFixed(1)}`);
  }
});

test("a die needs a sensible number of sides", () => {
  assert.throws(() => randomFace(0));
  assert.throws(() => randomFace(2.5));
  assert.throws(() => randomFace(Number.NaN));
});

test("rollGroups sums each set and the whole roll", () => {
  const groups: DiceGroup[] = [
    { id: 1, sides: 6, count: 3, colour: "#ffffff" },
    { id: 2, sides: 20, count: 1, colour: "#000000" },
  ];
  // Faces: 2, 6, 1 on the d6s, then 20 on the d20.
  const result = rollGroups(groups, scripted([1, 5, 0, 19]));
  assert.deepEqual(result.groups[0].values, [2, 6, 1]);
  assert.equal(result.groups[0].sum, 9);
  assert.deepEqual(result.groups[1].values, [20]);
  assert.equal(result.total, 29);
  assert.equal(result.key, shapeKey(groups));
});

test("shapeKey changes with the dice, not with the colour", () => {
  const a: DiceGroup[] = [{ id: 1, sides: 6, count: 2, colour: "#ffffff" }];
  assert.equal(shapeKey(a), shapeKey([{ ...a[0], colour: "#123456" }]));
  assert.notEqual(shapeKey(a), shapeKey([{ ...a[0], count: 3 }]));
  assert.notEqual(shapeKey(a), shapeKey([{ ...a[0], sides: 8 }]));
  assert.notEqual(shapeKey(a), shapeKey([{ ...a[0], id: 2 }]));
});

test("notation reads like a tabletop", () => {
  assert.equal(notation([{ count: 2, sides: 6 }, { count: 1, sides: 20 }]), "2d6 + 1d20");
});

test("normalizeHex takes three or six digits, with or without #", () => {
  assert.equal(normalizeHex("#ABCDEF"), "#abcdef");
  assert.equal(normalizeHex(" abcdef "), "#abcdef");
  assert.equal(normalizeHex("#f0a"), "#ff00aa");
  assert.equal(normalizeHex("f0a"), "#ff00aa");
  for (const bad of ["", "#", "#abcd", "#abcdeg", "red", "##abcdef", "#abcdef0"]) {
    assert.equal(normalizeHex(bad), null, bad);
  }
});

test("the number on a die always clears 3:1, the bar for large text", () => {
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        assert.ok(contrast(hex, inkFor(hex)) >= 3, hex);
        assert.match(edgeFor(hex), /^#[0-9a-f]{6}$/);
        // White wherever it is good enough, as on real dice.
        if (contrast(hex, INK_LIGHT) >= 3) assert.equal(inkFor(hex), INK_LIGHT);
      }
    }
  }
});

test("clampCount keeps counts whole and in range", () => {
  assert.equal(clampCount(0), 1);
  assert.equal(clampCount(-4), 1);
  assert.equal(clampCount(3.4), 3);
  assert.equal(clampCount(MAX_PER_GROUP + 5), MAX_PER_GROUP);
  assert.equal(clampCount(Number.NaN), 1);
});

test("parseSavedGroups trusts nothing", () => {
  assert.equal(parseSavedGroups(null), null);
  assert.equal(parseSavedGroups([]), null);
  assert.equal(parseSavedGroups([{ sides: 7, count: 1, colour: "#ffffff" }]), null);
  assert.equal(parseSavedGroups([{ sides: 6, count: "2", colour: "#ffffff" }]), null);
  assert.equal(parseSavedGroups([{ sides: 6, count: 2, colour: "blue" }]), null);
  assert.equal(parseSavedGroups(["2d6"]), null);
  assert.deepEqual(parseSavedGroups([{ sides: 20, count: 99, colour: "#FFF", id: 40 }]), [
    { id: 1, sides: 20, count: MAX_PER_GROUP, colour: "#ffffff" },
  ]);
  const many = Array.from({ length: 10 }, () => ({ sides: 6, count: 1, colour: "#000" }));
  assert.equal(parseSavedGroups(many)?.length, MAX_GROUPS);
});
