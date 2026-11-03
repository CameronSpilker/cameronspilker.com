/**
 * Whether an item is still up for grabs. One rule, shared by the page and the
 * server, so a guest never sees a button the server would refuse.
 */
import type { GiftItem } from "./types.ts";

export type ClaimState = {
  claimed: number;
  /** Null when the owner set no limit. */
  remaining: number | null;
  /** Every one the owner wanted is spoken for, so the item is struck through. */
  full: boolean;
};

export function claimState(item: Pick<GiftItem, "quantity" | "claims">): ClaimState {
  const claimed = item.claims.length;
  if (item.quantity === null) return { claimed, remaining: null, full: false };
  const remaining = Math.max(item.quantity - claimed, 0);
  return { claimed, remaining, full: remaining === 0 };
}

/** True when a claim of one more would go over what the owner asked for. */
export function wouldOverClaim(quantity: number | null, claimed: number): boolean {
  return quantity !== null && claimed >= quantity;
}
