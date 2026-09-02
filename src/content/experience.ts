export type Role = {
  company: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  highlights: string[];
  tags: string[];
};

// Source of truth: LinkedIn profile. Keep this scannable — a hiring manager
// should get the shape of a role in three bullets or fewer. Every bullet is an
// outcome (what changed, by how much), never a responsibility.
export const experience: Role[] = [
  {
    company: "Typeform",
    title: "Senior Analytics Engineer",
    start: "Oct 2024",
    end: "Present",
    location: "Remote — Barcelona",
    highlights: [
      "Co-led a zero-downtime migration of 650+ dbt models and 600+ Looker dashboards — seven years of reporting — from Redshift to Snowflake.",
      "Built the feature-level product usage framework from an MVP of 7 features to 145 in production, giving stakeholders trustworthy adoption data for the first time.",
      "Leading the Looker → Omni move (400+ dashboards, 75+ Explores), prioritized by real usage so the highest-traffic reporting cut over first.",
    ],
    tags: ["dbt", "Snowflake", "Looker", "Omni", "CI/CD"],
  },
  {
    company: "Cardtacular",
    title: "Co-Founder",
    start: "Oct 2025",
    end: "Present",
    highlights: [
      "Co-founded a trading card e-commerce company with my brother, owning the data and analytics side end to end.",
    ],
    tags: ["Founder", "E-commerce"],
  },
  {
    company: "Independent",
    title: "Data Advisor",
    start: "Jan 2022",
    end: "Present",
    highlights: [
      "Advise startups and teams on dbt project setup, modeling and testing, orchestration, and BI implementation.",
      "Mentor data professionals through job searches, interviews, and skill development.",
    ],
    tags: ["dbt", "Advisory", "Mentorship"],
  },
  {
    company: "Brigham Young University",
    title: "Adjunct Professor — IS 515, Advanced Spreadsheets",
    start: "Jan 2025",
    end: "Apr 2025",
    location: "Provo, UT",
    highlights: [
      "Taught advanced spreadsheet analysis to ~200 students, producing weekly video and written instruction for a fully virtual section.",
      "Coordinated and trained the TA team to keep grading and feedback consistent across every section.",
    ],
    tags: ["Teaching", "Excel"],
  },
  {
    company: "Apollo.io",
    title: "Senior Analytics Engineer",
    start: "Sep 2023",
    end: "Oct 2024",
    location: "San Francisco, CA",
    highlights: [
      "Cut CI runtime 90% (60 → 6 minutes) with code diffing and smart caching, tightening the feedback loop for 10+ analytics engineers.",
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
      "Designed the centralized subject-area models behind Growth and Product Analytics — search, ads, impressions, marketing, and competitive pricing.",
      "Cut hourly job volume 33% through consolidation and scheduling changes, improving reliability for every downstream team.",
    ],
    tags: ["dbt", "Snowflake", "Looker", "Sigma"],
  },
  {
    company: "Lendio",
    title: "Data Engineer",
    start: "Jun 2021",
    end: "Mar 2022",
    location: "Lehi, UT",
    highlights: [
      "Implemented dbt from the ground up, standardizing naming, testing, and deployment across every new model.",
      "Brought version control, CI/CD, and testing to the analytics stack, cutting pipeline errors roughly 40%.",
      "Modeled 10+ source systems into analytics-ready datasets, roughly doubling how fast analysts could ship insight.",
    ],
    tags: ["dbt", "Python", "SQL", "CI/CD"],
  },
  {
    company: "American Express",
    title: "Data Analytics & Innovation Analyst",
    start: "May 2019",
    end: "Jun 2021",
    location: "Sandy, UT",
    highlights: [
      "Built and maintained 100+ analytics in SQL, Python, and Tableau evaluating operational risk and control effectiveness across global audit entities.",
      "Automated recurring audit steps with data-intensive control tests, reducing manual testing effort 30–40%.",
      "Processed billions of transaction records across Teradata, Hive, Yellowbrick, and PostgreSQL into reliable foundations for testing and reporting.",
    ],
    tags: ["SQL", "Python", "Tableau", "Teradata"],
  },
  {
    company: "Xerva, an Eide Bailly company",
    title: "Business Intelligence Developer",
    start: "Jan 2019",
    end: "May 2019",
    location: "Orem, UT",
    highlights: [
      "Built client dashboards in Tableau, Power BI, and Domo, and converted legacy SQL to run on Snowflake.",
    ],
    tags: ["Tableau", "Power BI", "Snowflake"],
  },
  {
    company: "Brigham Young University",
    title: "Associate Audit Analyst",
    start: "May 2017",
    end: "Jan 2019",
    location: "Provo, UT",
    highlights: [
      "Ran the internal audit department's data analytics program day to day, building the Tableau dashboards behind continuous auditing.",
    ],
    tags: ["SQL", "Tableau", "SAP"],
  },
  {
    company: "KPMG",
    title: "Advisory Intern",
    start: "Jun 2018",
    end: "Aug 2018",
    location: "Salt Lake City, UT",
    highlights: [
      "Automated client scheduling and metric analysis with Excel macros, surfacing anomalies for the audit team.",
    ],
    tags: ["Excel", "Advisory"],
  },
];
