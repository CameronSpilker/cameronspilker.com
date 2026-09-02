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
      "Two public APIs: collegebasketballdata.com for games, box scores, and betting lines, Barttorvik for adjusted efficiency. Retries, rate limiting, and per-endpoint error isolation.",
  },
  {
    name: "Store",
    tool: "DuckDB",
    detail:
      "A Parquet landing zone and idempotent, partition-aware loads into a single warehouse file that both dbt and the dashboard read.",
  },
  {
    name: "Transform",
    tool: "dbt Core",
    detail:
      "Staging, intermediate, marts. 22 models behind 113 tests, with the predictor defined once in a macro so every consumer prices a game the same way.",
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

export type Decision = { q: string; a: string };

/** The choices worth defending in an interview, and the defence. */
export const decisions: Decision[] = [
  {
    q: "Why DuckDB?",
    a: "Free, runs anywhere, and Evidence reads it natively. The dataset is small enough that a cloud warehouse would buy nothing but a logo on the diagram.",
  },
  {
    q: "Why Dagster over Airflow?",
    a: "Asset-oriented scheduling maps cleanly onto a dbt DAG, so the lineage is one graph instead of two systems that have to agree.",
  },
  {
    q: "Why score against the betting line?",
    a: "\"The model went 71% straight up\" mostly measures whether favourites won. \"The model beat the closing spread\" is a claim. The market consensus is loaded as a first-class model and scored alongside the rest.",
  },
  {
    q: "Why can some models not claim to forecast?",
    a: "Published efficiency ratings describe a whole season, so scoring a January game with one means using March information. Every prediction carries a point-in-time flag and the dashboard separates on it rather than quietly averaging the two together.",
  },
  {
    q: "Why is Elo the only Python model?",
    a: "Everything else is SQL and should be. Elo is irreducibly sequential, which in SQL is a recursive CTE tens of thousands of levels deep. A loop is the honest shape of that computation.",
  },
  {
    q: "Why simulate the tournament 20,000 times?",
    a: "A team's chance of reaching the Final Four depends on who else wins, which has no closed form. Every probability the simulation draws on comes from one SQL mart, so the bracket page and the head-to-head numbers cannot disagree.",
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
  path: string;
  question: string;
  detail: string;
};

/** The Evidence pages, and the question each one exists to answer. */
export const dashboardPages: DashboardPage[] = [
  {
    title: "Season overview",
    path: "/",
    question: "Who is actually good this year?",
    detail:
      "Every Division I team ranked on adjusted efficiency margin, with tempo, record, and strength of schedule alongside it.",
  },
  {
    title: "Tournament odds",
    path: "/bracket",
    question: "Who wins in March?",
    detail:
      "The projected 64-team field and the odds of every team reaching each round, from 20,000 simulated brackets.",
  },
  {
    title: "Conferences",
    path: "/conferences",
    question: "Which league is deepest?",
    detail:
      "Ranked on the median team's rating rather than the best one, because one outstanding program can carry a mediocre league's reputation.",
  },
  {
    title: "Team pages",
    path: "/teams/[id]",
    question: "How did this team get here?",
    detail:
      "A game log, an Elo timeline, and the priced matchup against anyone else in the country.",
  },
  {
    title: "How good is the model?",
    path: "/model",
    question: "Should you believe any of this?",
    detail:
      "Accuracy, log loss, Brier score, and calibration curves for each predictor, with real forecasts separated from the ones that saw the future.",
  },
];

/** Headline counts, all of them from a real `dbt build`. */
export const stats = [
  { value: "22", label: "dbt models" },
  { value: "113", label: "tests" },
  { value: "20,000", label: "simulated brackets" },
  { value: "2", label: "public APIs" },
];
