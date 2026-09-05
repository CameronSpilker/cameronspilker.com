/**
 * What the Lab section on the homepage says.
 *
 * The section used to carry the whole story across three tabs. It does not any
 * more: the methodology, the schedule and the page-by-page tour live on
 * lab.cameronspilker.com/how-it-works, next to the pipeline they describe,
 * where they can be corrected in the same commit that changes the code. What
 * stays here is the argument for clicking through, and one live countdown.
 *
 * The numbers below are read off the `full-data-stack-lab` repo: 24 model files
 * under `transform/models`, 121 generic tests declared in the schema YAML plus
 * 11 singular tests under `transform/tests`, and the cron string is the literal
 * `cron_schedule` from `orchestration/full_data_stack_lab/jobs.py`. If that repo
 * changes, this file is wrong and should change with it.
 */

import { lab } from "./site";

/** Headline counts, each one countable in the lab repo. */
export const stats = [
  { value: "24", label: "dbt models" },
  { value: "132", label: "tests" },
  { value: "20,000", label: "simulated brackets" },
  { value: "365", label: "teams tracked" },
];

/**
 * The schedule the section counts down to.
 *
 * One countdown rather than three. The point it makes is that the pipeline is
 * running whether or not anyone is looking at it, and the nightly job makes
 * that point on its own.
 */
export const nightly = {
  name: "nightly_in_season_schedule",
  /** Standard five-field cron, exactly as it appears in the repo. */
  cron: "0 6 * * *",
  /** IANA zone the cron is evaluated in. */
  timezone: "America/Denver",
  cadence: "Nightly at 06:00 Mountain",
  what: "Scores, box scores, betting lines and ratings for the season in progress, then the dbt graph behind them.",
};

export const intro = {
  label: "Analytics engineering",
  title: "The Full Data Stack Lab is live",
  lede:
    "One repository holding every stage of an analytics stack: the extractors, the warehouse, 24 models and their tests, the orchestrator, and the dashboard those models exist to serve. The dashboard is the front door, so start there.",
  countdownLabel: "Next rebuild in",
  /**
   * The button lands on the team scorecard rather than on the dashboard's home
   * page. The home page is an index of the project; the scorecard is one team
   * on one screen, which is what a reader arriving from here came to see. It
   * falls back to the dashboard root if the scorecard link is ever null.
   */
  primary: {
    label: "Open the team scorecard",
    detail:
      "One team on one screen: efficiency, percentile rank, the four factors, an Elo line for the season, form, and the odds from 20,000 simulated brackets. Pick any of the 365 teams from the dropdown.",
  },
};

export type Elsewhere = {
  title: string;
  href: string | null;
  detail: string;
};

/** The rest of the project, for a reader who wants more than the numbers. */
export const elsewhere: Elsewhere[] = [
  {
    title: "What the model likes next",
    href: lab.picks,
    detail:
      "The games that have not been played yet, priced every morning against the betting market. Ranked on disagreement rather than on confidence, because a 95% favourite is 95% on every screen in the country.",
  },
  {
    title: "The rest of the dashboard",
    href: lab.dashboard,
    detail:
      "The national table, the projected bracket, conference strength, and a page that grades how well the model's own forecasts did.",
  },
  {
    title: "How the pipeline is built",
    href: lab.dashboard ? `${lab.dashboard}/how-it-works` : null,
    detail:
      "Each layer, the tool it uses, and the reason it is that tool. Plus the real Dagster schedules and what each one rebuilds.",
  },
  {
    title: "The dbt docs and lineage",
    href: lab.docs,
    detail:
      "Every model, its columns, its tests, and the graph connecting them, generated from the project itself.",
  },
  {
    title: "Every line of the source",
    href: lab.repo,
    detail:
      "Ingestion, warehouse, models, orchestration and dashboard, in one repository with the CI that runs them.",
  },
];
