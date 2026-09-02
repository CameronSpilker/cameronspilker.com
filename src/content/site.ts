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
 * `dashboard` and `docs` are null until the Evidence build and the dbt docs are
 * deployed. Every component that offers them checks first and falls back to the
 * repo, so filling these in is the only change needed on the day they go live.
 */
export const lab = {
  repo: "https://github.com/CameronSpilker/full-data-stack-lab",
  dashboard: null as string | null,
  docs: null as string | null,
} as const;
