# Roadmap

Where the site stands and what comes next.

## Done

- Next.js 16 App Router + TypeScript + Tailwind v4, dark technical theme
- Homepage sections: hero, projects, lab, experience, about, contact, in that
  order, so the work someone can click into comes before the resume
- Project showcase: full-screen scroll takeover, one panel per product, the
  Full Data Stack Lab first
- Lab section with three tabs (methodology, pipeline, dashboard) and live
  countdowns computed from the lab repo's real Dagster cron schedules
- Content separated into typed modules under `src/content`
- House style enforced: `npm run check:prose` fails on em dashes, in CI
- Lint, prose, tests, typecheck, and build green; CI runs all five on every PR

## Next, in order

### 1. Replace the placeholder content (blocks launch)

The structure is real; a lot of the copy is not. Every `TODO` in
`src/content/` is a placeholder that would embarrass you in front of a
recruiter if it shipped.

- [x] `src/content/experience.ts`: the three most recent roles with outcome
      bullets, everything older as a name and a date
- [x] `src/content/projects.ts`: every project described from its own repo
      or from Cameron's own account of it
- [x] `npm run shots`: three of the four homepages are captured. The lab has
      no page of its own to capture until its dashboard deploys, so it renders
      the wireframe
- [ ] Confirm the GitHub URL casing and the LinkedIn slug in `src/content/site.ts`

### 2. Ship it

- [ ] Connect the repo to Vercel, deploy `main`
- [ ] Point the `cameronspilker.com` domain at the deployment
- [ ] Confirm Vercel Analytics is reporting
- [ ] Check the rendered site on a phone. The layout is responsive but has
      only been verified at desktop widths

### 3. Polish

- [ ] Add an OG image so links unfurl properly when shared
- [ ] Add `sitemap.ts` and `robots.ts`
- [ ] Run Lighthouse and fix whatever it flags. A portfolio for a data person
      that scores badly on measurable things is a bad look

### 4. Wire in the analytics project

Depends on the `full-data-stack-lab` roadmap steps 1 and 4. The site is ready
for all of it: the Lab section already offers each link and hides the ones that
would 404.

- [ ] Set `lab.dashboard` in `src/content/site.ts` once the Evidence build is
      deployed. That one line turns the Dashboard tab's "not deployed yet" note
      into an "Open the live dashboard" button
- [ ] Set `lab.docs` the same way once the dbt docs are on GitHub Pages
- [ ] Capture the deployed dashboard with `npm run shots full-data-stack-lab`
      so the lead panel shows the real thing instead of its wireframe
- [ ] Decide between an embedded iframe and a link-out. An embed is more
      impressive and much easier to make slow, so measure before committing
- [ ] Consider a dedicated `/stack` route if the section outgrows the homepage

### 5. Later, if worth it

- [ ] Contact form. A `mailto:` link works today; a form needs an API route and
      a mail provider, so it only earns its keep if the link is losing you
      messages
- [ ] MDX for project write-ups. The original plan called for it; typed content
      modules cover the current cards. Adopt MDX when a project deserves a full
      page rather than a paragraph
- [ ] A `/resume` route rendering `experience.ts` as a printable page, so the
      site and the PDF cannot drift apart

## Notes on what was built differently from the plan

- **Next.js 16, not 14.** 14 is two majors behind and no longer what Vercel
  builds best. The App Router structure the plan asked for is unchanged.
- **Tailwind v4, not v3.** Current stable; configuration is CSS-first via
  `@theme` in `globals.css` rather than a `tailwind.config.js`.
- **Typed content modules, not MDX.** Same goal (content edits never touch
  components) with less machinery for what are currently one-paragraph cards.
  See step 5.
