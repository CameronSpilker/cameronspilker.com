/**
 * One generation: the image and options in, a checked CharacterResult out.
 *
 * The Anthropic client is a parameter, the same pattern Plainstocks uses for
 * its Claude runner, so tests drive this with a fake stream and never call the
 * API. Progress is reported through `onStage` from the stream itself: the
 * model thinks first ("Looking at your drawing"), and the first output token
 * means it has started writing the builder ("Building the model").
 *
 * Nothing here logs or stores the image or the code.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { buildMessages, SYSTEM_PROMPT, type GenerateInput, type Repair } from "./prompt.ts";
import { CHARACTER_SCHEMA, parseCharacter, type CharacterResult } from "./schema.ts";

export type Stage = "looking" | "building";

export type GenerateOptions = {
  client: Pick<Anthropic, "beta">;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  input: GenerateInput;
  repair?: Repair;
  signal?: AbortSignal;
  onStage?: (stage: Stage) => void;
};

export type GenerateOutcome =
  | { ok: true; character: CharacterResult; raw: string }
  | { ok: false; code: "refused" | "truncated" | "invalid"; detail: string; raw?: string };

/** Server-side refusal fallbacks exist for Opus, Sonnet 5.5 and Fable; not for Haiku. */
export function supportsFallbacks(model: string) {
  return /^claude-(opus|fable|sonnet-5-5)/.test(model);
}

export async function generateCharacter(opts: GenerateOptions): Promise<GenerateOutcome> {
  const { client, model, effort, input, repair, signal, onStage } = opts;
  onStage?.("looking");

  const fallbacks = supportsFallbacks(model);
  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: 32_000,
      thinking: { type: "adaptive" },
      output_config: { effort, format: { type: "json_schema", schema: CHARACTER_SCHEMA as unknown as Record<string, unknown> } },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: buildMessages(input, repair),
      ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    },
    { signal },
  );

  let writing = false;
  for await (const event of stream) {
    if (!writing && event.type === "content_block_delta" && event.delta.type === "text_delta") {
      writing = true;
      onStage?.("building");
    }
  }
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") return { ok: false, code: "refused", detail: "The model declined this image." };
  const raw = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (message.stop_reason === "max_tokens") return { ok: false, code: "truncated", detail: "The builder was too long and was cut off.", raw };

  const parsed = parseCharacter(raw);
  if (!parsed.ok) return { ok: false, code: "invalid", detail: parsed.error, raw };
  return { ok: true, character: parsed.value, raw };
}
