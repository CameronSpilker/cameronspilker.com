export type ProjectState = "live" | "repo" | "archive";

export type Project = {
  slug: string;
  name: string;
  state: ProjectState;
  blurb: string;
  href?: string;
  repo?: string;
  tags: string[];
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: "full-data-stack-lab",
    name: "Full Data Stack Lab",
    state: "repo",
    blurb:
      "A living analytics engineering project that tracks the health and growth of the open-source data ecosystem using public GitHub and PyPI data. Ingestion to dashboard: Python + DuckDB + dbt + Dagster + Evidence, all in the open.",
    repo: "https://github.com/CameronSpilker/full-data-stack-lab",
    tags: ["dbt", "DuckDB", "Dagster", "Evidence.dev", "Python"],
    featured: true,
  },
  {
    slug: "plainstocks",
    name: "Plainstocks",
    state: "live",
    blurb: "TODO: one-paragraph description of what Plainstocks does and who it is for.",
    href: "https://plainstocks.com",
    tags: ["Product"],
  },
  {
    slug: "hoapulse",
    name: "HOApulse",
    state: "live",
    blurb:
      "HOA financial analysis SaaS. TODO: describe the problem it solves and the analysis it automates.",
    href: "https://hoapulse.net",
    tags: ["SaaS", "Finance"],
  },
  {
    slug: "cardtacular",
    name: "Cardtacular",
    state: "live",
    blurb:
      "TODO: describe the product and the company. Built with my brother Ethan.",
    href: "https://cardtacular.com",
    tags: ["Product", "E-commerce"],
  },
  {
    slug: "holorekognition",
    name: "HoloRekognition",
    state: "archive",
    blurb:
      "Microsoft HoloLens facial recognition app, BYU information systems capstone (2019). TODO: describe the architecture and what you owned.",
    tags: ["HoloLens", "C#", "Computer Vision"],
  },
  {
    slug: "marketing-analytics-consulting",
    name: "Digital Marketing Analytics Site",
    state: "archive",
    blurb:
      "Consulting and learning project — analytics build-out for a digital marketing practice. TODO: describe scope and outcome, add link if live.",
    tags: ["GA4", "Consulting"],
  },
];
