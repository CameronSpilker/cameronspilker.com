/**
 * Which addresses the link preview may connect to.
 *
 * The preview fetches a URL someone pasted, from inside the site's server. Left
 * alone, that is a way to make the server read its own cloud metadata service
 * or anything else on a private network. Every address a hostname resolves to
 * is checked here before a connection is made, and on every redirect.
 */

function v4Parts(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isPublicV4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false; // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol, documentation
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast and reserved
  return true;
}

export function isPublicAddress(ip: string): boolean {
  const v4 = v4Parts(ip);
  if (v4) return isPublicV4(v4);

  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (!lower.includes(":")) return false;

  // IPv4 carried inside IPv6 (::ffff:10.0.0.1, 64:ff9b::10.0.0.1) is judged as IPv4.
  const embedded = lower.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const parts = v4Parts(embedded[1]);
    return parts ? isPublicV4(parts) : false;
  }
  // The hex spelling of a mapped address, ::ffff:a00:1.
  const mapped = lower.match(/^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return isPublicV4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }

  if (lower === "::" || lower === "::1") return false;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link local fe80::/10
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (first === 0x2001 && parseInt(lower.split(":")[1] || "0", 16) === 0x0db8) return false; // documentation
  return true;
}

/** A pasted link the preview is willing to fetch at all, before any lookup. */
export function fetchableUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".internal")) {
    return null;
  }
  return url;
}
