/**
 * Run with `npm test`.
 *
 * The gift list's pure parts: the names that keep lists apart, the prices,
 * the page reader behind link previews, the address check that keeps the
 * preview off private networks, and the claim rule that decides a strike.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLUG_PATTERN, hashSecret, makeSlug, newSecret, randomCode, secretMatches, slugifyName } from "./ids.ts";
import { formatPrice, parsePrice, priceInputValue } from "./price.ts";
import { storeName } from "./stores.ts";
import { cleanTitle, extractProductMeta, isBlockedPage, titleFromUrl } from "./meta.ts";
import { fetchableUrl, isPublicAddress } from "./address.ts";
import { readItem, readListDetails } from "./input.ts";
import { claimState, wouldOverClaim } from "./claims.ts";

test("slugs read as a name and stay unguessable", () => {
  assert.equal(slugifyName("Cameron Spilker"), "cameron-spilker");
  assert.equal(slugifyName("  Zoë  O'Brien!! "), "zoe-o-brien");
  assert.equal(slugifyName("李"), "");
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const slug = makeSlug("Cameron");
    assert.match(slug, SLUG_PATTERN);
    assert.ok(slug.startsWith("cameron-"));
    seen.add(slug);
  }
  assert.equal(seen.size, 2000, "no collisions in a few thousand");
  assert.match(makeSlug("李"), SLUG_PATTERN, "a name with nothing usable still gets a code");
  assert.equal(randomCode().length, 8);
  assert.doesNotMatch(randomCode(400), /[01ilo]/, "no look-alike characters");
});

test("the slug pattern refuses paths and odd input", () => {
  for (const bad of ["", "../etc", "cameron", "cameron-ABCDEFGH", "cameron-k7f2qx9", "cameron--k7f2qx9m", "-k7f2qx9m"]) {
    assert.doesNotMatch(bad, SLUG_PATTERN, bad);
  }
});

test("a secret matches its own hash and nothing else", () => {
  const key = newSecret();
  assert.ok(key.length >= 32);
  assert.ok(secretMatches(key, hashSecret(key)));
  assert.ok(!secretMatches(newSecret(), hashSecret(key)));
  assert.ok(!secretMatches(key, "not-a-hash"));
});

test("prices parse the way people type them", () => {
  assert.equal(parsePrice("$24.99"), 2499);
  assert.equal(parsePrice("1,299.00"), 129900);
  assert.equal(parsePrice("25"), 2500);
  assert.equal(parsePrice(19.5), 1950);
  assert.equal(parsePrice("USD 30.10"), 3010);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("free"), null);
  assert.equal(parsePrice(-4), null);
  assert.equal(formatPrice(2500), "$25");
  assert.equal(formatPrice(2499), "$24.99");
  assert.equal(formatPrice(129900), "$1,299");
  assert.equal(priceInputValue(2450), "24.50");
  assert.equal(priceInputValue(null), "");
});

test("store names come from the link", () => {
  assert.equal(storeName("https://www.amazon.com/dp/B0CFPJYX7P"), "Amazon");
  assert.equal(storeName("https://a.co/d/abc"), "Amazon");
  assert.equal(storeName("https://www.walmart.com/ip/123"), "Walmart");
  assert.equal(storeName("https://www.patagonia.com/product/x"), "patagonia.com");
  assert.equal(storeName("not a url"), null);
});

test("product pages give up title, image and price from Open Graph", () => {
  const html = `<html><head>
    <title>Ignored - Walmart.com</title>
    <meta property="og:title" content="Stanley Quencher H2.0 &amp; Straw - Walmart.com">
    <meta property="og:image" content="/images/cup.jpg">
    <meta property="product:price:amount" content="45.00">
  </head></html>`;
  assert.deepEqual(extractProductMeta(html, "https://www.walmart.com/ip/1"), {
    title: "Stanley Quencher H2.0 & Straw",
    imageUrl: "https://www.walmart.com/images/cup.jpg",
    priceCents: 4500,
  });
});

test("JSON-LD Product data fills what Open Graph leaves out", () => {
  const html = `<title>Shop</title><script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
     {"@type":"Product","name":"Trail Runner","image":["https://cdn.shop.com/a.png"],
      "offers":[{"@type":"Offer","price":"129.95","priceCurrency":"USD"}]}]}
  </script>`;
  assert.deepEqual(extractProductMeta(html, "https://shop.com/p"), {
    title: "Trail Runner",
    imageUrl: "https://cdn.shop.com/a.png",
    priceCents: 12995,
  });
});

test("an Amazon page without Open Graph still yields its picture and price", () => {
  const html = `<title>Amazon.com: Kindle Paperwhite 16GB : Amazon Devices &amp; Accessories</title>
    <img alt="x" id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/61.jpg" src="https://m.media-amazon.com/images/I/41.jpg">
    <span class="a-price"><span class="a-offscreen">$159.99</span></span>`;
  assert.deepEqual(extractProductMeta(html, "https://www.amazon.com/dp/B0CFPJYX7P"), {
    title: "Kindle Paperwhite 16GB",
    imageUrl: "https://m.media-amazon.com/images/I/61.jpg",
    priceCents: 15999,
  });
});

test("a page with nothing useful gives nulls, never junk", () => {
  assert.deepEqual(extractProductMeta("<html></html>", "https://x.com"), { title: null, imageUrl: null, priceCents: null });
  assert.equal(extractProductMeta(`<meta property="og:image" content="javascript:alert(1)">`, "https://x.com").imageUrl, null);
  assert.equal(cleanTitle("LEGO Botanical Bouquet | Target"), "LEGO Botanical Bouquet");
});

test("the link preview stays off private networks", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "224.0.0.1"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ["93.184.216.34", "54.239.28.85", "2606:4700::6810:85e5", "::ffff:93.184.216.34"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
  assert.equal(fetchableUrl("file:///etc/passwd"), null);
  assert.equal(fetchableUrl("http://localhost:3000/"), null);
  assert.equal(fetchableUrl("https://user:pw@shop.com/"), null);
  assert.equal(fetchableUrl("https://shop.com:8443/"), null);
  assert.ok(fetchableUrl("https://www.amazon.com/dp/1"));
});

test("item input is checked, not silently trimmed", () => {
  const ok = readItem({ title: "  Socks  ", url: "https://shop.com/s", priceCents: 1200, quantity: null });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.title, "Socks");
    assert.equal(ok.value.quantity, null);
  }
  assert.deepEqual(readItem({ title: "" }), { ok: false, error: "title_required" });
  assert.deepEqual(readItem({ title: "x", url: "javascript:alert(1)" }), { ok: false, error: "bad_url" });
  assert.deepEqual(readItem({ title: "x", quantity: 0 }), { ok: false, error: "bad_quantity" });
  assert.deepEqual(readItem({ title: "x", priceCents: 1.5 }), { ok: false, error: "bad_price" });
  assert.deepEqual(readListDetails({ ownerName: " " }), { ok: false, error: "name_required" });
});

test("an item strikes through only when every one wanted is claimed", () => {
  const claims = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), name: null }));
  assert.equal(claimState({ quantity: 1, claims: claims(0) }).full, false);
  assert.equal(claimState({ quantity: 1, claims: claims(1) }).full, true);
  assert.deepEqual(claimState({ quantity: 3, claims: claims(1) }), { claimed: 1, remaining: 2, full: false });
  assert.equal(claimState({ quantity: 3, claims: claims(3) }).full, true);
  assert.deepEqual(claimState({ quantity: null, claims: claims(40) }), { claimed: 40, remaining: null, full: false });
  assert.equal(wouldOverClaim(2, 2), true);
  assert.equal(wouldOverClaim(null, 1000), false);
});

test("a name comes from the link when the page gives nothing", () => {
  assert.equal(
    titleFromUrl("https://www.walmart.com/ip/Hershey-s-Symphony-Chocolate-Almond-Toffee-Giant-Candy-Bar-7-37-oz-25-Pieces/793288688"),
    "Hershey's Symphony Chocolate Almond Toffee Giant Candy Bar 7.37 oz 25 Pieces",
  );
  assert.equal(titleFromUrl("https://www.amazon.com/Kindle-Paperwhite-16GB/dp/B0CFPJYX7P?ref=x"), "Kindle Paperwhite 16GB");
  assert.equal(
    titleFromUrl("https://www.target.com/p/stanley-40oz-quencher-tumbler/-/A-87553478"),
    "Stanley 40oz Quencher Tumbler",
  );
  assert.equal(titleFromUrl("https://www.amazon.com/dp/B0CFPJYX7P"), null, "an id alone is not a name");
  assert.equal(titleFromUrl("not a url"), null);
});

test("a bot check is recognised, not read as the product", () => {
  assert.ok(isBlockedPage("Robot or human?", "https://www.walmart.com/ip/x/1"));
  assert.ok(isBlockedPage(null, "https://www.walmart.com/blocked?url=abc"));
  assert.ok(isBlockedPage("Product not found", "https://www.target.com/p/x/-/A-1"));
  assert.ok(!isBlockedPage("Kindle Paperwhite", "https://www.amazon.com/dp/B0CFPJYX7P"));
});

test("Walmart's page, as it serves it, gives title, picture and price", () => {
  const html = `<title>Hershey&#x27;s, Symphony Chocolate Almond Toffee Giant Candy Bar, 7.37 oz - Walmart.com</title>
    <meta property="og:title" content="Hershey&#x27;s Symphony Chocolate Almond Toffee Giant Candy, Bar 7.37 oz, 25 Pieces - Walmart.com"/>
    <meta property="og:image" content="https://i5.walmartimages.com/seo/Hershey-s-Symphony_d3e70bfa.jpeg"/>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Hershey's Symphony","offers":[{"@type":"Offer","priceCurrency":"USD","price":3.97}]}</script>`;
  assert.deepEqual(extractProductMeta(html, "https://www.walmart.com/ip/x/793288688"), {
    title: "Hershey's Symphony Chocolate Almond Toffee Giant Candy, Bar 7.37 oz, 25 Pieces",
    imageUrl: "https://i5.walmartimages.com/seo/Hershey-s-Symphony_d3e70bfa.jpeg",
    priceCents: 397,
  });
});

test("Amazon's own price is the one in its main price box, not the first on the page", () => {
  const html = `<title>Kindle Paperwhite 16 GB | Fastest Kindle E-Reader | Amazon</title>
    <div><span class="a-offscreen">$18.21</span></div>
    <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">$121.49</span></span></div>`;
  const meta = extractProductMeta(html, "https://www.amazon.com/dp/B0CFPJYX7P");
  assert.equal(meta.priceCents, 12149);
  assert.equal(meta.title, "Kindle Paperwhite 16 GB | Fastest Kindle E-Reader");
});
