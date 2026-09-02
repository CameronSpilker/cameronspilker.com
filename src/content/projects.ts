export type ProjectState = "live" | "repo" | "archive";

/**
 * How a project renders inside the full-screen showcase.
 *
 * `image` is a path under `public/` — set automatically by the server
 * component when a capture exists (see `scripts/capture-shots.mjs`). Until a
 * real screenshot lands, the showcase draws a wireframe in `tint`. The tints
 * and nav labels below are taken from each product's own repo, not invented.
 */
export type Preview = {
  /** Wordmark drawn on the wireframe. */
  brand: string;
  /** Nav items drawn on the wireframe — real section names where known. */
  nav: string[];
  /** Two-stop gradient, dark to light, that carries the product's identity. */
  tint: [string, string];
  /** Accent used for the section rail while this project is on screen. */
  accent: string;
  /** Shape of the page below the fold, sketched behind the copy. */
  shape: "chart" | "grid" | "feed";
};

export type Project = {
  slug: string;
  name: string;
  state: ProjectState;
  /** One line under the project name in the showcase. */
  kicker: string;
  blurb: string;
  href?: string;
  repo?: string;
  tags: string[];
  /** Present on the projects that get a full-screen panel. */
  preview?: Preview;
};

export const projects: Project[] = [
  {
    slug: "hoapulse",
    name: "HOApulse",
    state: "live",
    kicker: "AI financial analysis for HOA boards",
    blurb:
      "Upload an HOA's income statement and balance sheet; get parsed line items, a dashboard, and a read on reserve health, budget vs. actual, and delinquency. The parser tries deterministic strategies first and only falls back to a model when they fail validation, so a normal month costs compute rather than tokens.",
    href: "https://hoapulse.net",
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
  {
    slug: "cardtacular",
    name: "Cardtacular",
    state: "live",
    kicker: "Co-founded with my brother Ethan",
    blurb:
      "Digital greeting cards built in the browser. Pick a template, then lay out text, images, GIFs, and voice messages across a four-page card and share it with a link — no login needed to make one. React and Supabase, deployed as a static SPA.",
    href: "https://cardtacular.com",
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
    slug: "plainstocks",
    name: "Plainstocks",
    state: "live",
    kicker: "AI agents running one portfolio, in the open",
    blurb:
      "A multi-agent research desk that manages a single continuously-held portfolio of 8–15 positions and publishes what it changed each week. Python gathers the data with no model involved; two Claude Code steps propose adds and exits; a judge step can only lower confidence, never invent a pick. Every position is marked daily against the S&P 500, and every issue stops at a human review gate before it sends.",
    href: "https://plainstocks.com",
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
    slug: "full-data-stack-lab",
    name: "Full Data Stack Lab",
    state: "repo",
    kicker: "Ingestion to dashboard, all in the open",
    blurb:
      "Every NCAA Division I men's basketball team tracked through the season, the tournament simulated 20,000 times, and — the part most bracket models leave out — a page reporting how well its own predictions did. Python to DuckDB to dbt to Dagster to Evidence: 22 models, 113 tests, every layer in one repo and readable end to end.",
    repo: "https://github.com/CameronSpilker/full-data-stack-lab",
    tags: ["dbt", "DuckDB", "Dagster", "Evidence.dev", "Python"],
    preview: {
      brand: "Full Data Stack Lab",
      nav: ["Season", "Bracket", "Accuracy"],
      tint: ["#070D18", "#1D3768"],
      accent: "#7CA9FF",
      shape: "chart",
    },
  },
];

/** Projects that get a full-screen panel, in scroll order. */
export const showcased = projects.filter((p) => p.preview);

/** Earlier work, listed compactly under the showcase. */
export const archived: Project[] = [
  {
    slug: "holorekognition",
    name: "HoloRekognition",
    state: "archive",
    kicker: "BYU MISM capstone, 2019 — Most Innovative Project",
    blurb:
      "A Microsoft HoloLens app that identifies the person in front of you. A tap gesture captures a photo, Azure Face locates the face and matches it against a trained person group, and Unity draws a rectangle with that person's details in 3D space — positioned by estimating distance from how large the face reads. Built by a team of three; my piece was the Python utility that exported and managed the Azure person group behind it.",
    repo: "https://github.com/CameronSpilker/DownloadPersonGroupInformation",
    tags: ["HoloLens", "Unity", "Azure Face API", "Python"],
  },
  {
    slug: "hair-vibes-studio",
    name: "Hair Vibes Studio",
    state: "archive",
    kicker: "Marketing and analytics for my wife's salon",
    // No link: the studio's Google Business site stopped resolving when Google
    // retired Business Profile websites.
    blurb:
      "Launched and ran the online presence for my wife's hair studio — a Google Business site, Google Ads campaigns, and local SEO — along with the performance tracking that showed which spend actually brought clients through the door. The studio has since closed, but it was small-business marketing owned end to end rather than analyzed from the outside.",
    tags: ["Google Ads", "Local SEO", "Small business"],
  },
];
