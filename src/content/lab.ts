/**
 * What the Lab section on the homepage says.
 *
 * The section used to carry the whole story across three tabs. It does not any
 * more: the methodology, the schedule and the page-by-page tour live on
 * lab.cameronspilker.com/how-it-works, next to the pipeline they describe,
 * where they can be corrected in the same commit that changes the code. What
 * stays here is the argument for clicking through, and one live countdown.
 *
 * The numbers below are read off the `full-data-stack-lab` repo: 23 model files
 * under `transform/models`, 142 generic tests declared in the schema YAML plus
 * 12 singular tests under `transform/tests`, and the cron string is the literal
 * `cron_schedule` from `orchestration/full_data_stack_lab/jobs.py`. If that repo
 * changes, this file is wrong and should change with it.
 */

import { lab } from "./site";

/** Headline counts, each one countable in the lab repo. */
export const stats = [
  { value: "23", label: "dbt models" },
  { value: "154", label: "tests" },
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
    "One repository holding every stage of an analytics stack: the extractors, the warehouse, 23 models and their tests, the orchestrator, and the two dashboards those models exist to serve. The landing page opens onto both.",
  countdownLabel: "Next rebuild in",
  /**
   * The button lands on the lab's own landing page, which is a page rather than
   * an index: it names the two dashboards, says what each one is for, and lets
   * the reader pick. Deep-linking past it used to be worth it when the root was
   * a bare file listing. It is not now, and picking for the reader hid the dbt
   * Charts boards from anyone arriving here.
   */
  primary: {
    label: "Open the lab",
    detail:
      "Two ways in, both reading the same models: the Evidence dashboard, where you pick a team and the page answers, and the dbt Charts boards, where each page is one YAML file. The landing page says what each one is for.",
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
    title: "The same marts, in dbt Charts",
    href: lab.charts,
    detail:
      "A second presentation layer over the same models, built with dbt Charts. Every board is one YAML file holding its queries, its charts and its layout, rendered to a static page by the pipeline that built the warehouse.",
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
