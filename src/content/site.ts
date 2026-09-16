export const site = {
  name: "Cameron Spilker",
  title: "Senior Analytics Engineer",
  tagline:
    "I build data systems end to end, from raw API to trusted model to dashboard, and I build them in public.",
  location: "Utah",
  email: "cameron.spilker@outlook.com",
  github: "https://github.com/CameronSpilker",
  linkedin: "https://www.linkedin.com/in/cameronspilker",
  url: "https://cameronspilker.com",
} as const;

/**
 * Links that belong to the Full Data Stack Lab rather than to this site.
 *
 * All of them are live on their own subdomain, served by the `ncaa-lab` Vercel
 * project from the `full-data-stack-lab` repo. `dashboard` is the landing page
 * at the root, which offers the Evidence dashboard at `/evidence` and the dbt
 * Charts boards at `/charts`. `picks` is the forecast of the games that have
 * not been played yet, `charts` is the boards index, and `docs` is the dbt
 * catalogue, unpacked into the same deployment by
 * `dashboard/scripts/fetch-warehouse.sh` rather than hosted separately.
 *
 * `picks` is a root-level path the lab redirects to its `/evidence` equivalent.
 * It resolves in one hop, so it stays as it reads here.
 *
 * These were null while the deploy was pending, and the components that use
 * them still check before offering the link, so a future outage degrades to the
 * repo rather than to a dead button.
 */
export const lab = {
  repo: "https://github.com/CameronSpilker/full-data-stack-lab",
  dashboard: "https://lab.cameronspilker.com" as string | null,
  picks: "https://lab.cameronspilker.com/picks" as string | null,
  docs: "https://lab.cameronspilker.com/docs/" as string | null,
  charts: "https://lab.cameronspilker.com/charts/" as string | null,
} as const;
