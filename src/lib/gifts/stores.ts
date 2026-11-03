/**
 * A readable store name for a product link, shown beside the price so a guest
 * knows where the button goes before they press it.
 */

const KNOWN: [RegExp, string][] = [
  [/(^|\.)(amazon\.[a-z.]+|amzn\.to|a\.co)$/, "Amazon"],
  [/(^|\.)walmart\.com$/, "Walmart"],
  [/(^|\.)target\.com$/, "Target"],
  [/(^|\.)bestbuy\.com$/, "Best Buy"],
  [/(^|\.)costco\.com$/, "Costco"],
  [/(^|\.)etsy\.com$/, "Etsy"],
  [/(^|\.)ebay\.[a-z.]+$/, "eBay"],
  [/(^|\.)homedepot\.com$/, "Home Depot"],
  [/(^|\.)lowes\.com$/, "Lowe's"],
  [/(^|\.)rei\.com$/, "REI"],
  [/(^|\.)apple\.com$/, "Apple"],
  [/(^|\.)nike\.com$/, "Nike"],
  [/(^|\.)kohls\.com$/, "Kohl's"],
  [/(^|\.)macys\.com$/, "Macy's"],
  [/(^|\.)nordstrom\.com$/, "Nordstrom"],
  [/(^|\.)wayfair\.com$/, "Wayfair"],
  [/(^|\.)ikea\.com$/, "IKEA"],
  [/(^|\.)lego\.com$/, "LEGO"],
  [/(^|\.)sephora\.com$/, "Sephora"],
  [/(^|\.)ulta\.com$/, "Ulta"],
  [/(^|\.)dickssportinggoods\.com$/, "Dick's"],
  [/(^|\.)barnesandnoble\.com$/, "Barnes & Noble"],
];

/** "https://www.walmart.com/ip/123" to "Walmart"; unknown hosts keep their domain. */
export function storeName(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [pattern, name] of KNOWN) if (pattern.test(host)) return name;
  return host.replace(/^www\./, "").slice(0, 60);
}
