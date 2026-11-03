import { extractProductMeta, isBlockedPage, titleFromUrl } from "../meta.ts";
import { storeName } from "../stores.ts";
import type { LinkPreview } from "../types.ts";
import { safeFetch } from "./fetch.ts";

/**
 * A pasted link, read for its title, picture and price. Anything the shop does
 * not give up comes back null and the owner fills it in.
 *
 * When the shop sends a bot check or nothing at all, the name still comes from
 * the link: most product URLs carry it ("/ip/Hershey-s-Symphony-Candy-Bar/...").
 */
export async function previewLink(input: string): Promise<LinkPreview | null> {
  const store = storeName(input);
  if (!store) return null;
  const fromLink: LinkPreview = { url: input, title: titleFromUrl(input), imageUrl: null, priceCents: null, store };

  let page;
  try {
    page = await safeFetch(input);
  } catch {
    return fromLink;
  }
  if (!page || !/html|xml/i.test(page.contentType)) return fromLink;

  const meta = extractProductMeta(page.body.toString("utf8"), page.url);
  // Short links (a.co, amzn.to) land somewhere else; name the store from where they landed.
  const landed = storeName(page.url) ?? store;
  if (isBlockedPage(meta.title, page.url)) {
    return { ...fromLink, title: fromLink.title ?? titleFromUrl(page.url), store: landed };
  }

  return {
    url: input,
    title: meta.title ?? fromLink.title ?? titleFromUrl(page.url),
    imageUrl: meta.imageUrl,
    priceCents: meta.priceCents,
    store: landed,
  };
}
