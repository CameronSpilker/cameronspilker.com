# Roadmap

Where the site stands and what comes next.

## Done

- Next.js 16 App Router + TypeScript + Tailwind v4, dark technical theme
- Homepage sections: hero, experience, projects, data stack, about, contact
- Content separated into typed modules under `src/content`
- Lint, typecheck, and build green; CI runs all three on every PR

## Next — in order

### 1. Replace the placeholder content (blocks launch)

The structure is real; a lot of the copy is not. Every `TODO` in
`src/content/` is a placeholder that would embarrass you in front of a
recruiter if it shipped.

- [ ] `src/content/experience.ts` — real dates for every role, and 3–5 bullets
      each. Write outcomes, not responsibilities: what changed, by how much,
      and how you knew. This is the single highest-value item on this list
- [ ] `src/content/projects.ts` — real descriptions for Plainstocks, HOApulse,
      Cardtacular, HoloRekognition, and the marketing analytics project
- [ ] `src/components/About.tsx` — the closing line about what you are building
      now and what you are looking for
- [ ] Confirm the GitHub URL casing and the LinkedIn slug in `src/content/site.ts`

### 2. Ship it

- [ ] Connect the repo to Vercel, deploy `main`
- [ ] Point the `cameronspilker.com` domain at the deployment
- [ ] Confirm Vercel Analytics is reporting
- [ ] Check the rendered site on a phone — the layout is responsive but has
      only been verified at desktop widths

### 3. Polish

- [ ] Add an OG image so links unfurl properly when shared
- [ ] Add screenshots or logos to the project cards; text-only cards read thin
      next to a live site link
- [ ] Add `sitemap.ts` and `robots.ts`
- [ ] Run Lighthouse and fix whatever it flags — a portfolio for a data person
      that scores badly on measurable things is a bad look

### 4. Wire in the analytics project

Depends on the `full-data-stack-lab` roadmap steps 3 and 4.

- [ ] Link the live Evidence dashboard from `src/components/DataStack.tsx`
      (there is a TODO marking the spot)
- [ ] Link the hosted dbt docs from the same place
- [ ] Decide between an embedded iframe and a link-out. An embed is more
      impressive and much easier to make slow — measure before committing
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
- **Typed content modules, not MDX.** Same goal — content edits never touch
  components — with less machinery for what are currently one-paragraph cards.
  See step 5.
