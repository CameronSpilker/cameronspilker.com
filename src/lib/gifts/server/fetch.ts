/**
 * Fetching a URL someone else chose, without letting them aim the server at
 * itself.
 *
 * Node's http client is used directly because it accepts a `lookup` function:
 * the address check runs on the very address the socket connects to, so a
 * hostname that resolves to a public address for the check and a private one
 * for the connection gets nowhere. Redirects are followed by hand, each hop
 * checked again.
 */
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import zlib from "node:zlib";
import type { LookupFunction } from "node:net";
import { fetchableUrl, isPublicAddress } from "../address.ts";

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (!list.length || bad) {
      return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

/**
 * The preview says what it is. Some shops (Amazon) serve it the product page;
 * others (Walmart) answer with a bot check, and the preview falls back to
 * what the link itself says rather than pretending to be something else.
 */
const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; GiftListPreview/1.0; +https://cameronspilker.com/tools/gift-list)",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
};

type Fetched = { url: string; contentType: string; body: Buffer };

function once(url: URL, accept: string | undefined, maxBytes: number, timeoutMs: number) {
  return new Promise<{ status: number; location?: string; contentType: string; body: Buffer }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        headers: accept ? { ...HEADERS, accept } : HEADERS,
        lookup: safeLookup,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType: "", body: Buffer.alloc(0) });
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip"
            ? res.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? res.pipe(zlib.createInflate())
              : encoding === "br"
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            // Enough of the page to find the tags in the head; stop reading.
            chunks.push(chunk.subarray(0, Math.max(0, maxBytes - (size - chunk.length))));
            req.destroy();
            stream.destroy();
            return resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) });
          }
          chunks.push(chunk);
        });
        stream.on("end", () =>
          resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }),
        );
        stream.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(
  input: string,
  { accept, maxBytes = 1_500_000, timeoutMs = 7000, maxRedirects = 5 }: {
    accept?: string;
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {},
): Promise<Fetched | null> {
  let url = fetchableUrl(input);
  for (let hop = 0; url && hop <= maxRedirects; hop++) {
    const res = await once(url, accept, maxBytes, timeoutMs);
    if (res.location) {
      url = fetchableUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) return null;
    return { url: url.toString(), contentType: res.contentType, body: res.body };
  }
  return null;
}

/** An image as a data URI, for drawing into the share card. Null on anything odd. */
export async function imageDataUri(input: string): Promise<string | null> {
  try {
    const res = await safeFetch(input, { accept: "image/png,image/jpeg,image/*;q=0.5", maxBytes: 2_000_000, timeoutMs: 3500 });
    if (!res) return null;
    const type = res.contentType.split(";")[0].trim().toLowerCase();
    // The card renderer draws PNG and JPEG reliably; a WebP or AVIF is skipped.
    if (type !== "image/png" && type !== "image/jpeg") return null;
    if (res.body.length >= 2_000_000) return null;
    return `data:${type};base64,${res.body.toString("base64")}`;
  } catch {
    return null;
  }
}
