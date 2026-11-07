/**
 * Run with `npm test`.
 *
 * A throw makes three promises: every die ends up on the table, no two dice
 * end up inside each other, and no die passes through another on the way.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY, DT, MAX_SECONDS, WALL, gridLayout, simulateThrow, trayHeight } from "./physics.ts";

/** A seeded source, so a failing throw can be replayed. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const CASES = [
  { count: 1, size: 120, width: 320 },
  { count: 3, size: 96, width: 310 },
  { count: 6, size: 92, width: 640 },
  { count: 21, size: 58, width: 330 },
  { count: 40, size: 54, width: 700 },
  { count: 120, size: 54, width: 900 },
];

test("every die lands on the table, apart from the others", () => {
  for (const c of CASES) {
    const height = trayHeight(c.count, c.size, c.width);
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const fromLeft of [true, false]) {
        const t = simulateThrow({ ...c, height, fromLeft, random: seeded(seed) });
        const last = t.frames - 1;
        const rho = c.size * BODY;
        const wall = c.size * WALL;
        const at = t.tracks.map((track) => ({ x: track.x[last], y: track.y[last] }));
        for (const p of at) {
          assert.ok(p.x >= wall - 0.5 && p.x <= c.width - wall + 0.5, `x ${p.x} in ${c.width}`);
          assert.ok(p.y >= wall - 0.5 && p.y <= height - wall + 0.5, `y ${p.y} in ${height}`);
        }
        for (let i = 0; i < at.length; i++)
          for (let j = i + 1; j < at.length; j++) {
            const d = Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y);
            assert.ok(d >= 2 * rho - 1, `dice ${i} and ${j} rest ${(2 * rho - d).toFixed(1)}px inside each other`);
          }
        assert.ok(t.seconds <= MAX_SECONDS + DT);
      }
    }
  }
});

test("no die passes through another mid throw", () => {
  for (const c of CASES.slice(0, 4)) {
    const height = trayHeight(c.count, c.size, c.width);
    const t = simulateThrow({ ...c, height, fromLeft: true, random: seeded(9) });
    const rho = c.size * BODY;
    for (let f = 0; f < t.frames; f++) {
      for (let i = 0; i < c.count; i++)
        for (let j = i + 1; j < c.count; j++) {
          const d = Math.hypot(t.tracks[i].x[f] - t.tracks[j].x[f], t.tracks[i].y[f] - t.tracks[j].y[f]);
          // A deep overlap is a die going through another. Contact squeezes a little.
          assert.ok(d >= rho, `frame ${f}: dice ${i} and ${j} overlap by ${(2 * rho - d).toFixed(1)}px`);
        }
    }
  }
});

test("a throw comes in from the side it was thrown from, and settles", () => {
  const t = simulateThrow({ count: 3, size: 96, width: 320, height: 240, fromLeft: true, random: seeded(7) });
  for (const track of t.tracks) {
    assert.ok(track.x[0] < 0, "starts off the left edge");
    assert.ok(track.travelled[t.frames - 1] > 0, "rolled some way");
    assert.equal(track.lift[t.frames - 1], 0, "ends on the table");
  }
  const right = simulateThrow({ count: 3, size: 96, width: 320, height: 240, fromLeft: false, random: seeded(7) });
  for (const track of right.tracks) assert.ok(track.x[0] > 320, "starts off the right edge");
  assert.ok(t.seconds > 0.8 && t.seconds < MAX_SECONDS + DT, `took ${t.seconds}s`);
});

test("the resting grid fits the tray without overlap", () => {
  for (const c of CASES) {
    const height = trayHeight(c.count, c.size, c.width);
    const grid = gridLayout(c.count, c.size, c.width, height);
    assert.equal(grid.length, c.count);
    for (const p of grid) {
      assert.ok(p.x - c.size / 2 >= -0.5 && p.x + c.size / 2 <= c.width + 0.5);
      assert.ok(p.y - c.size / 2 >= -0.5 && p.y + c.size / 2 <= height + 0.5);
    }
  }
});

test("every die turns right over, at least twice, however short its throw", () => {
  for (const c of CASES) {
    const height = trayHeight(c.count, c.size, c.width);
    for (const seed of [1, 2, 3]) {
      const t = simulateThrow({ ...c, height, fromLeft: seed % 2 === 0, random: seeded(seed) });
      for (const track of t.tracks) {
        // Add up the angle turned between each frame and the next.
        let turned = 0;
        for (let f = 1; f < t.frames; f++) {
          let d = 0;
          for (let k = 0; k < 4; k++) d += track.roll[(f - 1) * 4 + k] * track.roll[f * 4 + k];
          turned += 2 * Math.acos(Math.min(1, Math.abs(d)));
        }
        assert.ok(turned / (2 * Math.PI) >= 2, `turned ${(turned / (2 * Math.PI)).toFixed(2)} times`);
      }
    }
  }
});
