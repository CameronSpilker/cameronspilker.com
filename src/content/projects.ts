export type ProjectState = "live" | "repo" | "archive";

/**
 * How a project renders inside the full-screen showcase.
 *
 * `image` is a path under `public/` — set automatically by the server
 * component when a capture exists (see `scripts/capture-shots.mjs`). Until a
 * real screenshot lands, the showcase draws a wireframe in `tint`, which shows
 * the product's color world without inventing marketing copy for it.
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
    kicker: "HOA financial analysis, automated",
    // TODO: replace with your own description of the problem it solves and the
    // analysis it automates. Everything here is safe but generic.
    blurb:
      "A SaaS product that turns an HOA's financial documents into an analysis a board can act on, instead of a PDF nobody reads.",
    href: "https://hoapulse.net",
    tags: ["SaaS", "Finance", "Product"],
    preview: {
      brand: "HOApulse",
      nav: ["Product", "Pricing", "Sign in"],
      tint: ["#04212B", "#0E5C6E"],
      accent: "#3FD2C7",
      shape: "chart",
    },
  },
  {
    slug: "cardtacular",
    name: "Cardtacular",
    state: "live",
    kicker: "Co-founded with my brother Ethan",
    // TODO: replace with the real product description — what you sell and to whom.
    blurb:
      "A trading card company I co-founded in 2025. I own the data side: inventory, pricing, and the reporting the business runs on.",
    href: "https://cardtacular.com",
    tags: ["Founder", "E-commerce"],
    preview: {
      brand: "Cardtacular",
      nav: ["Shop", "Breaks", "Cart"],
      tint: ["#1B0733", "#6D22A0"],
      accent: "#C77DFF",
      shape: "grid",
    },
  },
  {
    slug: "plainstocks",
    name: "Plainstocks",
    state: "live",
    // TODO: this is the one I know least about — tell me what it does and who
    // it is for, and both the kicker and the blurb should be rewritten.
    kicker: "Market data without the jargon",
    blurb:
      "A side project built around the idea that stock research should be readable by someone who does not do this for a living.",
    href: "https://plainstocks.com",
    tags: ["Product", "Data"],
    preview: {
      brand: "Plainstocks",
      nav: ["Screener", "Watchlist", "About"],
      tint: ["#06140F", "#155E3C"],
      accent: "#5BE49B",
      shape: "chart",
    },
  },
  {
    slug: "full-data-stack-lab",
    name: "Full Data Stack Lab",
    state: "repo",
    kicker: "Ingestion to dashboard, all in the open",
    blurb:
      "A living analytics engineering project that tracks the health and growth of the open-source data ecosystem using public GitHub and PyPI data. Python, DuckDB, dbt, Dagster, and Evidence — every layer in one repo, readable end to end.",
    repo: "https://github.com/CameronSpilker/full-data-stack-lab",
    tags: ["dbt", "DuckDB", "Dagster", "Evidence.dev", "Python"],
    preview: {
      brand: "Full Data Stack Lab",
      nav: ["Models", "Lineage", "Dashboard"],
      tint: ["#070D18", "#1D3768"],
      accent: "#7CA9FF",
      shape: "feed",
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
    kicker: "BYU capstone, 2019 — Most Innovative Project",
    // TODO: describe the architecture and which part you owned.
    blurb:
      "A Microsoft HoloLens facial recognition app built as an information systems capstone.",
    tags: ["HoloLens", "C#", "Computer Vision"],
  },
  {
    slug: "marketing-analytics-consulting",
    name: "Digital Marketing Analytics",
    state: "archive",
    kicker: "Consulting engagement",
    // TODO: describe scope and outcome, and add a link if it is still live.
    blurb: "An analytics build-out for a digital marketing practice.",
    tags: ["GA4", "Consulting"],
  },
];
