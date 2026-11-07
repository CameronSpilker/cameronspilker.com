/**
 * The dice, kept apart from the DOM so the fairness can be tested.
 *
 * A roll is a list of groups (say, two d6 and one d20), each with its own
 * count and colour. Every face comes from `randomFace`, which draws from the
 * browser's cryptographic source and throws away the draws that would make
 * low faces more likely than high ones.
 */

/** The dice on offer: the standard tabletop set, d4 through percentile. */
export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieSides = (typeof DIE_SIDES)[number];

/** Most dice of one kind in a set. */
export const MAX_PER_GROUP = 20;

/** Most sets in one roll. */
export const MAX_GROUPS = 6;

/** Colours a new set takes, in order, so a second set never matches the first. */
export const DEFAULT_COLOURS = ["#0a7bd6", "#d03b3b", "#1baf7a", "#7c3aed", "#fab219", "#1f2937"];

export type DiceGroup = {
  /** Stable key for React; never shown. */
  id: number;
  sides: DieSides;
  count: number;
  /** Always `#rrggbb`, lower case. */
  colour: string;
};

export type GroupRoll = { sides: DieSides; values: number[]; sum: number };

export type RollResult = {
  /** Which configuration this roll belongs to. See `shapeKey`. */
  key: string;
  groups: GroupRoll[];
  total: number;
};

/** A uniformly random 32-bit unsigned integer. */
export type Uint32Source = () => number;

const RANGE = 2 ** 32;

export function cryptoUint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/**
 * A uniformly random face in `[1, sides]`.
 *
 * `x % sides` on its own would be slightly biased whenever 2^32 is not a
 * multiple of `sides` (it never is for 6, 10, 12, 20 or 100): the lowest faces
 * would get one extra chance each. Draws at or above the largest multiple of
 * `sides` that fits are thrown away and drawn again, which removes the bias
 * exactly. At most one draw in about 43 million is rejected for a d100, so the
 * loop almost never runs twice.
 */
export function randomFace(sides: number, source: Uint32Source = cryptoUint32): number {
  if (!Number.isInteger(sides) || sides < 1 || sides > RANGE) {
    throw new RangeError(`A die needs a whole number of sides, got ${sides}.`);
  }
  const limit = RANGE - (RANGE % sides);
  let x = source();
  while (x >= limit) x = source();
  return (x % sides) + 1;
}

/** Identifies the dice on the table: which sets, how many, what kind. */
export function shapeKey(groups: readonly DiceGroup[]): string {
  return groups.map((g) => `${g.id}:${g.count}d${g.sides}`).join(",");
}

export function rollGroups(groups: readonly DiceGroup[], source: Uint32Source = cryptoUint32): RollResult {
  const rolled = groups.map((g) => {
    const values = Array.from({ length: g.count }, () => randomFace(g.sides, source));
    return { sides: g.sides, values, sum: values.reduce((a, b) => a + b, 0) };
  });
  return { key: shapeKey(groups), groups: rolled, total: rolled.reduce((a, g) => a + g.sum, 0) };
}

/** Tabletop shorthand for what is on the table: `2d6 + 1d20`. */
export function notation(groups: readonly { count: number; sides: number }[]): string {
  return groups.map((g) => `${g.count}d${g.sides}`).join(" + ");
}

export function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_PER_GROUP, Math.max(1, Math.round(n)));
}

export function isDieSides(n: unknown): n is DieSides {
  return typeof n === "number" && (DIE_SIDES as readonly number[]).includes(n);
}

/**
 * A typed or pasted colour as `#rrggbb`, or null if it is not one. Takes three
 * or six hex digits, with or without the `#`, in either case.
 */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${raw.replace(/./g, (c) => c + c)}`;
  return null;
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#000000";

/**
 * Whichever of white or black reads better on a die of this colour. Pure black
 * rather than a softer ink, because only that pair guarantees 4.5:1 or more
 * for every colour someone can pick.
 */
export function inkFor(hex: string): string {
  return contrast(hex, INK_LIGHT) >= contrast(hex, INK_DARK) ? INK_LIGHT : INK_DARK;
}

/**
 * The colour of a die's edges and facet lines: a darker step of its body, or
 * a lighter one for dice too dark to darken visibly.
 */
export function edgeFor(hex: string): string {
  const target = luminance(hex) < 0.05 ? 255 : 0;
  const amount = target === 255 ? 0.35 : 0.32;
  const mixed = channels(hex).map((c) => Math.round(c + (target - c) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Read a saved table back, trusting nothing about it. Returns null when the
 * value is not a usable list of sets, so the caller keeps its default.
 */
export function parseSavedGroups(value: unknown): DiceGroup[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const groups: DiceGroup[] = [];
  for (const item of value.slice(0, MAX_GROUPS)) {
    if (typeof item !== "object" || item === null) return null;
    const { sides, count, colour } = item as Record<string, unknown>;
    const hex = typeof colour === "string" ? normalizeHex(colour) : null;
    if (!isDieSides(sides) || typeof count !== "number" || !hex) return null;
    groups.push({ id: groups.length + 1, sides, count: clampCount(count), colour: hex });
  }
  return groups;
}
