/**
 * Reads a product page's own description of itself: the Open Graph tags most
 * shops publish for link previews, schema.org Product data, and a couple of
 * fallbacks for pages that carry neither. Pure, so it is tested on fixtures.
 *
 * Regex rather than a DOM: this runs on the server over a page that is only
 * read once, and every value it takes is something the owner sees and can fix
 * before it is saved.
 */
import { parsePrice } from "./price.ts";

export type ProductMeta = {
  title: string | null;
  imageUrl: string | null;
  priceCents: number | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

/** Every <meta> on the page, keyed by property, name or itemprop. First wins. */
function metaTags(html: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(m[0]);
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();
    const value = attrs.content ?? "";
    if (key && value.trim() && !map.has(key)) map.set(key, value.trim());
  }
  return map;
}

type JsonProduct = { name?: string; image?: string; price?: number | string };

function asImage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return asImage(value[0]);
  if (value && typeof value === "object" && "url" in value) return asImage((value as { url: unknown }).url);
  return undefined;
}

function asPrice(offers: unknown): number | string | undefined {
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const price = asPrice(offer);
      if (price !== undefined) return price;
    }
    return undefined;
  }
  if (offers && typeof offers === "object") {
    const o = offers as Record<string, unknown>;
    for (const key of ["price", "lowPrice"]) {
      const v = o[key];
      if (typeof v === "number" || typeof v === "string") return v;
    }
    if (o.offers) return asPrice(o.offers);
    if (o.priceSpecification) return asPrice(o.priceSpecification);
  }
  return undefined;
}

/** The first schema.org Product in any JSON-LD block, wherever it is nested. */
function jsonLdProduct(html: string): JsonProduct | null {
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    let guard = 0;
    while (stack.length && guard++ < 500) {
      const node = stack.pop();
      if (Array.isArray(node)) {
        stack.push(...node);
      } else if (node && typeof node === "object") {
        const o = node as Record<string, unknown>;
        const type = o["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes("Product")) {
          return {
            name: typeof o.name === "string" ? o.name : undefined,
            image: asImage(o.image),
            price: asPrice(o.offers),
          };
        }
        if (o["@graph"]) stack.push(o["@graph"]);
      }
    }
  }
  return null;
}

/**
 * Shops pad titles with their own name: "Amazon.com: Kindle : Electronics",
 * "Kindle - Walmart.com", "Kindle | Target". Strip the store, keep the thing.
 */
export function cleanTitle(raw: string): string {
  let title = decodeEntities(raw).replace(/\s+/g, " ").trim();
  title = title.replace(/^amazon\.[a-z.]+\s*:\s*/i, "");
  title = title.replace(/\s+:\s+[^:]+$/, (tail) => (/amazon/i.test(tail) || title.length > 60 ? "" : tail));
  title = title.replace(/\s+[-|:–]\s+(walmart\.com|target|best buy|etsy|ebay|costco|amazon\.com|rei co-op)\s*$/i, "");
  return title.slice(0, 200).trim();
}

function absolute(url: string | undefined, base: string): string | null {
  if (!url) return null;
  try {
    const resolved = new URL(url.trim(), base);
    return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

export function extractProductMeta(html: string, pageUrl: string): ProductMeta {
  const meta = metaTags(html);
  const product = jsonLdProduct(html);

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const rawTitle = meta.get("og:title") ?? product?.name ?? meta.get("twitter:title") ?? titleTag;

  const rawImage =
    meta.get("og:image:secure_url") ??
    meta.get("og:image") ??
    product?.image ??
    meta.get("twitter:image") ??
    meta.get("twitter:image:src") ??
    // Amazon's main product image when it serves no Open Graph tags.
    html.match(/data-old-hires\s*=\s*"([^"]+)"/)?.[1] ??
    html.match(/<img\b[^>]*id\s*=\s*"landingImage"[^>]*\bsrc\s*=\s*"([^"]+)"/i)?.[1];

  const rawPrice =
    meta.get("product:price:amount") ??
    meta.get("og:price:amount") ??
    product?.price ??
    meta.get("price") ??
    // Amazon prints the price for screen readers in an offscreen span.
    html.match(/<span class="a-offscreen">\s*\$([\d,]+(?:\.\d{2})?)\s*<\/span>/)?.[1];

  return {
    title: rawTitle ? cleanTitle(rawTitle) || null : null,
    imageUrl: absolute(rawImage, pageUrl),
    priceCents: parsePrice(rawPrice ?? null),
  };
}
