/**
 * The arithmetic behind the wheel, kept apart from the DOM so it can be tested.
 *
 * Angles are degrees, measured clockwise from twelve o'clock, which is where
 * the pointer sits. Slice `i` of `n` covers `[i * 360 / n, (i + 1) * 360 / n)`
 * on the wheel before it turns, and the wheel's `rotation` turns it clockwise.
 */

/** Longest option the wheel will take, in characters. */
export const MAX_LABEL = 40;

/** Most options the wheel will take. Past this the slices are slivers. */
export const MAX_OPTIONS = 100;

/**
 * Split pasted or typed text into options: one per line, or comma separated
 * when it is all on one line. Blank entries are dropped and long ones cut.
 */
export function parseOptions(text: string): string[] {
  const parts = text.includes("\n") ? text.split("\n") : text.split(",");
  return parts
    .map((part) => part.trim().slice(0, MAX_LABEL))
    .filter(Boolean);
}

/**
 * A uniformly random index in `[0, n)`. Uses the browser's cryptographic
 * source when there is one, so nobody can say the wheel was rigged.
 */
export function pickIndex(n: number, random: () => number = secureRandom): number {
  if (n < 1) throw new RangeError("Need at least one option.");
  return Math.min(n - 1, Math.floor(random() * n));
}

export function secureRandom(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Which slice sits under the pointer when the wheel is turned by `rotation`. */
export function winnerAt(rotation: number, n: number): number {
  const slice = 360 / n;
  return Math.min(n - 1, Math.floor(mod(-rotation, 360) / slice));
}

/**
 * The rotation to animate to so that slice `index` stops under the pointer.
 *
 * Always ahead of `current` by at least `turns` full turns, so the wheel
 * spins forward every time. `offset` in `[0, 1)` picks where inside the
 * slice it stops; it is kept away from the edges so the winner is never a
 * judgement call.
 */
export function targetRotation(
  current: number,
  index: number,
  n: number,
  turns: number,
  offset: number,
): number {
  const slice = 360 / n;
  const inside = 0.15 + 0.7 * Math.min(Math.max(offset, 0), 1);
  const pointerAngle = (index + inside) * slice;
  const finalMod = mod(-pointerAngle, 360);
  let target = current - mod(current, 360) + finalMod + turns * 360;
  while (target - current < turns * 360) target += 360;
  return target;
}

/** SVG path for slice `i` of `n` on a wheel of radius `r` centred at `(c, c)`. */
export function slicePath(i: number, n: number, r: number, c: number): string {
  if (n === 1) {
    return `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z`;
  }
  const slice = (2 * Math.PI) / n;
  const a0 = i * slice - Math.PI / 2;
  const a1 = (i + 1) * slice - Math.PI / 2;
  const x0 = c + r * Math.cos(a0);
  const y0 = c + r * Math.sin(a0);
  const x1 = c + r * Math.cos(a1);
  const y1 = c + r * Math.sin(a1);
  const large = slice > Math.PI ? 1 : 0;
  return `M ${c} ${c} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
}
