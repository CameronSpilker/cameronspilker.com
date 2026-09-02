export type ProjectState = "live" | "repo";

/**
 * How a project renders inside the full-screen showcase.
 *
 * `image` is a path under `public/`, set automatically by the server component
 * when a capture exists (see `scripts/capture-shots.mjs`). Until a real
 * screenshot lands, the showcase draws a wireframe in `tint`. The tints and nav
 * labels below are taken from each product's own repo, not invented.
 */
export type Preview = {
  /** Wordmark drawn on the wireframe. */
  brand: string;
  /** Nav items drawn on the wireframe, real section names where known. */
  nav: string[];
  /** Two-stop gradient, dark to light, that carries the product's identity. */
  tint: [string, string];
  /** Accent used for the section rail while this project is on screen. */
  accent: string;
  /** Shape of the page below the fold, sketched behind the copy. */
  shape: "chart" | "grid" | "feed";
};

/**
 * The button on a project panel.
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
  /** One line under the project name in the showcase. */
  kicker: string;
  /** The plain-language what-it-is, in a sentence. */
  summary: string;
  /** The how-it-works paragraph under the summary. */
  blurb: string;
  href?: string;
  repo?: string;
  cta: Cta;
  tags: string[];
  /** Present on the projects that get a full-screen panel. */
  preview?: Preview;
};

/**
 * Scroll order for the showcase. The lab leads: it is the only one of the four
 * where every layer of the work is open, which is the thing this site is
 * actually arguing.
 */
export const projects: Project[] = [
  {
    slug: "full-data-stack-lab",
    name: "Full Data Stack Lab",
    state: "repo",
    kicker: "NCAA basketball, ingestion to dashboard, all in the open",
    summary:
      "Every NCAA Division I men's basketball team tracked through the season, the tournament simulated 20,000 times, and a page grading how well the model's own predictions did.",
    blurb:
      "Python pulls two public APIs into a DuckDB warehouse, dbt builds 22 models behind 113 tests, Dagster schedules the whole graph, and Evidence renders the dashboard from the same file dbt writes. The self-grading page is the part most bracket models leave out: forecasts that used only prior games are scored separately from ones that saw the future.",
    repo: "https://github.com/CameronSpilker/full-data-stack-lab",
    cta: {
      label: "Take the pipeline apart",
      href: "#stack",
      note: "Methodology, live schedule, and the dashboard, without leaving this page.",
    },
    tags: ["dbt", "DuckDB", "Dagster", "Evidence.dev", "Python"],
    preview: {
      brand: "Full Data Stack Lab",
      nav: ["Season", "Bracket", "Accuracy"],
      tint: ["#070D18", "#1D3768"],
      accent: "#7CA9FF",
      shape: "chart",
    },
  },
  {
    slug: "plainstocks",
    name: "Plainstocks",
    state: "live",
    kicker: "A weekly newsletter written by AI agents",
    summary:
      "Every week, a team of AI agents manages one real portfolio and writes up what it changed, trying to beat the S&P 500 in public.",
    blurb:
      "A multi-agent research desk holds 8 to 15 positions continuously and publishes every trade. Python gathers the data with no model involved; two Claude Code steps propose adds and exits; a judge step can only lower confidence, never invent a pick. Every position is marked daily against the S&P 500, and every issue stops at a human review gate before it sends.",
    href: "https://plainstocks.com",
    cta: {
      label: "Read this week's issue",
      href: "https://plainstocks.com",
      note: "Free weekly email. Every trade and the running score against the S&P 500.",
    },
    tags: ["Python", "Multi-agent", "Supabase", "GitHub Actions"],
    preview: {
      brand: "Plainstocks",
      nav: ["The desk", "Scorecard", "Subscribe"],
      // "The Ledger": the product's own ink panel and brass accent.
      tint: ["#14130E", "#3B3218"],
      accent: "#E7A93C",
      shape: "feed",
    },
  },
  {
    slug: "cardtacular",
    name: "Cardtacular",
    state: "live",
    kicker: "Co-founded with my brother Ethan",
    summary:
      "Make a digital greeting card in the browser and send it with a link.",
    blurb:
      "Pick a template, then lay out text, photos, GIFs, and voice messages across a four-page card. Nobody has to make an account to build one or to open one. React and Supabase, deployed as a static SPA.",
    href: "https://cardtacular.com",
    cta: {
      label: "Make a card in five minutes",
      href: "https://cardtacular.com",
      note: "No login to build one. No login for whoever opens it.",
    },
    tags: ["Founder", "React", "Supabase"],
    preview: {
      brand: "Cardtacular",
      nav: ["Editor", "Templates", "Dashboard"],
      // The app's own navy ground and cyan accent.
      tint: ["#0D1520", "#123A44"],
      accent: "#22E4DB",
      shape: "grid",
    },
  },
  {
    slug: "hoapulse",
    name: "HOApulse",
    state: "live",
    kicker: "AI financial analysis for HOA boards",
    summary:
      "Upload your HOA's financial statements and find out whether its books are healthy.",
    blurb:
      "Drop in an income statement and a balance sheet; get parsed line items, a dashboard, and a read on reserve health, budget against actual, and delinquency. The parser tries deterministic strategies first and only falls back to a model when they fail validation, so a normal month costs compute rather than tokens.",
    href: "https://hoapulse.net",
    cta: {
      label: "Score your HOA's books",
      href: "https://hoapulse.net",
      note: "Upload a statement, get reserve health and budget variance back.",
    },
    tags: ["Next.js", "Supabase", "PDF parsing", "AI"],
    preview: {
      brand: "HOApulse",
      nav: ["Upload", "Documents", "Dashboard"],
      // Dark reading of the product's own blue-and-teal palette.
      tint: ["#061627", "#0C4C5C"],
      accent: "#5B9DF9",
      shape: "chart",
    },
  },
];

/** Projects that get a full-screen panel, in scroll order. */
export const showcased = projects.filter((p) => p.preview);
