/**
 * Run with `npm test`.
 *
 * Formatting is where a correct number becomes a wrong one on screen. Each case
 * below is a boundary that reads as nonsense if the rounding happens after the
 * split rather than before it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, formatDuration, formatOffset } from "./format.ts";

test("durations round to the unit they are shown in", () => {
  assert.equal(formatDuration(299_900), "5m 00s");
  assert.equal(formatDuration(3_599_700), "1h 00m");
  assert.equal(formatDuration(59_600), "60s");
});

test("durations pick a unit that keeps them readable", () => {
  assert.equal(formatDuration(0), "0ms");
  assert.equal(formatDuration(840), "840ms");
  assert.equal(formatDuration(9_440), "9.4s");
  assert.equal(formatDuration(45_000), "45s");
  assert.equal(formatDuration(150_000), "2m 30s");
  assert.equal(formatDuration(3_780_000), "1h 03m");
});

test("offsets read as clock positions within the run", () => {
  assert.equal(formatOffset(0), "0:00");
  assert.equal(formatOffset(105_000), "1:45");
  assert.equal(formatOffset(3_750_000), "1:02:30");
});

test("bytes use the units the warehouses bill in", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(10_485_760), "10.5 MB");
  assert.equal(formatBytes(2_500_000_000), "2.5 GB");
});
