/**
 * Run with `npm test`.
 *
 * The server half of /character: what is allowed in, what comes back out, and
 * the limits around it. The model is never called: `generateCharacter` takes
 * its client as a parameter, and the fake one here replays a canned stream.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PIKACHU_BUILDER, TREE_BUILDER } from "./examples.ts";
import { generateCharacter, supportsFallbacks } from "./generate.ts";
import { RateLimiter, Tickets, clientIp } from "./limits.ts";
import { buildMessages, SYSTEM_PROMPT } from "./prompt.ts";
import { parseRequest, sniff } from "./request.ts";
import { lintBuilder, parseCharacter } from "./schema.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`;

const good = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    accepted: true,
    reason: "",
    name: "Sprout",
    description: "A tree with a face.",
    builderCode: TREE_BUILDER,
    palette: ["#5B4332", "#a9d65c", "nope"],
    notes: "",
    ...over,
  });

test("the worked examples pass the builder lint", () => {
  assert.equal(lintBuilder(PIKACHU_BUILDER), null);
  assert.equal(lintBuilder(TREE_BUILDER), null);
});

test("the system prompt has no em dashes and embeds both examples", () => {
  assert.equal(/[\u2014\u2015]/.test(SYSTEM_PROMPT), false);
  assert.ok(SYSTEM_PROMPT.includes("helpers.leafMass(head"));
  assert.ok(SYSTEM_PROMPT.includes("var earR = helpers.pivot(head"));
});

test("lint names what a builder must not do", () => {
  assert.match(lintBuilder("fetch('/x'); return {}")!, /network/);
  assert.match(lintBuilder("document.body; return {}")!, /DOM/);
  assert.match(lintBuilder("eval('1'); return {}")!, /eval/);
  assert.match(lintBuilder("new THREE.TextureLoader().load('x'); return {}")!, /loaders/);
  assert.match(lintBuilder("var a = 1;")!, /return/);
  assert.equal(lintBuilder("var functionality = 1; return { root: r, joints: j };"), null);
});

test("parseCharacter keeps valid hex colours, lowercased, and drops the rest", () => {
  const r = parseCharacter(good());
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.palette, ["#5b4332", "#a9d65c"]);
});

test("parseCharacter turns a decline into a value, not an error", () => {
  const r = parseCharacter(good({ accepted: false, reason: "That's a spreadsheet.", builderCode: "" }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.accepted, false);
    assert.equal(r.value.reason, "That's a spreadsheet.");
  }
});

test("parseCharacter reports problems the model can fix", () => {
  assert.deepEqual(parseCharacter("{not json"), { ok: false, error: "The response was not valid JSON." });
  const noColour = parseCharacter(good({ palette: ["red"] }));
  assert.equal(noColour.ok, false);
  const badCode = parseCharacter(good({ builderCode: "window.x = 1; return {}" }));
  assert.equal(badCode.ok, false);
  if (!badCode.ok) assert.match(badCode.error, /DOM/);
});

test("rate limiter allows the limit, then counts down to the oldest hit expiring", () => {
  let now = 0;
  const lim = new RateLimiter(5, 3_600_000, () => now);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(lim.take("a"), { ok: true });
    now += 60_000;
  }
  const denied = lim.take("a");
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.retryAfter, 3_300);
  assert.deepEqual(lim.take("b"), { ok: true });
  now = 3_600_001;
  assert.deepEqual(lim.take("a"), { ok: true });
});

test("a repair ticket works once, for its own code, before it expires", () => {
  let now = 1_000;
  const t = new Tickets("secret", () => now);
  const ticket = t.issue("code-a");
  assert.equal(t.redeem(ticket, "code-b"), false);
  assert.equal(t.redeem(ticket, "code-a"), true);
  assert.equal(t.redeem(ticket, "code-a"), false);

  const late = t.issue("code-c");
  now += 10 * 60 * 1000 + 1;
  assert.equal(t.redeem(late, "code-c"), false);

  const forged = new Tickets("other", () => now).issue("code-d");
  assert.equal(t.redeem(forged, "code-d"), false);
});

test("client IP prefers Vercel's x-real-ip, then the first forwarded hop", () => {
  assert.equal(clientIp(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" })), "1.2.3.4");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" })), "5.6.7.8");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("requests are sniffed by signature, not by what they claim", () => {
  assert.equal(sniff(JPEG), "image/jpeg");
  assert.equal(sniff(PNG), "image/png");
  assert.equal(sniff(Buffer.from("GIF89a......")), null);

  const ok = parseRequest({ image: dataUrl("image/jpeg", JPEG), style: "realistic", name: " Ace\u0007 ", notes: "a tree" });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.style, "realistic");
    assert.equal(ok.value.name, "Ace");
    assert.equal(ok.value.image.mediaType, "image/jpeg");
  }
  // A PNG labelled as JPEG is sent as what it really is.
  const mislabelled = parseRequest({ image: dataUrl("image/jpeg", PNG) });
  assert.ok(mislabelled.ok && mislabelled.value.image.mediaType === "image/png");

  const gif = parseRequest({ image: dataUrl("image/png", Buffer.from("GIF89a......")) });
  assert.ok(!gif.ok && gif.error.code === "unsupported");
  const heic = parseRequest({ image: "data:image/heic;base64,AAAA" });
  assert.ok(!heic.ok && heic.error.code === "unsupported");
  const big = parseRequest({ image: dataUrl("image/jpeg", Buffer.concat([JPEG, Buffer.alloc(3 * 1024 * 1024)])) });
  assert.ok(!big.ok && big.error.code === "too_large");
  assert.equal(parseRequest({ image: dataUrl("image/jpeg", JPEG), style: "anime" }).ok, false);
});

test("a repair adds the failed output and the error as the next turns", () => {
  const input = { imageBase64: "AAAA", mediaType: "image/jpeg" as const, style: "faithful" as const, name: "Ace", notes: "" };
  assert.equal(buildMessages(input).length, 1);
  const msgs = buildMessages(input, { previous: "{\"x\":1}", error: "Missing required joints: head." });
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].role, "assistant");
  assert.match(String(msgs[2].content), /Missing required joints/);
});

test("fallbacks are only requested on models that support them", () => {
  assert.equal(supportsFallbacks("claude-opus-5-5"), true);
  assert.equal(supportsFallbacks("claude-sonnet-5-5"), true);
  assert.equal(supportsFallbacks("claude-haiku-5-5"), false);
});

/** A stand-in for the SDK client: replays events, then a final message. */
function fakeClient(text: string, stop = "end_turn") {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(params);
          const events = [
            { type: "content_block_start", content_block: { type: "thinking" } },
            { type: "content_block_delta", delta: { type: "text_delta", text: text.slice(0, 5) } },
            { type: "content_block_delta", delta: { type: "text_delta", text: text.slice(5) } },
          ];
          return {
            async *[Symbol.asyncIterator]() {
              yield* events;
            },
            async finalMessage() {
              return { stop_reason: stop, content: [{ type: "text", text }] };
            },
          };
        },
      },
    },
  };
  return { client: client as unknown as Parameters<typeof generateCharacter>[0]["client"], calls };
}

