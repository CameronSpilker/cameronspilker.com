/**
 * POST /api/character: a drawing in, a character builder out.
 *
 * The response is newline-delimited JSON, streamed so the page can show real
 * progress and so a long generation never sits on an idle connection:
 *
 *   {"type":"stage","stage":"looking"}
 *   {"type":"stage","stage":"building"}
 *   {"type":"result","character":{...},"raw":"...","ticket":"..."}
 *   or {"type":"error","code":"...","message":"..."}
 *
 * Errors found before the model is called (bad input, rate limit, missing key)
 * are ordinary HTTP errors with the same JSON error body.
 *
 * Privacy: the image and the generated code exist only in this request's
 * memory. Nothing is written to disk, a database or the logs; the only thing
 * logged is an error code. The image does go to Anthropic's API, which is what
 * the page tells the visitor.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { generateCharacter, type GenerateOutcome } from "@/lib/character/generate";
import { clientIp, RateLimiter, Tickets } from "@/lib/character/limits";
import { MAX_BODY_BYTES, parseRequest } from "@/lib/character/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A generation is aimed at under a minute; this leaves room for one retry.
export const maxDuration = 120;

const MODEL = process.env.CHARACTER_MODEL || "claude-opus-5-5";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
const EFFORT: Effort = (EFFORTS as readonly string[]).includes(process.env.CHARACTER_EFFORT ?? "")
  ? (process.env.CHARACTER_EFFORT as Effort)
  : "medium";
const PER_HOUR = Math.max(1, Number(process.env.CHARACTER_RATE_PER_HOUR) || 5);

const limiter = new RateLimiter(PER_HOUR, 60 * 60 * 1000);
const tickets = new Tickets(
  process.env.CHARACTER_TICKET_SECRET ||
    createHash("sha256").update(`character-ticket:${process.env.ANTHROPIC_API_KEY ?? "unset"}`).digest("hex"),
);

function fail(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return Response.json({ type: "error", code, message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "not_configured", "Character generation is not set up on this server yet.");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(413, "too_large", "That image is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, "too_large", "That image is too large.");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "bad_request", "Expected JSON.");
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) {
    const status = parsed.error.code === "too_large" ? 413 : parsed.error.code === "unsupported" ? 415 : 400;
    return fail(status, parsed.error.code, parsed.error.message);
  }
  const req = parsed.value;

  // A repair with a valid ticket is free; everything else counts.
  const freeRepair = req.repair ? tickets.redeem(req.repair.ticket, req.repair.previous) : false;
  if (req.repair && !freeRepair) return fail(400, "bad_request", "That retry has expired. Start again.");
  if (!freeRepair) {
    const gate = limiter.take(clientIp(request.headers));
    if (!gate.ok)
      return fail(429, "rate_limited", `You have made ${PER_HOUR} characters this hour. Try again later.`, {
        "Retry-After": String(gate.retryAfter),
      });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // The visitor cancelled; nothing to send to.
        }
      };
      const input = { imageBase64: req.image.base64, mediaType: req.image.mediaType, name: req.name, style: req.style, notes: req.notes };
      try {
        let outcome: GenerateOutcome = await generateCharacter({
          client,
          model: MODEL,
          effort: EFFORT,
          input,
          repair: req.repair ? { previous: req.repair.previous, error: req.repair.error } : undefined,
          signal,
          onStage: (stage) => send({ type: "stage", stage }),
        });
        // Output that fails validation gets one repair here, before the browser sees it.
        if (!outcome.ok && outcome.code === "invalid" && outcome.raw && !req.repair) {
          outcome = await generateCharacter({
            client,
            model: MODEL,
            effort: EFFORT,
            input,
            repair: { previous: outcome.raw, error: outcome.detail },
            signal,
          });
        }
        if (outcome.ok) {
          const { character, raw } = outcome;
          if (!character.accepted) send({ type: "error", code: "not_a_character", message: character.reason });
          else send({ type: "result", character, raw, ticket: req.repair ? null : tickets.issue(raw) });
        } else if (outcome.code === "refused") {
          send({ type: "error", code: "not_a_character", message: "We can't make a character from that image. Try a drawing or a photo of a toy." });
        } else {
          console.error("character: generation failed", outcome.code);
          send({ type: "error", code: "generation_failed", message: "The model could not build this one. Try again, or try a different image." });
        }
      } catch (error) {
        if (signal.aborted) {
          // Cancelled by the visitor: close quietly.
        } else if (error instanceof Anthropic.RateLimitError) {
          console.error("character: upstream rate limit");
          send({ type: "error", code: "busy", message: "Too many people are making characters right now. Try again in a minute." });
        } else if (error instanceof Anthropic.APIError) {
          console.error("character: api error", error.status);
          send({ type: "error", code: "generation_failed", message: "Something went wrong while building your character. Try again." });
        } else {
          console.error("character: unexpected error", (error as Error)?.name);
          send({ type: "error", code: "generation_failed", message: "Something went wrong while building your character. Try again." });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a cancel.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
