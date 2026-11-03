/**
 * The page's side of the gift list: calls to the API, and the two things a
 * browser remembers. An owner's browser keeps the edit key for each list it
 * made; a guest's browser keeps the undo token for each claim it made. Neither
 * is ever sent anywhere except back to this site.
 */
import { giftListTool as copy } from "@/content/tools";
import type { GiftItemInput, GiftList, LinkPreview } from "@/lib/gifts/types";

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function errorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "generic";
  return copy.errors[code] ?? copy.errors.generic;
}

async function call<T>(path: string, init: RequestInit & { key?: string | null } = {}): Promise<T> {
  const { key, ...rest } = init;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-edit-key"] = key;
  let res: Response;
  try {
    res = await fetch(`/api/gift-list${path}`, { ...rest, headers, cache: "no-store" });
  } catch {
    throw new ApiError("generic");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "generic");
  return data as T;
}

export const api = {
  create: (ownerName: string) =>
    call<{ slug: string; editKey: string }>("", { method: "POST", body: JSON.stringify({ ownerName }) }),
  get: (slug: string, key?: string | null) => call<GiftList>(`/${slug}`, { key }),
  update: (slug: string, key: string, patch: Record<string, unknown>) =>
    call<{ ok: true }>(`/${slug}`, { method: "PATCH", key, body: JSON.stringify(patch) }),
  addItem: (slug: string, key: string, item: GiftItemInput) =>
    call<{ id: string }>(`/${slug}/items`, { method: "POST", key, body: JSON.stringify(item) }),
  updateItem: (slug: string, key: string, id: string, item: GiftItemInput) =>
    call<{ ok: true }>(`/${slug}/items/${id}`, { method: "PATCH", key, body: JSON.stringify(item) }),
  deleteItem: (slug: string, key: string, id: string) =>
    call<{ ok: true }>(`/${slug}/items/${id}`, { method: "DELETE", key }),
  preview: (slug: string, key: string, url: string) =>
    call<LinkPreview>(`/${slug}/preview`, { method: "POST", key, body: JSON.stringify({ url }) }),
  claim: (slug: string, id: string, name: string | null) =>
    call<{ claimId: string; token: string }>(`/${slug}/items/${id}/claims`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  unclaim: (slug: string, claimId: string, token: string) =>
    call<{ ok: true }>(`/${slug}/claims/${claimId}`, { method: "DELETE", body: JSON.stringify({ token }) }),
};

/* Remembered in this browser. Storage can be blocked, so every read has a fallback. */

const OWNED = "gift-lists-owned";
const CLAIMS = "gift-list-claims";

export type OwnedList = { slug: string; key: string; title: string };

function read<T>(name: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(name) ?? "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(name: string, value: unknown) {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch {
    // Not remembered this time. The edit link still works.
  }
}

export function ownedLists(): OwnedList[] {
  const lists = read<OwnedList[]>(OWNED, []);
  return Array.isArray(lists) ? lists.filter((l) => l && typeof l.slug === "string" && typeof l.key === "string") : [];
}

export function rememberList(list: OwnedList) {
  write(OWNED, [list, ...ownedLists().filter((l) => l.slug !== list.slug)].slice(0, 20));
}

export function keyFor(slug: string): string | null {
  return ownedLists().find((l) => l.slug === slug)?.key ?? null;
}

/** claim id to undo token, per list. */
export function myClaims(slug: string): Record<string, string> {
  const all = read<Record<string, Record<string, string>>>(CLAIMS, {});
  return (all && typeof all === "object" && all[slug]) || {};
}

export function rememberClaim(slug: string, claimId: string, token: string | null) {
  const all = read<Record<string, Record<string, string>>>(CLAIMS, {});
  const mine = { ...(all[slug] ?? {}) };
  if (token) mine[claimId] = token;
  else delete mine[claimId];
  write(CLAIMS, { ...all, [slug]: mine });
}

export function shareUrl(slug: string): string {
  return `${window.location.origin}/tools/gift-list/${slug}`;
}

export function editUrl(slug: string, key: string): string {
  return `${shareUrl(slug)}/edit#key=${key}`;
}
