export type ProjectState = "live" | "repo";

/**
 * The button on a project card.
 *
 * Never "Visit site". A visitor decides whether to click on what they get for
 * clicking, so `label` names the thing they walk away with and `note` says what
 * it costs them in time, money, or signup.
 */
export type Cta = {
  label: string;
  href: string;
  note?: string;
};

export type Project = {
  slug: string;
  name: string;
  state: ProjectState;
  /** A short line above the name: who it is for, or who it was made with. */
  kicker: string;
  /** What it is, in a sentence. */
  summary: string;
  /** How it works, for the reader who wants a little more. */
  blurb: string;
  href?: string;
  repo?: string;
  cta: Cta;
  tags: string[];
};

/**
 * Display order. Cardtacular leads and gets the big card. The lab is last
 * because it has a card of its own, with its live countdown, under the rest.
 *
 * Every claim here is one the product's own repo or site backs up. Plainstocks
 * says "simulated" or "no real money" up front, because a portfolio newsletter
 * that leaves the reader guessing whether the money is real has misled them.
 */
export const projects: Project[] = [
  {
    slug: "cardtacular",
    name: "Cardtacular",
    state: "live",
    kicker: "Made with my brother Ethan",
    summary: "Digital greeting cards you make in the browser and send with a link.",
    blurb:
      "Pick a template, then add text, photos, GIFs and voice messages across a four page card. You don't need an account to make one. Built with React and Supabase.",
    href: "https://cardtacular.com",
    cta: {
      label: "Make a card",
      href: "https://cardtacular.com",
      // Only what the repo establishes. Whether the recipient needs an account
      // is unconfirmed, so the note does not claim either way.
      note: "No account needed to make one.",
    },
    tags: ["React", "Supabase"],
  },
  {
    slug: "plainstocks",
    name: "Plainstocks",
    state: "live",
    kicker: "A weekly newsletter",
    summary:
      "A few AI agents run a simulated portfolio and try to beat the S&P 500. Every week they write up what they changed.",
    blurb:
      "No real money involved. Python gathers the data, a couple of Claude Code steps suggest what to add and drop, a judge step can only lower their confidence, and every issue gets a human read before it sends.",
    href: "https://plainstocks.com",
    cta: {
      // The issues go out by email and are not posted on the site, so a button
      // promising this week's issue promises something the link cannot deliver.
      label: "Get the newsletter",
      href: "https://plainstocks.com",
      note: "Free weekly email.",
    },
    tags: ["Python", "Multi-agent", "Supabase"],
  },
  {
    slug: "hoapulse",
    name: "HOApulse",
    state: "live",
    kicker: "For HOA boards",
    summary: "Upload your HOA's financial statements and see whether the books look healthy.",
    blurb:
      "It reads an income statement and a balance sheet, then shows reserve health, budget against actual, and delinquency on a dashboard. Plain parsing rules go first, and an AI model only steps in when they can't make sense of a file.",
    href: "https://hoapulse.net",
    cta: {
      label: "Check your HOA's books",
      href: "https://hoapulse.net",
      note: "Upload a statement to start.",
    },
    tags: ["Next.js", "Supabase", "AI"],
  },
  {
    slug: "full-data-stack-lab",
    name: "Full Data Stack Lab",
    state: "live",
    kicker: "College basketball, from raw data to dashboard",
    summary:
      "A college basketball model I run in the open. It tracks every Division I men's team, simulates the tournament 20,000 times, and keeps score on how its own picks did.",
    blurb:
      "Python pulls a public API into DuckDB, dbt builds 20+ models behind 150+ tests, Dagster runs it every night, and Evidence draws the dashboard.",
    href: "https://lab.cameronspilker.com",
    repo: "https://github.com/CameronSpilker/full-data-stack-lab",
    cta: {
      label: "Open the lab",
      href: "https://lab.cameronspilker.com",
    },
    tags: ["dbt", "DuckDB", "Dagster", "Evidence", "Python"],
  },
];
