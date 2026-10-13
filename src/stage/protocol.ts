/**
 * The messages that cross the sandbox boundary.
 *
 * Three parties, three trust levels:
 *
 *   page (trusted)  <-postMessage->  stage iframe (trusted code, opaque origin)
 *                                        <-postMessage->  builder worker (runs model code)
 *
 * The page never sees model code run. The stage never runs it either: it hands
 * the code to a Worker, waits for a serialised scene, and can terminate the
 * worker at any moment, including in the middle of an infinite loop. That last
 * part is why the worker exists at all: a sandboxed iframe shares a thread with
 * the page on Safari, so a loop there would freeze the tab past any timeout.
 *
 * Everything that arrives from the other side is checked by `isStageEvent` or
 * `isPageCommand` before it is used. A message is data, never a reference.
 */

export type Style = "faithful" | "realistic";

export const REQUIRED_JOINTS = ["head", "armL", "armR", "legL", "legR"] as const;
export const OPTIONAL_JOINTS = ["tail", "earL", "earR", "extra"] as const;
export type JointName = (typeof REQUIRED_JOINTS)[number] | (typeof OPTIONAL_JOINTS)[number];

export const ACTIONS = [
  { key: "wave", label: "Wave" },
  { key: "dance", label: "Dance" },
  { key: "disco", label: "Dance with shades and headphones" },
  { key: "backflip", label: "Backflip" },
  { key: "jump", label: "Jump" },
  { key: "fly", label: "Fly" },
  { key: "circles", label: "Run in circles" },
  { key: "lightning", label: "Lightning" },
  { key: "ball", label: "Into the ball" },
  { key: "bike", label: "Ride a bike" },
  { key: "scooter", label: "Ride a scooter" },
  { key: "car", label: "Drive a car" },
  { key: "tesla", label: "Ride an electric car" },
  { key: "tramp", label: "Bounce on a trampoline" },
  { key: "shoot", label: "Shoot a basketball" },
  { key: "dunk", label: "Dunk a basketball" },
  { key: "football", label: "Throw a football" },
] as const;
export type ActionKey = (typeof ACTIONS)[number]["key"];
const ACTION_KEYS = new Set<string>(ACTIONS.map((a) => a.key));

/** Limits the builder output is held to, enforced in the worker. */
export const LIMITS = {
  /** Wall clock for the builder function and serialisation together. */
  buildMs: 10_000,
  /** The prompt asks for 150k; this is the point where we refuse. */
  maxTriangles: 300_000,
  /** The prompt asks for 2000; this is the point where we refuse. */
  maxInstances: 4_000,
  maxTextures: 24,
  maxTextureSide: 2048,
  minHeight: 2,
  maxHeight: 8,
} as const;

/** What the page tells the stage to do. */
export type PageCommand =
  | { type: "load"; builderCode: string; style: Style; palette: string[]; reducedMotion: boolean }
  | { type: "fallback"; style: Style; palette: string[]; reducedMotion: boolean }
  | { type: "play"; action: ActionKey }
  | { type: "stop" }
  | { type: "spin"; on: boolean }
  | { type: "ping"; id: number };

/** What the stage reports back. */
export type StageEvent =
  | { type: "ready" }
  | { type: "built"; ok: true; triangles: number; instances: number; fallback: boolean }
  | { type: "built"; ok: false; error: string }
  | { type: "action"; action: ActionKey | null }
  | { type: "pong"; id: number };

const STYLES = new Set(["faithful", "realistic"]);
const HEX = /^#[0-9a-f]{6}$/i;

function isPalette(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 16 && value.every((c) => typeof c === "string" && HEX.test(c));
}

export function isActionKey(value: unknown): value is ActionKey {
  return typeof value === "string" && ACTION_KEYS.has(value);
}

export function isPageCommand(value: unknown): value is PageCommand {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case "load":
      return (
        typeof m.builderCode === "string" &&
        m.builderCode.length < 400_000 &&
        STYLES.has(m.style as string) &&
        isPalette(m.palette) &&
        typeof m.reducedMotion === "boolean"
      );
    case "fallback":
      return STYLES.has(m.style as string) && isPalette(m.palette) && typeof m.reducedMotion === "boolean";
    case "play":
      return isActionKey(m.action);
    case "stop":
      return true;
    case "spin":
      return typeof m.on === "boolean";
    case "ping":
      return typeof m.id === "number";
    default:
      return false;
  }
}

export function isStageEvent(value: unknown): value is StageEvent {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  switch (m.type) {
    case "ready":
      return true;
    case "built":
      return m.ok === true
        ? typeof m.triangles === "number" && typeof m.instances === "number" && typeof m.fallback === "boolean"
        : m.ok === false && typeof m.error === "string";
    case "action":
      return m.action === null || isActionKey(m.action);
    case "pong":
      return typeof m.id === "number";
    default:
      return false;
  }
}

/** Worker to stage. Internal to the iframe; still checked, since the worker ran model code. */
export type WorkerResult =
  | { ok: true; json: unknown; bitmaps: ImageBitmap[]; textureMap: Record<string, number>; triangles: number; instances: number }
  | { ok: false; error: string };
