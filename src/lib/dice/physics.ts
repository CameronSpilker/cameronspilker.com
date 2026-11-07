/**
 * The table the dice are thrown onto: where they rest, and how a throw plays
 * out, as a small 2D simulation seen from above.
 *
 * Every die is a disc on the table. A throw sends the handful in from one
 * side; the discs slide under friction, bounce off the tray's walls, and
 * bounce off each other, so no die ever passes through another. Each die also
 * records how far it has rolled, which is what turns it over as it goes.
 *
 * Which face each die lands on is not decided here. That is the crypto roll,
 * done before the throw; the caller steers each die's final turn onto it.
 * This module only says where the dice go, so it can use any random source.
 *
 * Units are pixels and seconds. Kept free of the DOM so it can be tested.
 */

import { axisAngle, quatMultiply, type Quat, type Vec } from "./solids.ts";

export type Point = { x: number; y: number };

/** Space between dice laid out at rest, in pixels. */
export const GAP = 12;

/** A die's footprint on the table, as a disc this many times its box. */
export const BODY = 0.5;

/**
 * How close a die's centre may come to the tray's edge, as a multiple of its
 * box. More than its footprint, because a tipped die and its shadow reach a
 * little past the disc.
 */
export const WALL = 0.58;

/** The simulation's time step. Recorded frames are this far apart. */
export const DT = 1 / 120;

/** The longest a throw may take, in seconds. */
export const MAX_SECONDS = 2.8;

/** How long a die spends hopping and tumbling at the start of a throw. */
export const AIRBORNE = 0.95;

/** How many dice sit in a row at rest, and so how tall the tray must be. */
function gridShape(count: number, size: number, width: number) {
  const fit = Math.max(1, Math.floor((width + GAP) / (size + GAP)));
  const cols = Math.max(1, Math.min(count, fit));
  const rows = Math.ceil(count / cols);
  return { cols, rows, height: rows * size + (rows - 1) * GAP };
}

/**
 * The tray's height: tall enough for the dice to rest in neat rows with room
 * to spare, so a throw has somewhere to scatter.
 */
export function trayHeight(count: number, size: number, width: number): number {
  const { height, rows } = gridShape(count, size, width);
  // A row of slack per three rows, so a big handful is not packed wall to wall.
  return Math.max(200, Math.ceil(height + size * (0.9 + rows / 3)));
}

/** Dice at rest in centred rows, as their centres. */
export function gridLayout(count: number, size: number, width: number, height: number): Point[] {
  const { cols, rows, height: used } = gridShape(count, size, width);
  const top = (height - used) / 2 + size / 2;
  const out: Point[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, count - r * cols);
    const rowWidth = inRow * size + (inRow - 1) * GAP;
    const left = (width - rowWidth) / 2 + size / 2;
    for (let c = 0; c < inRow; c++) out.push({ x: left + c * (size + GAP), y: top + r * (size + GAP) });
  }
  return out;
}

/** One die's throw, frame by frame, DT apart. */
export type Track = {
  x: Float32Array;
  y: Float32Array;
  /** Height above the table, which the drawing shows as a hop. */
  lift: Float32Array;
  /** The rotation rolled so far, four numbers per frame. */
  roll: Float32Array;
  /** Distance travelled so far, for steering onto the landing face. */
  travelled: Float32Array;
};

export type Throw = { frames: number; seconds: number; tracks: Track[] };

type Body = { x: number; y: number; vx: number; vy: number; inside: boolean; spin: number };

/**
 * Play out a throw of `count` dice of box `size` onto a `width` by `height`
 * tray, coming in from the left when `fromLeft`, otherwise the right.
 */
