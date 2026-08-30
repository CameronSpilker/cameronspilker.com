export type Role = {
  company: string;
  title: string;
  start: string;
  end: string;
  highlights: string[];
  tags: string[];
};

// TODO: highlights below are placeholders pending real impact metrics.
// Replace each bullet with an outcome (what changed, by how much), not a responsibility.
export const experience: Role[] = [
  {
    company: "Typeform",
    title: "Sr. Analytics Engineer",
    start: "Oct 2024",
    end: "Present",
    highlights: ["TODO: impact bullet", "TODO: impact bullet", "TODO: impact bullet"],
    tags: ["dbt", "Snowflake", "Looker", "Python"],
  },
  {
    company: "Apollo.io",
    title: "Sr. Analytics Engineer",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet", "TODO: impact bullet", "TODO: impact bullet"],
    tags: ["dbt", "Snowflake", "SQL"],
  },
  {
    company: "Gopuff",
    title: "Analytics Engineer",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet", "TODO: impact bullet", "TODO: impact bullet"],
    tags: ["dbt", "Snowflake", "Airflow"],
  },
  {
    company: "Lendio",
    title: "Data Engineer",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet", "TODO: impact bullet", "TODO: impact bullet"],
    tags: ["Python", "SQL", "ETL"],
  },
  {
    company: "American Express",
    title: "Data Analytics & Innovation Analyst",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet", "TODO: impact bullet"],
    tags: ["SQL", "Analytics"],
  },
  {
    company: "Eide Bailly / Xerva",
    title: "BI Developer Intern",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet", "TODO: impact bullet"],
    tags: ["Power BI", "SQL"],
  },
  {
    company: "KPMG",
    title: "Advisory Intern",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet"],
    tags: ["Advisory"],
  },
  {
    company: "Brigham Young University",
    title: "Adjunct Professor — IS 515, Advanced Spreadsheets",
    start: "TODO",
    end: "TODO",
    highlights: ["TODO: impact bullet"],
    tags: ["Teaching", "Excel"],
  },
];
