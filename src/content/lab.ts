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
 * 12 singular tests under `transform/tests`, five finished seasons in
 * `ingestion/seasons.yml` (2022 to 2026, with 2027 under way), and the cron
 * string is the literal `cron_schedule` from
 * `orchestration/full_data_stack_lab/jobs.py`.
 *
 * The model and test counts are shown as floors ("20+", "150+") rather than
 * exact figures, so the lab can add a model or a test without this page going
 * wrong. A floor still has to be true: if the repo ever drops below one, lower
 * it. The cron string has no such slack and must match the repo exactly.
 */

import { lab } from "./site";

/** Headline counts, each one a floor on what is countable in the lab repo. */
export const stats = [
  { value: "20+", label: "dbt models" },
  { value: "150+", label: "tests" },
  { value: "5", label: "seasons to pick from" },
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
  label: "Side project",
  countdownLabel: "Next update in",
};

export type Elsewhere = {
  title: string;
  href: string | null;
};

/**
 * The rest of the project, as quick links under the card. Teams leads because
 * picking a season and a team is what the dashboards are for. The tournament
 * simulations sit on their own March Madness tab rather than leading.
 */
export const elsewhere: Elsewhere[] = [
  { title: "Pick a team", href: lab.teams },
  { title: "March Madness odds", href: lab.marchMadness },
  { title: "How it's built", href: lab.dashboard ? `${lab.dashboard}/how-it-works` : null },
  { title: "dbt Charts boards", href: lab.charts },
  { title: "dbt docs", href: lab.docs },
  { title: "Source code", href: lab.repo },
];
