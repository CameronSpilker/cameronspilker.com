/**
 * The shapes the gift list passes between server and page. No logic here, so
 * a client component can import it without pulling in the database driver.
 */

export type GiftClaim = {
  id: string;
  /** Optional. A guest can claim without saying who they are. */
  name: string | null;
};

export type GiftItem = {
  id: string;
  title: string;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  store: string | null;
  note: string | null;
  /** How many the owner wants. Null means no limit. */
  quantity: number | null;
  /** Empty in the owner's view, so the owner is not spoiled. */
  claims: GiftClaim[];
};

export type GiftList = {
  slug: string;
  ownerName: string;
  title: string;
  note: string;
  items: GiftItem[];
};

/** What the owner sends to add or change an item. */
export type GiftItemInput = {
  title: string;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  store: string | null;
  note: string | null;
  quantity: number | null;
};

/** What a pasted link turned into, before the owner confirms it. */
export type LinkPreview = {
  url: string;
  title: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  store: string;
};
