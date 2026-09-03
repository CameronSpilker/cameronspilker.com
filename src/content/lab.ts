/**
 * Everything the Lab section renders across its three tabs.
 *
 * All of it is read off the `full-data-stack-lab` repo: the schedules are the
 * literal `cron_schedule` strings from `orchestration/jobs.py`, the pages are
 * the files under `dashboard/pages/`, and the counts come from `dbt build`.
 * Nothing here is illustrative. If the repo changes, this file is wrong and
 * should change with it.
 */

export type Layer = {
  name: string;
  tool: string;
  detail: string;
};

/** The pipeline, in the order data moves through it. */
export const layers: Layer[] = [
  {
    name: "Ingest",
    tool: "Python + httpx",
    detail:
      "collegebasketballdata.com for games, box scores, betting lines, and adjusted efficiency. Every extract lands as dated Parquet before anything reads it, so a run is replayable from disk without touching the API again.",
  },
  {
    name: "Store",
    tool: "DuckDB",
    detail:
      "A Parquet landing zone and key-based upserts into a single warehouse file that both dbt and the dashboard read, so a rolling window corrects what it covers and leaves the rest of history alone.",
  },
  {
    name: "Transform",
    tool: "dbt Core",
    detail:
      "Staging, intermediate, marts. 22 models behind 118 tests, with the predictor defined once in a macro so every consumer prices a game the same way.",
  },
  {
    name: "Orchestrate",
    tool: "Dagster",
    detail:
      "An asset graph rather than a task graph, so ingestion and the dbt DAG share one lineage view. A sensor rebuilds the models the moment fresh scores land.",
  },
  {
    name: "Present",
    tool: "Evidence.dev",
    detail:
      "Dashboards as code, versioned in the same repo as the models they read. Nothing lives only inside a BI tool's UI.",
  },
];

export type Schedule = {
  name: string;
  /** Standard five-field cron, exactly as it appears in the repo. */
  cron: string;
  /** IANA zone the cron is evaluated in. */
  timezone: string;
  cadence: string;
  what: string;
  why: string;
};

/**
 * The real Dagster schedules. The Pipeline tab counts down to the next firing
 * of each one, computed in the browser from these expressions, so the section
 * is live against the actual cadence rather than animating for effect.
 */
export const schedules: Schedule[] = [
  {
    name: "nightly_in_season_schedule",
    cron: "0 6 * * *",
    timezone: "America/Denver",
    cadence: "Daily, 6:00 Mountain",
    what: "Scores, box scores, betting lines, and ratings for the season in progress, then the dbt graph behind them.",
    why: "Games finish late. 6am Mountain is after the last west coast final and before anyone looks at the dashboard.",
  },
  {
    name: "march_madness_schedule",
    cron: "0 7,19 * 3 *",
    timezone: "America/Denver",
    cadence: "Twice daily through March",
    what: "The whole graph, every extractor followed by every model.",
    why: "Selection Sunday through the final, the odds move between afternoon and evening sessions.",
  },
  {
    name: "team_dimension_schedule",
    cron: "0 5 1 * *",
    timezone: "America/Denver",
    cadence: "Monthly, the 1st",
    what: "The team list and conference membership.",
    why: "Conference realignment is an offseason event, so refreshing it nightly would spend API budget rewriting rows that cannot change.",
  },
];

export type DashboardPage = {
  title: string;
  /**
   * The Evidence route, appended to the dashboard URL to link the card. A path
   * holding a bracketed parameter is a dynamic route with no landing page of
   * its own, so it is shown without a link.
   */
  path: string;
  detail: string;
};

/** The Evidence pages, in the order the dashboard lists them. */
export const dashboardPages: DashboardPage[] = [
  {
    title: "Season overview",
    path: "/",
    detail:
      "Every Division I team ranked on adjusted efficiency margin, with tempo, record, and strength of schedule alongside it.",
  },
  {
    title: "Tournament odds",
    path: "/bracket",
    detail:
      "The projected 64-team field and the odds of every team reaching each round, from 20,000 simulated brackets.",
  },
  {
    title: "Conferences",
    path: "/conferences",
    detail:
      "Ranked on the median team's rating rather than the best one, because one outstanding program can carry a mediocre league's reputation.",
  },
  {
    title: "Team pages",
    path: "/teams/[id]",
    detail:
      "A game log, an Elo timeline, and the priced matchup against anyone else in the country. Open one from any team on the season overview.",
  },
  {
    title: "How good is the model?",
    path: "/model",
    detail:
      "Accuracy, log loss, Brier score, and calibration curves for each predictor, with real forecasts separated from the ones that saw the future.",
  },
];

/** Headline counts, all of them from a real `dbt build`. */
export const stats = [
  { value: "22", label: "dbt models" },
  { value: "118", label: "tests" },
  { value: "20,000", label: "simulated brackets" },
  { value: "365", label: "teams tracked" },
];
