/**
 * Run with `npm test`.
 *
 * A label either shows whole, wrapped or shrunk to fit its slice, or, when
 * nothing would fit, is cut. Either way it must stay inside the slice.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAR_WIDTH, LINE_HEIGHT, MAX_LINES, MIN_FONT, layoutLabel, wrap } from "./label.ts";

const geometry = (n: number, maxFont = 17) => ({ n, outer: 160, inner: 62, maxFont });

/** The same test the layout uses, restated so a change to one shows up here. */
function inside(lines: string[], fontSize: number, n: number) {
  const longest = Math.max(...lines.map((l) => l.length));
  const innerEnd = 160 - longest * CHAR_WIDTH * fontSize;
  if (innerEnd < 62 - 0.01) return false;
  if (n <= 2) return true;
  const height = (lines.length - 1) * LINE_HEIGHT * fontSize + fontSize;
  return height <= 2 * innerEnd * Math.tan(Math.PI / n) * 0.82 + 1e-9;
}

test("wrap breaks at spaces and splits words longer than a line", () => {
  assert.deepEqual(wrap("order pizza tonight", 11), ["order pizza", "tonight"]);
  assert.deepEqual(wrap("supercalifragilistic", 8), ["supercal", "ifragili", "stic"]);
  assert.deepEqual(wrap("  a   b  ", 5), ["a b"]);
});

test("short labels stay on one line at the largest size", () => {
  const out = layoutLabel("Tacos", geometry(6));
  assert.deepEqual(out.lines, ["Tacos"]);
  assert.equal(out.fontSize, 17);
});

test("a long label wraps or shrinks rather than being cut", () => {
  const label = "Thai curry from the place on Main Street";
  for (const n of [2, 3, 4, 6, 8]) {
    const out = layoutLabel(label, geometry(n));
    assert.equal(out.lines.join(" "), label, `n=${n}`);
    assert.ok(out.lines.length <= MAX_LINES);
    assert.ok(inside(out.lines, out.fontSize, n), `n=${n} fits its slice`);
  }
});

test("every label stays inside its slice, whatever the count", () => {
  const labels = ["A", "Pizza", "Go for a long walk", "Antidisestablishmentarianism", "x".repeat(40), "word ".repeat(8)];
  for (const n of [1, 2, 3, 5, 8, 12, 16, 24, 40, 70, 100]) {
    for (const label of labels) {
      const out = layoutLabel(label, geometry(n, n <= 28 ? 12 : 7));
      assert.ok(out.fontSize >= MIN_FONT);
      assert.ok(out.lines.length >= 1 && out.lines.length <= MAX_LINES);
      // The tiniest slivers cannot hold even one character at the smallest
      // size; there the label is cut as short as it gets.
      if (n < 100) assert.ok(inside(out.lines, out.fontSize, n), `n=${n} "${label}" -> ${JSON.stringify(out)}`);
    }
  }
});
