/**
 * Cleans what arrives from a request before it reaches the database. Anything
 * that is not the right shape comes back as an error string rather than being
 * trimmed into something the owner did not type.
 */
import type { GiftItemInput } from "./types.ts";

export const LIMITS = {
  ownerName: 60,
  title: 80,
  note: 400,
  itemTitle: 200,
  itemNote: 300,
  url: 2000,
  store: 60,
  claimName: 40,
  items: 100,
  quantity: 99,
} as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length > max) return undefined;
  return trimmed || null;
}

/** Notes keep their line breaks; everything else is one line. */
function multiline(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (trimmed.length > max) return undefined;
  return trimmed || null;
}

export function webUrl(value: unknown): string | null | undefined {
  const raw = text(value, LIMITS.url);
  if (raw === undefined || raw === null) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function readItem(body: unknown): Result<GiftItemInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "bad_request" };
  const b = body as Record<string, unknown>;

  const title = text(b.title, LIMITS.itemTitle);
  if (!title) return { ok: false, error: "title_required" };

  const url = webUrl(b.url);
  const imageUrl = webUrl(b.imageUrl);
  if (url === undefined || imageUrl === undefined) return { ok: false, error: "bad_url" };

  const priceCents = b.priceCents ?? null;
  if (priceCents !== null && !(Number.isInteger(priceCents) && (priceCents as number) >= 0 && (priceCents as number) <= 100_000_000)) {
    return { ok: false, error: "bad_price" };
  }

  const quantity = b.quantity ?? null;
  if (quantity !== null && !(Number.isInteger(quantity) && (quantity as number) >= 1 && (quantity as number) <= LIMITS.quantity)) {
    return { ok: false, error: "bad_quantity" };
  }

  const store = text(b.store, LIMITS.store);
  const note = multiline(b.note, LIMITS.itemNote);
  if (store === undefined || note === undefined) return { ok: false, error: "too_long" };

  return {
    ok: true,
    value: {
      title,
      url,
      imageUrl,
      priceCents: priceCents as number | null,
      store,
      note,
      quantity: quantity as number | null,
    },
  };
}

export type ListDetails = { ownerName: string; title: string; note: string };

/** For both creating a list and editing its header. Missing fields stay missing. */
export function readListDetails(body: unknown): Result<Partial<ListDetails>> {
  if (!body || typeof body !== "object") return { ok: false, error: "bad_request" };
  const b = body as Record<string, unknown>;
  const out: Partial<ListDetails> = {};

  if ("ownerName" in b) {
    const v = text(b.ownerName, LIMITS.ownerName);
    if (!v) return { ok: false, error: "name_required" };
    out.ownerName = v;
  }
  if ("title" in b) {
    const v = text(b.title, LIMITS.title);
    if (!v) return { ok: false, error: "title_required" };
    out.title = v;
  }
  if ("note" in b) {
    const v = multiline(b.note, LIMITS.note);
    if (v === undefined) return { ok: false, error: "too_long" };
    out.note = v ?? "";
  }
  return { ok: true, value: out };
}

export function readClaimName(value: unknown): Result<string | null> {
  const v = text(value, LIMITS.claimName);
  return v === undefined ? { ok: false, error: "too_long" } : { ok: true, value: v };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
