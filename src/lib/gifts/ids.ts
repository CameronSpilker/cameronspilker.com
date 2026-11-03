import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Names for lists and the secrets that go with them.
 *
 * A share link reads `/tools/gift-list/cameron-k7f2qx9m`. The name part is for
 * people; the eight random characters are what make it unguessable and keep
 * two Camerons from ever colliding. 31 symbols over eight places is about 850
 * billion codes per name.
 *
 * The alphabet drops 0, 1, i, l and o so a link read aloud survives.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 8;
const NAME_LENGTH = 24;

export const SLUG_PATTERN = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?[2-9a-hjkmnp-z]{8}$/;

/** Uniformly random code from the alphabet, rejecting the biased bytes. */
export function randomCode(length = CODE_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && out.length < length) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

/** "Cameron Spilker" to "cameron-spilker". Empty when nothing usable is left. */
export function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, NAME_LENGTH)
    .replace(/^-+|-+$/g, "");
}

export function makeSlug(name: string): string {
  const base = slugifyName(name);
  return base ? `${base}-${randomCode()}` : randomCode();
}

/** The edit key, and the undo token a guest gets for a claim. 192 bits. */
export function newSecret(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Compares a presented secret with a stored hash in constant time. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
