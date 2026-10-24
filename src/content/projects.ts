export type ProjectState = "live" | "repo";

/**
 * The button on a project card.
 *
 * Never "Visit site". A visitor decides whether to click on what they get for
 * clicking, so `label` names the thing they walk away with.
 */
export type Cta = {
  label: string;
  href: string;
};

/**
 * A project card is deliberately short: a small label, a one sentence
 * headline, and a button. The product's own site carries the detail.
 */
export type Project = {
  slug: string;
  name: string;
  state: ProjectState;
  /** A short line above the name: who it is for, or who it was made with. */
  kicker: string;
  /** What it is, in a sentence. This is the card's headline. */
  summary: string;
  href?: string;
  repo?: string;
  cta: Cta;
};

/**
 * Display order. Cardtacular leads and gets the big card. The lab is last
 * because it has a card of its own, with its numbers and countdown, under the
 * rest.
 *
 * Every claim here is one the product's own repo or site backs up. Plainstocks
 * says "simulated" up front, because a portfolio newsletter that leaves the
 * reader guessing whether the money is real has misled them.
 */
export const projects: Project[] = [
  {
    slug: "cardtacular",
    name: "Cardtacular",
    state: "live",
    kicker: "Made with my brother Ethan",
    summary: "Digital greeting cards you make in the browser and send with a link.",
    href: "https://cardtacular.com",
    cta: { label: "Make a card", href: "https://cardtacular.com" },
  },
  {
    slug: "plainstocks",
    name: "Plainstocks",
    state: "live",
    kicker: "A weekly newsletter",
    summary:
      "A few AI agents run a simulated portfolio and try to beat the S&P 500, then write up what they changed each week.",
    href: "https://plainstocks.com",
    // The issues go out by email and are not posted on the site, so a button
    // promising this week's issue promises something the link cannot deliver.
    cta: { label: "Get the newsletter", href: "https://plainstocks.com" },
  },
  {
    slug: "hoapulse",
    name: "HOApulse",
    state: "live",
    kicker: "For HOA boards",
    summary: "Upload your HOA's financial statements and see whether the books look healthy.",
    href: "https://hoapulse.net",
    cta: { label: "Check your HOA's books", href: "https://hoapulse.net" },
  },
  {
    slug: "full-data-stack-lab",
    name: "Full Data Stack Lab",
    state: "live",
    kicker: "College basketball, from raw data to dashboard",
    summary:
      "A college basketball model I run in the open. It tracks every Division I men's team, simulates the tournament 20,000 times, and keeps score on how its own picks did.",
    href: "https://lab.cameronspilker.com",
    repo: "https://github.com/CameronSpilker/full-data-stack-lab",
    cta: { label: "Open the lab", href: "https://lab.cameronspilker.com" },
  },
];
