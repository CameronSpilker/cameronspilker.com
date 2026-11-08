# Working in this repository

## House style

**Never use an em dash.** Not in page copy, not in code comments, not in
markdown, not in commit messages. This is enforced: `npm run check:prose` fails
the build on U+2014 (em dash) and U+2015 (horizontal bar), and it runs in CI
alongside lint and typecheck.

Do not fix a hit by swapping in a hyphen or an en dash. Rewrite the sentence. An
em dash is nearly always doing one of three jobs, and each has a plainer form:

| Job it was doing        | Use instead                       |
| ----------------------- | --------------------------------- |
| Introducing a list or an explanation | a colon                  |
| Splicing two sentences  | a full stop, and two sentences    |
| Enclosing an aside      | commas, or parentheses            |

A middle dot (`·`) is fine as a separator between short metadata fields, which
is what the mono labels across the site already use.

Other conventions that hold throughout:

- Copy is plain and specific. Say the number, name the tool, skip the adjective.
- The voice is relaxed: a portfolio of things I made, not a pitch.
- Buttons say what the reader gets, never "Visit site" or "Learn more".
- Nothing on the site claims a result the repos cannot back up. If a link is not
  live yet, the page says so rather than linking to a placeholder.

## Structure

Content and presentation are separate on purpose. Copy changes belong in
`src/content/`; components read from there and never hold their own strings.

```
src/
├── app/            # App Router entry: layout, page, global styles, /tools routes
├── components/     # Section components (Hero, Projects, Lab, Experience, ...)
│   └── tools/      # The tool pages, which are apps rather than sections
├── lib/            # Framework-free helpers (cron.ts drives the Lab countdown)
│   ├── dbt/        # Parser, metrics and colour rules for the run results tool
│   ├── debt/       # Month by month payoff simulation, in whole cents
│   ├── games/      # Pixel Football and Color Echo rules (pure, tested) and the Web Audio beeper
│   └── gifts/      # Gift list: ids, prices, page reader, input checks; server/ holds the DB
└── content/
    ├── site.ts        # name, tagline, contact links, Full Data Stack Lab URLs
    ├── home.ts        # homepage copy: nav, hero, section intros, about, contact
    ├── projects.ts    # the four project cards and their calls to action
    ├── experience.ts  # three detailed roles plus the compact earlier list
    ├── lab.ts         # the Lab section: stats, the nightly countdown, links out
    ├── tools.ts       # copy for everything under /tools
    └── games.ts       # copy for everything under /games
```

## Tools

`/tools` holds small things that run entirely in the browser. The rule that
makes them worth using is that nothing is uploaded: a person should be able to
drop a work artifact into one without asking anyone's permission first, so no
tool may gain a server round trip. Only the PDF signer says so on the page;
the other tools leave it unsaid.

### The one exception: the gift list

`/tools/gift-list` stores data, on purpose. A list that other people open from
a link and claim gifts from has to live somewhere they can all reach, so it is
kept in Postgres (Supabase in production) and its page says so plainly.

It is the only tool allowed to store anything. **Before adding storage, an
API route or any other server round trip to another tool, push back and ask
Cameron first**, even if the request sounds like it needs one. Name what would
be stored, who could read it, and whether a browser-only version (the URL
fragment, `localStorage`, a downloaded file) would do. Cameron asked for that
challenge explicitly.

How the gift list stays safe without accounts:

- A share link is `/tools/gift-list/<name>-<8 random chars>`; the random part
  is what keeps lists unguessable and apart (`src/lib/gifts/ids.ts`).
- The owner's edit key rides in the URL fragment (`/edit#key=...`), so it never
  reaches a request log, and the database keeps only its SHA-256.
- A guest's undo token works the same way and lives in their `localStorage`.
- The owner's view never receives claims, so the surprise holds.
- Claims lock the item row while counting, so two guests cannot both take the
  last one.
- The link preview fetches pages a person pasted. It goes through
  `src/lib/gifts/server/fetch.ts`, which refuses private and link-local
  addresses at connect time and on every redirect. Keep it that way.

Setup: `DATABASE_URL` (Supabase's transaction pooler, port 6543), and the
schema in `db/gift-list.sql`, which is safe to run twice. Without the variable
the pages say gift lists are not switched on, rather than erroring.

Everything under `src/lib/dbt` is pure and tested with `node --test`. Rendering
lives in `src/components/tools`. Chart colours come from the `--viz-*` tokens in
`globals.css`, which are a validated set rather than a chosen one: three
categorical slots that clear colour-vision separation on both surfaces, four
fixed status colours that always ship beside a label, and one sequential ramp.
Adding a fourth category means folding into "other", not inventing a hue.

`public/samples/run-results.sample.json` is generated by
`node scripts/make-sample-run.mjs` and is synthetic. It is deterministic, so it
only changes when the generator does.

`src/content/lab.ts` mirrors the `full-data-stack-lab` repository: the cron
string is copied from its Dagster schedules and the model and test counts are
countable in it (23 files under `transform/models`, 135 generic tests in the
schema YAML plus 12 singular tests). The page shows those counts as floors
("20+ models", "150+ tests"), so growth does not make it wrong, but a floor
must stay true and the cron string must match exactly. Count rather than guess:

```bash
find transform/models -name '*.sql' | wc -l    # models
ls transform/tests/*.sql | wc -l               # singular tests
# generic tests: total minus singular, from a parsed manifest
```

The longer story about the lab, its layers and its full schedule, is not here.
It lives at `lab.cameronspilker.com/how-it-works`, in the repo that also holds
the pipeline, so it can be corrected in the same commit that changes the code.
The homepage section points at the dashboard and gets out of the way.

## Games

`/games` follows the same rule as the tools: everything runs in the browser and
nothing is uploaded. Bests and preferences live in `localStorage`. A shared
leaderboard would mean storage, so it gets the same push back as above.

Pixel Football's rules live in `src/lib/games/football.ts` as pure functions
(`press`, `advance`) that take the random source as an argument, so
`football.test.ts` can play whole drives with scripted dice. The page owns the
animation frame and the keys. Its rules follow the 1977 LED football handheld
manual (9 yard screen, forward and across only, Status to set up each play,
kicks only on fourth down). Its name, case and sounds are its own: keep them
that way rather than copying any real product's.

The computer opponent is `src/lib/games/cpu.ts`: a pure `cpuMove` that picks
the computer's next button, tested in `cpu.test.ts`. It scores each move by
open field ahead and by whether a defender could tackle it there next, and it
can wait for the defence to drift and open a lane. Its skill follows the level:
Pro taps faster and always takes its best move; Rookie taps slower and now and
then slips. The page decides when it presses, so it plays at a human pace. Copy for the opening pop up, the result
banner and both modes lives in `src/content/games.ts` like everything else.

Color Echo is the four colour memory game. Its rules are `src/lib/games/memory.ts`
(`newGame`, `startInput`, `press`, `timeUp`, `tempo`), pure and tested in
`memory.test.ts` with a scripted random source. Games run to 8, 14, 20 or 31
rounds, or Endless, with 3 seconds per press (`PRESS_LIMIT_MS`). The page owns
the playback timers, the press clock and the lights. Each pad has a shape as well as a colour and a note, so colour is never
the only cue. Its notes go through the same beeper as Pixel Football, via
`beeper.notes`, and its bests per round count live in `localStorage`. Its notes (C, D, E, G) are
its own: keep them that way rather than copying any real handheld's tones.

## Before pushing

```bash
npm run check:prose
npm run lint
npm run typecheck
npm run build
```