export function simulateThrow({
  count,
  size,
  width,
  height,
  fromLeft,
  random = Math.random,
}: {
  count: number;
  size: number;
  width: number;
  height: number;
  fromLeft: boolean;
  random?: () => number;
}): Throw {
  const rho = size * BODY;
  const wall = size * WALL;
  const side = fromLeft ? -1 : 1;
  const edge = fromLeft ? 0 : width;

  // The handful, bunched just outside the entry edge in loose columns.
  const perColumn = Math.max(1, Math.floor((height - 2 * wall) / (2.15 * rho)) + 1);
  const columns = Math.ceil(count / perColumn);
  const depth = columns * 2.15 * rho;
  // A heavy throw: it comes in fast and takes a good while to wind down.
  const seconds = 1.6;
  const typical = width * 0.5 + depth * 0.5;
  const friction = (2 * typical) / (seconds * seconds);

  const bodies: Body[] = [];
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const inCol = Math.min(perColumn, count - col * perColumn);
    const span = (inCol - 1) * 2.15 * rho;
    const y0 = height / 2 - span / 2 + row * 2.15 * rho + (random() - 0.5) * 0.3 * rho;
    const x0 = edge + side * (rho * 1.1 + col * 2.15 * rho + random() * 0.3 * rho);
    // Each die is aimed at its own resting spot, so the handful spreads out.
    const target = width * (0.25 + random() * 0.6);
    const reach = Math.abs(x0 - edge) + target;
    const speed = Math.sqrt(2 * friction * reach);
    const aim = (random() - 0.5) * 0.5;
    bodies.push({
      x: x0,
      y: Math.min(height - wall, Math.max(wall, y0)),
      vx: -side * speed * Math.cos(aim),
      vy: speed * Math.sin(aim),
      inside: false,
      spin: (random() - 0.5) * 0.8,
    });
  }

  const maxFrames = Math.ceil(MAX_SECONDS / DT) + 1;
  const tracks: Track[] = bodies.map(() => ({
    x: new Float32Array(maxFrames),
    y: new Float32Array(maxFrames),
    lift: new Float32Array(maxFrames),
    roll: new Float32Array(maxFrames * 4),
    travelled: new Float32Array(maxFrames),
  }));
  const rolled: Quat[] = bodies.map(() => [1, 0, 0, 0]);
  const distance = bodies.map(() => 0);
  const hops = bodies.map(() => 0.85 + random() * 0.3);
  // While it is in the air each die also tumbles two or three whole turns
  // about its own axis, slowing as it comes down. Whole turns unwind to no
  // turn at all, so this adds to the throw without moving where it lands,
  // and it means even a die that barely travels still turns right over.
  const tumbles = bodies.map((b) => {
    const toward = Math.atan2(b.vy, b.vx);
    // The unwinding turns backwards about its axis, so the axis points the
    // opposite way to the rolling one; the two add up instead of cancelling.
    const across = toward - Math.PI / 2 + (random() - 0.5) * 1.2;
    return {
      axis: [Math.cos(across), Math.sin(across), (random() - 0.5) * 0.9] as Vec,
      turns: 2 + (random() < 0.5 ? 1 : 0),
    };
  });

  const record = (frame: number) => {
    const t = frame * DT;
    bodies.forEach((b, i) => {
      const track = tracks[i];
      track.x[frame] = b.x;
      track.y[frame] = b.y;
      // Three hops while it is first in the air, each lower than the last.
      const airborne = AIRBORNE * hops[i];
      const a = Math.min(1, t / airborne);
      track.lift[frame] = a < 1 ? Math.abs(Math.sin(Math.PI * 3 * a)) * (1 - a) ** 1.5 * size * 0.5 : 0;
      const spin = tumbles[i];
      // Fast as it leaves the hand, easing to nothing as it settles.
      const unwind = 2 * Math.PI * spin.turns * (1 - a) ** 2;
      track.roll.set(quatMultiply(axisAngle(spin.axis, unwind), rolled[i]), frame * 4);
      track.travelled[frame] = distance[i];
    });
  };

  const wallBounce = 0.45;
  const dieBounce = 0.55;
  // Smaller than the die, so it tumbles over its edges as it goes rather than
  // gliding like a ball.
  const rollRadius = size * 0.3;
  // Dice against dice: push apart, then trade momentum along the contact.
  // Later passes only separate, so a crowded table still ends with no overlap.
  const collide = (bounce: boolean, passes = 3) => {
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const min = 2 * rho;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 1e-6;
          const nx = d2 > 0 ? dx / d : 1;
          const ny = d2 > 0 ? dy / d : 0;
          const push = (min - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (bounce && vn < 0 && pass === 0) {
            const impulse = (-(1 + dieBounce) * vn) / 2;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
          }
        }
      }
      // Walls: the top and bottom always, the sides once a die is in.
      for (const b of bodies) {
        if (b.y < wall) {
          b.y = wall;
          if (b.vy < 0) b.vy = -b.vy * wallBounce;
        } else if (b.y > height - wall) {
          b.y = height - wall;
          if (b.vy > 0) b.vy = -b.vy * wallBounce;
        }
        if (!b.inside) continue;
        if (b.x < wall) {
          b.x = wall;
          if (b.vx < 0) b.vx = -b.vx * wallBounce;
        } else if (b.x > width - wall) {
          b.x = width - wall;
          if (b.vx > 0) b.vx = -b.vx * wallBounce;
        }
      }
    }
  };

  let frame = 0;
  record(0);

  while (frame < maxFrames - 1) {
    // Move, with friction. A die still outside the tray that has stalled
    // (knocked back by another, say) gets a nudge inward, so none is left
    // hanging off the edge; a die already on its way gets none, so it does
    // not overshoot.
    for (const b of bodies) {
      const speed = Math.hypot(b.vx, b.vy);
      const inward = -side * b.vx;
      if (!b.inside && inward < size * 1.5) {
        b.vx += -side * friction * DT;
      } else {
        const drop = friction * DT;
        if (speed <= drop) {
          b.vx = 0;
          b.vy = 0;
        } else {
          b.vx -= (b.vx / speed) * drop;
          b.vy -= (b.vy / speed) * drop;
        }
      }
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (!b.inside && b.x >= wall && b.x <= width - wall) b.inside = true;
    }

    collide(true);

    // Roll each die by how far it moved: forward along its path, plus a
    // little twist on the table, as real dice skid round as they go.
    frame++;
    bodies.forEach((b, i) => {
      const px = tracks[i].x[frame - 1];
      const py = tracks[i].y[frame - 1];
      const mx = b.x - px;
      const my = b.y - py;
      const moved = Math.hypot(mx, my);
      if (moved > 1e-4) {
        distance[i] += moved;
        // A slow die settles flat and slides the last of the way rather than
        // creeping over on an edge, so rolling fades out with speed.
        const speed = moved / DT;
        const rolling = Math.min(1, speed / (size * 2.5));
        const angle = (moved / rollRadius) * rolling;
        const forward = axisAngle([-my, mx, 0], angle);
        const twist = axisAngle([0, 0, 1], angle * b.spin * 0.3);
        rolled[i] = quatMultiply(twist, quatMultiply(forward, rolled[i]));
      }
    });
    record(frame);

    const settled = bodies.every((b) => b.inside && Math.hypot(b.vx, b.vy) < 2);
    const hopsDone = frame * DT > AIRBORNE * 1.15;
    if (settled && hopsDone) break;
  }

  // Let the last few tenths of a pixel of contact relax, then rewrite the
  // final frame. Too small to see, but it means resting dice never overlap.
  for (const b of bodies) {
    b.vx = 0;
    b.vy = 0;
  }
  collide(false, 300);
  bodies.forEach((b, i) => {
    tracks[i].x[frame] = b.x;
    tracks[i].y[frame] = b.y;
  });

  const frames = frame + 1;
  return {
    frames,
    seconds: frame * DT,
    tracks: tracks.map((t) => ({
      x: t.x.slice(0, frames),
      y: t.y.slice(0, frames),
      lift: t.lift.slice(0, frames),
      roll: t.roll.slice(0, frames * 4),
      travelled: t.travelled.slice(0, frames),
    })),
  };
}
