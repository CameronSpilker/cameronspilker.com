/**
 * Run with `npm test`.
 *
 * A mark that lands a few points off on screen is a nuisance; one that lands
 * on the wrong edge of a rotated page is a signature in the margin of a legal
 * document. These pin the corners of each rotation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampBox,
  displaySize,
  initialsOf,
  normalizeRotation,
  placement,
  signedFileName,
  toPdfPoint,
} from "./geometry.ts";

const LETTER = { x: 0, y: 0, width: 612, height: 792 };

test("unrotated: top left of the screen is the top left of the page", () => {
  assert.deepEqual(toPdfPoint(0, 0, LETTER, 0), [0, 792]);
  assert.deepEqual(toPdfPoint(1, 1, LETTER, 0), [612, 0]);
});

test("a crop box offset from the origin is respected", () => {
  const rect = { x: 36, y: 18, width: 540, height: 756 };
  assert.deepEqual(toPdfPoint(0, 1, rect, 0), [36, 18]);
});

test("each rotation sends the displayed top left to the right corner", () => {
  // Displayed top left, for a page whose /Rotate turns it clockwise.
  assert.deepEqual(toPdfPoint(0, 0, LETTER, 90), [0, 0]);
  assert.deepEqual(toPdfPoint(0, 0, LETTER, 180), [612, 0]);
  assert.deepEqual(toPdfPoint(0, 0, LETTER, 270), [612, 792]);
});

test("rotation folds into the four legal values", () => {
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(360), 0);
});

test("a quarter turn swaps the displayed size", () => {
  assert.deepEqual(displaySize(LETTER, 90), { width: 792, height: 612 });
  assert.deepEqual(displaySize(LETTER, 180), { width: 612, height: 792 });
});

test("placement anchors at the displayed bottom left", () => {
  const got = placement({ x: 0.1, y: 0.5, w: 0.25, h: 0.05 }, LETTER, 0);
  assert.equal(got.width, 153);
  assert.ok(Math.abs(got.height - 39.6) < 1e-9);
  assert.equal(got.x, 61.2);
  assert.ok(Math.abs(got.y - 792 * 0.45) < 1e-9);
  assert.equal(got.rotate, 0);
});

test("clampBox keeps a box on the page", () => {
  assert.deepEqual(clampBox({ x: 0.9, y: -0.2, w: 0.3, h: 0.1 }), { x: 0.7, y: 0, w: 0.3, h: 0.1 });
  assert.deepEqual(clampBox({ x: 0.5, y: 0.5, w: 2, h: 0.1 }), { x: 0, y: 0.5, w: 1, h: 0.1 });
});

test("initials and file names", () => {
  assert.equal(initialsOf("  cameron   james spilker "), "CJS");
  assert.equal(initialsOf(""), "");
  assert.equal(signedFileName("Board minutes.PDF"), "Board minutes-signed.pdf");
  assert.equal(signedFileName(""), "document-signed.pdf");
});
