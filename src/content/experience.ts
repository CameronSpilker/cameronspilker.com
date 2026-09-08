export type Role = {
  company: string;
  title: string;
  start: string;
  end: string;
  highlights: string[];
  tags: string[];
};

/**
 * Source of truth: LinkedIn profile. The bullets here track the ones on the
 * profile, so a recruiter reading both sees the same claims.
 *
 * Only the three most recent analytics engineering roles get bullets. Eleven
 * roles is a resume, not a portfolio, and a hiring manager who wants the full
 * history has a LinkedIn link two inches away. Every bullet is an outcome
 * (what changed, by how much), never a responsibility. Locations are not
 * listed: the roles are remote, and where a company is headquartered says
 * nothing about the work.
 */
export const experience: Role[] = [
  {
    company: "Typeform",
    title: "Senior Analytics Engineer",
    start: "Oct 2024",
    end: "Present",
    highlights: [
      "Launched conversational analytics on the Omni semantic layer, giving stakeholders natural language access to governed metrics. Built reusable components into the dbt repo and run evals on the context behind them to keep answers accurate.",
      "Co-led a zero-downtime migration of 650+ dbt models and 600+ Looker assets, seven years of reporting and operational data, from Redshift to Snowflake.",
      "Led the Looker to Omni migration of 400+ dashboards and 75+ Explores, prioritized by real usage and delivered with an external team. Now the Omni admin for access, permissions, and user content.",
      "Built feature-level reporting end to end: consolidated eventing data, defined the key properties, and shipped the dbt models, semantic layer, and dashboards. Scaled from an MVP of 7 features to 145 in production.",
      "Introduced macros, DRY doc blocks, PR templates, and CI/CD with automated summaries and data diffs, cutting review cycles ~25% across a four person analytics engineering team.",
    ],
    tags: ["dbt", "Snowflake", "Omni", "Semantic layer", "AI", "CI/CD"],
  },
  {
    company: "Apollo.io",
    title: "Senior Analytics Engineer",
    start: "Sep 2023",
    end: "Oct 2024",
    highlights: [
      "Cut CI/CD runtime from 60 minutes to 6 through code diffing and smart caching, accelerating PR feedback for 10+ analytics engineers.",
      "Re-engineered 50+ dbt models and 150+ Looker assets after major Salesforce architecture changes, restoring accuracy across 20+ dashboards used by Sales, Finance, Customer Success, and Marketing.",
      "Streamlined reverse ETL syncs, reducing processed records from 6 million to 1.8 million and sync duration from 30+ hours to under 1, lowering compute cost and improving freshness.",
      "Led a company wide doc-a-thon that raised dbt documentation coverage from 46% to 85%, improving discoverability and onboarding.",
    ],
    tags: ["dbt", "Snowflake", "Looker", "Census", "Salesforce"],
  },
  {
    company: "Gopuff",
    title: "Analytics Engineer",
    start: "Mar 2022",
    end: "Sep 2023",
    highlights: [
      "Achieved $300K+ in annualized savings by optimizing Snowflake queries and pipelines across core analytics workloads.",
      "Designed centralized subject area models for the Growth and Product Analytics teams covering search, ads, impressions, marketing performance, and competitive pricing, increasing consistency across 10+ core metrics.",
      "Built and maintained Looker and Sigma dashboards enabling self serve analytics for hundreds of internal users, reducing ad hoc report requests ~25%.",
    ],
    tags: ["dbt", "Snowflake", "Looker", "Sigma"],
  },
];

export type EarlierRole = {
  company: string;
  title: string;
  years: string;
};

/**
 * Everything before Gopuff, as names and dates only. It establishes the arc
 * (audit analyst to data engineer to analytics engineer) without asking anyone
 * to read nine years of bullets.
 */
export const earlier: EarlierRole[] = [
  {
    company: "Brigham Young University",
    title: "Adjunct Professor, IS 515 Advanced Spreadsheets",
    years: "2025",
  },
  { company: "Lendio", title: "Data Engineer", years: "2021 to 2022" },
  {
    company: "American Express",
    title: "Data Analytics & Innovation Analyst",
    years: "2019 to 2021",
  },
  {
    company: "Xerva, an Eide Bailly company",
    title: "Business Intelligence Developer",
    years: "2019",
  },
  {
    company: "Brigham Young University",
    title: "Associate Audit Analyst",
    years: "2017 to 2019",
  },
  { company: "KPMG", title: "Advisory Intern", years: "2018" },
];
