import { extractProductMeta } from "../meta.ts";
import { storeName } from "../stores.ts";
import type { LinkPreview } from "../types.ts";
import { safeFetch } from "./fetch.ts";

/**
 * A pasted link, read for its title, picture and price. Anything the shop does
 * not give up comes back null and the owner fills it in; a shop that refuses
 * outright still gives a usable preview with just the link and the store name.
 */
export async function previewLink(input: string): Promise<LinkPreview | null> {
  const store = storeName(input);
  if (!store) return null;
  const empty: LinkPreview = { url: input, title: null, imageUrl: null, priceCents: null, store };

  let page;
  try {
    page = await safeFetch(input);
  } catch {
    return empty;
  }
  if (!page || !/html|xml/i.test(page.contentType)) return empty;

  // Short links (a.co, amzn.to) land somewhere else; name the store from where they landed.
  const meta = extractProductMeta(page.body.toString("utf8"), page.url);
  const robotWall = /captcha|robot check|access denied|are you a human/i.test(meta.title ?? "");
  if (robotWall) return { ...empty, store: storeName(page.url) ?? store };

  return {
    url: input,
    title: meta.title,
    imageUrl: meta.imageUrl,
    priceCents: meta.priceCents,
    store: storeName(page.url) ?? store,
  };
}
