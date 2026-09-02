# cameronspilker.com

Personal portfolio, work history, and project showcase for Cameron Spilker,
analytics engineer and data nerd.

## Stack

| Concern   | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack)      |
| Language  | TypeScript                              |
| Styling   | Tailwind CSS v4                         |
| Analytics | Vercel Analytics                        |
| Hosting   | Vercel                                  |

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run lint         # eslint (next/core-web-vitals + next/typescript)
npm run check:prose  # house style: no em dashes anywhere (see CLAUDE.md)
npm test             # node --test, currently the cron helper behind the Lab
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run shots        # capture project screenshots (needs playwright locally)
```

## Project screenshots

The projects section is a scroll takeover: each project pins to the viewport
and the page becomes that product's homepage. It renders a real screenshot from
`public/shots/<slug>.png` when one exists, and a wireframe in the product's own
colors when it does not, so a missing capture degrades instead of breaking.

```bash
npm i -D playwright && npx playwright install chromium
npm run shots            # every project
npm run shots hoapulse   # just one
```

Captures are resolved at build time in `src/components/Projects.tsx`, so adding
a file to `public/shots/` is all it takes to swap a wireframe for the real page.

## Layout

```
src/
├── app/            # App Router entry: layout, page, global styles
├── components/     # Section components (Hero, Projects, Lab, Experience, ...)
├── lib/            # Framework-free helpers, with their tests
│   └── cron.ts         # next-run maths behind the Lab's live countdowns
├── ../scripts/     # capture-shots.mjs, check-prose.mjs
└── content/        # Typed content modules: edit these, not components
    ├── site.ts         # name, tagline, contact links, lab URLs
    ├── experience.ts   # three detailed roles, then the compact earlier list
    ├── projects.ts     # the four showcase panels and their buttons
    └── lab.ts          # the Lab section's three tabs
```

Content and presentation are deliberately separate: updating the site's copy
means editing a data file in `src/content`, never a component.

## Editing content

- **Work history**: `src/content/experience.ts`. The three most recent roles
  take 3 `highlights` each; write them as outcomes (what changed, by how much),
  not responsibilities. Everything older lives in `earlier` as a name and a
  date, because eleven roles with bullets is a resume, not a portfolio.
- **Projects**: `src/content/projects.ts`. Array order is scroll order, and
  every project gets a full-screen panel. `preview.tint` and `preview.accent`
  set the panel's colors; `cta` is the button, which says what the visitor
  gets rather than "Visit site".
- **The Lab section**: `src/content/lab.ts`. This mirrors the
  `full-data-stack-lab` repo, including the literal cron strings from its
  Dagster schedules, so it goes stale when that repo changes.
- **Everything else**: `src/content/site.ts`. `lab.dashboard` and `lab.docs`
  are `null` until those deploy; filling them in is all it takes to light up
  the links that are currently held back.

## Deployment

Vercel builds `main` on push and opens a preview deployment per pull request.
GitHub Actions runs lint, the prose check, the tests, typecheck, and the build
on every pull request.

## House style

`CLAUDE.md` holds the writing rules. The short version: no em dashes anywhere,
buttons say what the reader gets, and nothing on the site claims a result the
repos cannot back up. `npm run check:prose` enforces the first one in CI.
