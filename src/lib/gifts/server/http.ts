import { NextResponse } from "next/server";
import { SLUG_PATTERN } from "../ids.ts";
import { GiftError, NotConfigured } from "./store.ts";

export type SlugContext = { params: Promise<{ slug: string }> };
export type ItemContext = { params: Promise<{ slug: string; id: string }> };

export const EDIT_KEY_HEADER = "x-edit-key";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function fail(error: string, status = 400) {
  return json({ error }, status);
}

export function editKey(req: Request): string | null {
  return req.headers.get(EDIT_KEY_HEADER);
}

export function validSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Turns the store's errors into the status codes the page expects. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof GiftError) return fail(error.code, error.status);
    if (error instanceof NotConfigured) return fail("not_configured", 503);
    console.error("gift list", error);
    return fail("server_error", 500);
  }
}
