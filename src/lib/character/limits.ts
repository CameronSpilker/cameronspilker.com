/**
 * Rate limiting and the repair ticket, both kept in memory and nowhere else.
 *
 * The limiter counts generations per IP in a sliding window. It lives in the
 * function instance's memory, so on Vercel each warm instance keeps its own
 * count: it stops a single client hammering one instance, and the Vercel
 * Firewall rule in docs/character.md is what holds the line across instances.
 *
 * A repair (the one retry after a builder fails in the browser) should not
 * cost the visitor a second generation, but the server keeps no session to
 * know a request is a repair. So a successful generation hands back a signed
 * ticket naming a hash of the code it produced; a repair must present it, and
 * each ticket is good for one repair within ten minutes.
 */
import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export class RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** Record a hit for key if it is allowed. retryAfter is in seconds. */
  take(key: string): { ok: true } | { ok: false; retryAfter: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + this.windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return { ok: true };
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (!v.some((h) => t - h < this.windowMs)) this.hits.delete(k);
  }
}

const TICKET_MS = 10 * 60 * 1000;

export function hashCode(code: string) {
  return createHash("sha256").update(code).digest("base64url");
}

export class Tickets {
  private used = new Map<string, number>();
  private readonly secret: string;
  private readonly now: () => number;

  constructor(secret: string, now: () => number = Date.now) {
    this.secret = secret;
    this.now = now;
  }

  private sign(body: string) {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }

  issue(code: string): string {
    const body = `${randomBytes(9).toString("base64url")}.${this.now() + TICKET_MS}.${hashCode(code)}`;
    return `${body}.${this.sign(body)}`;
  }

  /** True once per ticket, for the code it was issued for, before it expires. */
  redeem(ticket: string, code: string): boolean {
    const parts = ticket.split(".");
    if (parts.length !== 4) return false;
    const [id, expires, hash, mac] = parts;
    const body = `${id}.${expires}.${hash}`;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
    const t = this.now();
    if (!(Number(expires) > t)) return false;
    if (hash !== hashCode(code)) return false;
    for (const [k, exp] of this.used) if (exp <= t) this.used.delete(k);
    if (this.used.has(id)) return false;
    this.used.set(id, Number(expires));
    return true;
  }
}

/** The client's address as Vercel reports it. Falls back to one shared bucket. */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}
