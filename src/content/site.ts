export const site = {
  name: "Cameron Spilker",
  title: "Senior Analytics Engineer",
  tagline:
    "I build data systems end to end, from raw API to trusted model to dashboard, and I build them in public.",
  location: "American Fork, Utah",
  email: "cameron.spilker@outlook.com",
  github: "https://github.com/CameronSpilker",
  linkedin: "https://www.linkedin.com/in/cameronspilker",
  url: "https://cameronspilker.com",
} as const;

/**
 * Links that belong to the Full Data Stack Lab rather than to this site.
 *
 * All three are live on their own subdomain, served by the `ncaa-lab` Vercel
 * project from the `full-data-stack-lab` repo. `dashboard` is the root of the
 * Evidence build, `scorecard` is the page inside it that a first-time visitor
 * should land on, `picks` is the forecast of the games that have not been
 * played yet, and `docs` is the dbt catalogue, unpacked into the same
 * deployment by `dashboard/scripts/fetch-warehouse.sh` rather than hosted
 * separately.
 *
 * These were null while the deploy was pending, and the components that use
 * them still check before offering the link, so a future outage degrades to the
 * repo rather than to a dead button.
 */
export const lab = {
  repo: "https://github.com/CameronSpilker/full-data-stack-lab",
  dashboard: "https://lab.cameronspilker.com" as string | null,
  scorecard: "https://lab.cameronspilker.com/scorecard" as string | null,
  picks: "https://lab.cameronspilker.com/picks" as string | null,
  docs: "https://lab.cameronspilker.com/docs/" as string | null,
} as const;
