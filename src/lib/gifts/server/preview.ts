import { extractProductMeta, isBlockedPage, titleFromUrls } from "../meta.ts";
import { storeName } from "../stores.ts";
import type { LinkPreview } from "../types.ts";
import { safeFetch } from "./fetch.ts";

/**
 * A pasted link, read for its title, picture and price. Anything the shop does
 * not give up comes back null and the owner fills it in.
 *
 * When the shop sends a bot check or nothing at all, the name still comes from
 * an address: most product URLs carry it ("/ip/Hershey-s-Symphony-Candy-Bar/..."),
 * and a bare item number usually redirects to one that does before any block.
 */
export async function previewLink(input: string): Promise<LinkPreview | null> {
  const store = storeName(input);
  if (!store) return null;
  const empty: LinkPreview = { url: input, title: titleFromUrls([input]), imageUrl: null, priceCents: null, store };

  let page;
  try {
    page = await safeFetch(input);
  } catch {
    return empty;
  }
  if (!page) return empty;

  const fromAddresses = titleFromUrls([input, ...page.hops]);
  // Short links (a.co, amzn.to) land somewhere else; name the store from where they landed.
  const landed = storeName(page.hops.find((u) => !/\/blocked\b/.test(u)) ?? page.url) ?? store;
  const fallback: LinkPreview = { ...empty, title: fromAddresses, store: landed };
  if (!/html|xml/i.test(page.contentType)) return fallback;

  const meta = extractProductMeta(page.body.toString("utf8"), page.url);
  if (isBlockedPage(meta.title, page.url)) return fallback;

  return {
    url: input,
    title: meta.title ?? fromAddresses,
    imageUrl: meta.imageUrl,
    priceCents: meta.priceCents,
    store: landed,
  };
}
