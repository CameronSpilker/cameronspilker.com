/**
 * Validation of the POST body, before any of it goes near the model.
 *
 * The browser has already converted and shrunk the image (max 1568 px on the
 * long edge, JPEG), so a real request is well under a megabyte. The limits
 * here are for requests that did not come from the page.
 */
import type { Style } from "./prompt.ts";

export const MAX_BODY_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type CharacterRequest = {
  image: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
  name: string;
  style: Style;
  notes: string;
  repair: { ticket: string; previous: string; error: string } | null;
};

export type RequestError = { code: "bad_request" | "too_large" | "unsupported"; message: string };

/** The file signature, so a renamed file cannot pose as an image. */
export function sniff(bytes: Uint8Array): CharacterRequest["image"]["mediaType"] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export function parseRequest(body: unknown): { ok: true; value: CharacterRequest } | { ok: false; error: RequestError } {
  const bad = (message: string) => ({ ok: false as const, error: { code: "bad_request" as const, message } });
  if (!body || typeof body !== "object") return bad("Expected a JSON object.");
  const b = body as Record<string, unknown>;

  if (typeof b.image !== "string") return bad("Missing image.");
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.image);
  if (!match) return { ok: false, error: { code: "unsupported", message: "Send a JPEG, PNG or WebP image." } };
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: { code: "too_large", message: "That image is too large." } };
  const mediaType = sniff(bytes);
  if (!mediaType) return { ok: false, error: { code: "unsupported", message: "That file is not a JPEG, PNG or WebP image." } };

  const style = b.style === "realistic" ? "realistic" : b.style === "faithful" || b.style === undefined ? "faithful" : null;
  if (!style) return bad("Style must be faithful or realistic.");
  const name = typeof b.name === "string" ? b.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) : "";
  const notes = typeof b.notes === "string" ? b.notes.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, 280) : "";

  let repair: CharacterRequest["repair"] = null;
  if (b.repair !== undefined && b.repair !== null) {
    const r = b.repair as Record<string, unknown>;
    if (typeof r.ticket !== "string" || typeof r.previous !== "string" || typeof r.error !== "string") return bad("Malformed repair.");
    if (r.previous.length > 150_000 || r.ticket.length > 300) return bad("Malformed repair.");
    repair = { ticket: r.ticket, previous: r.previous, error: r.error.slice(0, 600) };
  }

  return { ok: true, value: { image: { base64, mediaType }, name, style, notes, repair } };
}