const input = { imageBase64: "AAAA", mediaType: "image/jpeg" as const, style: "faithful" as const };

test("generation reports looking, then building, then a checked result", async () => {
  const { client, calls } = fakeClient(good());
  const stages: string[] = [];
  const out = await generateCharacter({ client, model: "claude-opus-5-5", effort: "medium", input, onStage: (s) => stages.push(s) });
  assert.deepEqual(stages, ["looking", "building"]);
  assert.ok(out.ok);
  const params = calls[0];
  assert.equal(params.model, "claude-opus-5-5");
  assert.equal(params.fallbacks, "default");
  assert.deepEqual(params.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal((params.output_config as { effort: string }).effort, "medium");
});

test("generation maps a refusal and a cut-off to their own codes", async () => {
  const refused = await generateCharacter({ client: fakeClient("", "refusal").client, model: "claude-opus-5-5", effort: "medium", input });
  assert.ok(!refused.ok && refused.code === "refused");
  const cut = await generateCharacter({ client: fakeClient("{\"accep", "max_tokens").client, model: "claude-opus-5-5", effort: "medium", input });
  assert.ok(!cut.ok && cut.code === "truncated");
  const invalid = await generateCharacter({ client: fakeClient(good({ builderCode: "return 1" , palette: [] })).client, model: "claude-haiku-5-5", effort: "low", input });
  assert.ok(!invalid.ok && invalid.code === "invalid" && typeof invalid.raw === "string");
});
