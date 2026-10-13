# /character

A visitor uploads a drawing or a photo of a character; Claude writes a small
three.js program that builds it as a rigged 3D model; the page runs that
program in a sandbox and plays a shared library of actions on the result.
Nothing is stored: the image and the code live in the request's memory and in
the open tab, and a refresh discards both.

## Environment variables

Set these in the Vercel project (Settings, Environment Variables).

| Variable                    | Required | Default            | What it does                                                                 |
| --------------------------- | -------- | ------------------ | ---------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | yes      |                    | Claude API key. Server-side only; without it the route answers 503.          |
| `CHARACTER_MODEL`           | no       | `claude-opus-5-5`  | Model for generation.                                                        |
| `CHARACTER_EFFORT`          | no       | `medium`           | `low`, `medium`, `high`, `xhigh` or `max`. Higher is slower and costs more.  |
| `CHARACTER_RATE_PER_HOUR`   | no       | `5`                | Generations per IP per hour, counted per server instance (see below).        |
| `CHARACTER_TICKET_SECRET`   | no       | derived from key   | Signs repair tickets. Set it if you rotate the API key often.                |

The route uses an API key rather than a Claude subscription token (the way
Plainstocks runs its desk) because it serves anonymous visitors on demand, and
a subscription is for the subscriber's own use.

### Rate limiting across instances

The in-code limiter is per function instance, so it stops one client hammering
one instance but not a spread of requests across many. Add a Vercel Firewall
rule as the real limit: Firewall, Configure, New Rule; if Request Path equals
`/api/character` and Method equals `POST`, Rate Limit with a fixed window of
3600 seconds and 5 requests, keyed on IP, action Deny (429).

## How generation works

```
page (/character)             POST /api/character             Claude API
  resize to 1568 px  ───────▶  validate, sniff type, limit  ───▶  vision + structured output
  HEIC to JPEG                 stream NDJSON progress  ◀───────  one JSON object
        │                      lint builderCode; one repair
        ▼                      if it fails the lint
  sandboxed iframe (src/stage)
    blob Worker runs builderCode once, checks rig + budget, serialises
    stage rebuilds the scene, re-checks it, plays actions
```

1. **The page** (`src/components/character/CharacterApp.tsx`) converts HEIC to
   JPEG, redraws the image at no more than 1568 px on the long edge, and posts it
   with the name, style and notes.
2. **The route** (`src/app/api/character/route.ts`) checks the request (size,
   real file signature, fields), applies the IP limit, and calls Claude with
   the system prompt in `src/lib/character/prompt.ts`. The prompt holds the rig
   contract, the helper reference, and two worked examples
   (`src/lib/character/examples.ts`, ported from Ace's Pikachu and Ace's Tree).
   It is marked for prompt caching. The response is a structured output
   matching `CHARACTER_SCHEMA` in `src/lib/character/schema.ts`, with two fields
   beyond the spec's five: `accepted` and `reason`, which is how the model
   declines an image that is not a character. Refusals fall back server-side
   (`fallbacks: "default"`).
3. **Validation, then one repair.** The route lints the JSON (hex colours,
   forbidden APIs, a `return`). If that fails it sends the error back to Claude
   once, before the browser sees anything. Then the browser runs the builder in
   the sandbox; if that fails (missing joints, wrong height, a throw, a
   timeout), it sends the error back once more, using a signed one-time ticket
   so the retry does not count against the visitor's limit. If that also fails,
   the stage shows a stand-in character built by app code from the drawing's
   palette (`src/stage/fallback.ts`) and the page says so.
4. **The sandbox.** `builderCode` never runs on the page. The stage is
   `public/character-stage/index.html` in an `<iframe sandbox="allow-scripts">`
   (opaque origin: no cookies, no storage, no access to the page) under a CSP
   with `connect-src 'none'` (set in `next.config.ts`). Inside it, the builder
   runs in a blob Worker that the stage terminates after 10 seconds, which is
   what stops an infinite loop on Safari, where a sandboxed iframe shares the
   page's thread. The worker flattens geometry, transfers textures as bitmaps,
   and posts plain data back; the stage deserialises it and checks it again
   before showing it. The page also pings the stage while it loads and removes
   the iframe if it stops answering.

The stage is bundled separately from Next by `scripts/build-stage.mjs`
(`npm run build:stage`, run automatically before `dev` and `build`) into
`public/character-stage/stage.js`, which is generated and not committed.

## The rig contract, in short

About 4 units tall, feet on y = 0, facing +z. `root` plus joints `head`,
`armL`, `armR`, `legL`, `legR` (optional `tail`, `earL`, `earR`, `extra`),
each a pivot at the shoulder, hip or neck with its limb built hanging straight
down, and the drawing's pose set by rotating the pivot. `armL` is on -x.
`joints.head.userData.face` says where the sunglasses go. Under 150k triangles
and 2000 instances. The full text is in the system prompt.

## Adding an action

1. Add `{ key, label }` to `ACTIONS` in `src/stage/protocol.ts`. The button
   appears on the page from that list.
2. Add an entry with the same key in `makeActions` in `src/stage/actions.ts`:
   a duration `d` and a frame function `f(t, dt)`, plus an optional `start()`
   to reset per-run state.
3. Each frame starts from the rest pose. Set joint angles with
   `blend(joint, axis, target, k)` so they ease out of and back into the
   drawing's own pose, wrap everything in an envelope
   `k = env(t, d, ramp)`, and scale anything size-dependent by `fit(height)`
   or `rig.H` so it works for a tall tree and a short blob alike. Props live in
   `src/stage/props.ts` and are hidden every frame unless an action shows them.
4. Run it against both worked examples without an API key: start
   `npm run dev`, open `/character?fixture=tree` (or `?fixture=pikachu`), pick
   any image and generate. In development that skips the API and loads the
   example builder through the real sandbox. Check the action ends back at
   rest on both.

## Designed to extend later

Saving or sharing, accounts, GLB or video export, custom actions and multiple
characters are out of scope. The seams for them are in place: a character is
one JSON object (`CharacterResult`), the stage takes it through one message
type, and the action library only knows the measured `Rig`, never the builder.
