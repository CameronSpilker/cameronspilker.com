/**
 * The page's side of POST /api/character: send the request, read the
 * newline-delimited stream, report stages, and hand back one outcome.
 */
import type { CharacterResult } from "./schema.ts";
import type { Stage } from "./generate.ts";

export type ErrorCode =
  | "unsupported"
  | "too_large"
  | "not_a_character"
  | "rate_limited"
  | "busy"
  | "generation_failed"
  | "timeout"
  | "offline"
  | "not_configured"
  | "cancelled";

export type Generated = { ok: true; character: CharacterResult; raw: string; ticket: string | null };
export type Failed = { ok: false; code: ErrorCode; message?: string };

export type GenerateBody = {
  image: string;
  name: string;
  style: "faithful" | "realistic";
  notes: string;
  repair?: { ticket: string; previous: string; error: string };
};

const KNOWN = new Set<ErrorCode>(["unsupported", "too_large", "not_a_character", "rate_limited", "busy", "generation_failed", "not_configured"]);
const asCode = (c: unknown): ErrorCode => (KNOWN.has(c as ErrorCode) ? (c as ErrorCode) : "generation_failed");

export async function requestCharacter(
  body: GenerateBody,
  { signal, onStage }: { signal: AbortSignal; onStage?: (s: Stage) => void },
): Promise<Generated | Failed> {
  let res: Response;
  try {
    res = await fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: signal.aborted ? (signal.reason === "timeout" ? "timeout" : "cancelled") : "offline" };
  }

  if (!res.ok || !res.body) {
    let payload: { code?: unknown; message?: unknown } = {};
    try {
      payload = await res.json();
    } catch {
      // Not JSON; the status says enough.
    }
    const code = res.status === 429 ? "rate_limited" : asCode(payload.code);
    return { ok: false, code, message: typeof payload.message === "string" ? payload.message : undefined };
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let outcome: Generated | Failed | null = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === "stage" && (event.stage === "looking" || event.stage === "building")) onStage?.(event.stage);
        else if (event.type === "result" && event.character && typeof event.raw === "string")
          outcome = {
            ok: true,
            character: event.character as CharacterResult,
            raw: event.raw,
            ticket: typeof event.ticket === "string" ? event.ticket : null,
          };
        else if (event.type === "error")
          outcome = { ok: false, code: asCode(event.code), message: typeof event.message === "string" ? event.message : undefined };
      }
    }
  } catch {
    return { ok: false, code: signal.aborted ? (signal.reason === "timeout" ? "timeout" : "cancelled") : "offline" };
  }
  return outcome ?? { ok: false, code: "generation_failed" };
}
