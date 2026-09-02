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
npm run lint       # eslint (next/core-web-vitals + next/typescript)
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run shots      # capture project screenshots (needs playwright locally)
```

## Project screenshots

The projects section is a scroll takeover: each project pins to the viewport
and the page becomes that product's homepage. It renders a real screenshot from
`public/shots/<slug>.png` when one exists, and a wireframe in the product's own
colors when it does not — so a missing capture degrades instead of breaking.

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
├── components/     # Section components (Hero, Experience, Projects, ...)
├── ../scripts/     # capture-shots.mjs — project screenshots
└── content/        # Typed content modules — edit these, not the components
    ├── site.ts         # name, tagline, contact links
    ├── experience.ts   # work history
    └── projects.ts     # portfolio cards
```

Content and presentation are deliberately separate: updating the site's copy
means editing a data file in `src/content`, never a component.

## Editing content

- **Work history** — `src/content/experience.ts`. Each role takes 3–5
  `highlights`; write them as outcomes (what changed, by how much), not
  responsibilities. Bullets currently marked `TODO` are placeholders.
- **Projects** — `src/content/projects.ts`. A project with a `preview` gets a
  full-screen panel in the scroll takeover; the rest are listed under
  "Earlier work". `preview.tint` and `preview.accent` set the panel's colors.
- **Everything else** — `src/content/site.ts`.

## Deployment

Vercel builds `main` on push and opens a preview deployment per pull request.
GitHub Actions runs lint, typecheck, and build on every pull request.
