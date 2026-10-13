/**
 * The one JSON object the model returns, and the checks it has to pass before
 * anything else sees it.
 *
 * The schema goes to the API as a structured-output format, so the shape is
 * guaranteed by the API. What it cannot guarantee is everything a JSON Schema
 * cannot say: hex colours, sensible lengths, and builder code that keeps to the
 * contract. Those are checked here, and a failure here is sent back to the
 * model as a repair message, exactly like a failure in the sandbox.
 *
 * `accepted` and `reason` are additions to the five fields the spec named:
 * they are how the model declines an image that is not a character.
 */

export type CharacterResult = {
  accepted: boolean;
  reason: string;
  name: string;
  description: string;
  builderCode: string;
  palette: string[];
  notes: string;
};

export const CHARACTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["accepted", "reason", "name", "description", "builderCode", "palette", "notes"],
  properties: {
    accepted: {
      type: "boolean",
      description: "false if the image is not a drawing or photo of a character, creature, toy or object, or breaks the content rules.",
    },
    reason: { type: "string", description: "When accepted is false, one friendly sentence saying why. Otherwise empty." },
    name: { type: "string", description: "The character's name: the visitor's if given, otherwise a short fitting one." },
    description: { type: "string", description: "One or two sentences describing the character for the visitor." },
    builderCode: { type: "string", description: "The body of function buildCharacter(THREE, helpers). Empty when accepted is false." },
    palette: { type: "array", items: { type: "string" }, description: "3 to 6 hex colours like #a1b2c3, the drawing's main colours." },
    notes: { type: "string", description: "Short notes on how the drawing was interpreted." },
  },
} as const;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Patterns that have no business in a builder. The sandbox stops all of them
 * anyway; catching them here turns a silent sandbox failure into a repair
 * message the model can act on.
 */
const FORBIDDEN: { pattern: RegExp; what: string }[] = [
  { pattern: /\bimport\s*\(|\bimport\s+[\w{*]|\brequire\s*\(/, what: "imports" },
  { pattern: /\bimportScripts\b|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/, what: "network access" },
  { pattern: /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, what: "eval or the Function constructor" },
  { pattern: /\bdocument\b|\bwindow\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bpostMessage\b/, what: "DOM, storage or messaging" },
  { pattern: /\bTextureLoader\b|\bImageLoader\b|\bFileLoader\b|\bObjectLoader\b|\bGLTFLoader\b/, what: "loaders that fetch files" },
];

export function lintBuilder(code: string): string | null {
  if (!code.trim()) return "builderCode is empty.";
  if (code.length > 120_000) return `builderCode is ${code.length} characters; keep it under 120000.`;
  if (!/\breturn\b/.test(code)) return "builderCode must end with return { root, joints }.";
  for (const { pattern, what } of FORBIDDEN) {
    const m = code.match(pattern);
    if (m) return `builderCode uses ${what} (found "${m[0].trim()}"). Use only THREE and helpers.`;
  }
  return null;
}

export type Parsed = { ok: true; value: CharacterResult } | { ok: false; error: string };

/** Check the model's JSON. Accepts the raw text so a parse failure is reported, not thrown. */
export function parseCharacter(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "The response was not valid JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "The response must be one JSON object." };
  const o = raw as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : null);

  const accepted = o.accepted;
  if (typeof accepted !== "boolean") return { ok: false, error: "`accepted` must be a boolean." };
  const reason = str("reason", 300) ?? "";
  const name = (str("name", 60) ?? "").trim();
  const description = (str("description", 400) ?? "").trim();
  const notes = (str("notes", 600) ?? "").trim();
  const builderCode = typeof o.builderCode === "string" ? o.builderCode : "";
  const palette = Array.isArray(o.palette)
    ? o.palette.filter((c): c is string => typeof c === "string" && HEX.test(c.trim())).map((c) => c.trim().toLowerCase()).slice(0, 8)
    : [];

  if (!accepted) return { ok: true, value: { accepted, reason: reason || "That doesn't look like a character.", name, description, builderCode: "", palette, notes } };

  if (!name) return { ok: false, error: "`name` is empty." };
  if (palette.length < 1) return { ok: false, error: "`palette` needs at least one #rrggbb colour." };
  const lint = lintBuilder(builderCode);
  if (lint) return { ok: false, error: lint };
  return { ok: true, value: { accepted, reason: "", name, description, builderCode, palette, notes } };
}
