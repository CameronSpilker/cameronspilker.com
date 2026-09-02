export type Role = {
  company: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  highlights: string[];
  tags: string[];
};

/**
 * Source of truth: LinkedIn profile.
 *
 * Only the three most recent analytics engineering roles get bullets. Eleven
 * roles is a resume, not a portfolio, and a hiring manager who wants the full
 * history has a LinkedIn link two inches away. Every bullet is an outcome
 * (what changed, by how much), never a responsibility.
 */
export const experience: Role[] = [
  {
    company: "Typeform",
    title: "Senior Analytics Engineer",
    start: "Oct 2024",
    end: "Present",
    location: "Remote, Barcelona",
    highlights: [
      "Co-led a zero-downtime migration of 650+ dbt models and 600+ Looker dashboards, seven years of reporting, from Redshift to Snowflake.",
      "Built the feature-level product usage framework from an MVP of 7 features to 145 in production, giving stakeholders trustworthy adoption data for the first time.",
      "Leading the Looker to Omni move (400+ dashboards, 75+ Explores), prioritized by real usage so the highest-traffic reporting cut over first.",
    ],
    tags: ["dbt", "Snowflake", "Looker", "Omni", "CI/CD"],
  },
  {
    company: "Apollo.io",
    title: "Senior Analytics Engineer",
    start: "Sep 2023",
    end: "Oct 2024",
    location: "San Francisco, CA",
    highlights: [
      "Cut CI runtime 90% (60 to 6 minutes) with code diffing and smart caching, tightening the feedback loop for 10+ analytics engineers.",
      "Re-engineered 50+ dbt models and 150+ Looker assets after a Salesforce re-architecture, restoring accuracy across 20+ dashboards used for forecasting.",
      "Rebuilt reverse ETL syncs from 6M to 1.8M records and 30+ hours to under 1 hour, lowering compute cost and improving freshness.",
    ],
    tags: ["dbt", "Snowflake", "Looker", "Census", "Salesforce"],
  },
  {
    company: "Gopuff",
    title: "Analytics Engineer",
    start: "Mar 2022",
    end: "Sep 2023",
    location: "Philadelphia, PA",
    highlights: [
      "Delivered $300K+ in annualized savings by optimizing Snowflake queries and pipelines across core analytics workloads.",
      "Designed the centralized subject-area models behind Growth and Product Analytics: search, ads, impressions, marketing, and competitive pricing.",
      "Cut hourly job volume 33% through consolidation and scheduling changes, improving reliability for every downstream team.",
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
