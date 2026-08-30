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
```

## Layout

```
src/
├── app/            # App Router entry: layout, page, global styles
├── components/     # Section components (Hero, Experience, Projects, ...)
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
- **Projects** — `src/content/projects.ts`. Each card has a `state` of
  `live` (links out), `repo` (open source), or `archive` (rendered as
  "no longer active"). Set `featured: true` to make a card span both columns.
- **Everything else** — `src/content/site.ts`.

## Deployment

Vercel builds `main` on push and opens a preview deployment per pull request.
GitHub Actions runs lint, typecheck, and build on every pull request.
