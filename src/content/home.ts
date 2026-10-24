/**
 * Copy for the homepage, outside the projects themselves.
 *
 * The voice is relaxed on purpose: this is a portfolio of things I made, not a
 * pitch. Say what a thing is and let people click on it. No superlatives, no
 * claims the projects cannot back up.
 */

export const nav = {
  sections: [
    { id: "projects", label: "Projects" },
    { id: "tools", label: "Tools" },
    { id: "work", label: "Experience" },
    { id: "about", label: "About" },
  ],
  contact: "Say hi",
  menu: "Menu",
  close: "Close",
};

export const hero = {
  chip: "Analytics engineer · side project builder",
  hello: "Hi, I'm Cameron.",
  line: "I like building things.",
  lede: "I work with data at Typeform. In my spare time I make side projects, a couple of them with my brother. Here's what I've been working on.",
  primary: "See my projects",
  secondary: "Say hi",
};

export const projectsIntro = {
  label: "Projects",
  title: "Things I've made",
  lede: "They're all live, so feel free to poke around.",
  featured: "Latest",
};

export const toolsIntro = {
  all: "All tools",
};

export const workIntro = {
  label: "Experience",
  title: "Where I've worked",
  lede: "I've been doing analytics engineering at Typeform, Apollo.io and Gopuff, with data engineering and analytics roles before that. Most of it comes down to data models, migrations, and dashboards people can rely on.",
  linkedin: "Full history on LinkedIn",
  earlier: "Before that",
  more: "Show highlights",
};

export const about = {
  label: "About",
  title: "A bit about me",
  paragraphs: [
    "I'm an analytics engineer in Utah. Day to day that means pulling data in, modeling it with dbt, and building the dashboards people actually open.",
    "Outside of work I like building small products, usually with a lot of help from AI, and seeing if anyone finds them useful. I studied information systems at BYU and later taught a spreadsheets class there.",
  ],
  facts: [
    { k: "Based in", v: "Utah" },
    { k: "Studied", v: "Information Systems, BYU (BS + MS)" },
    { k: "Taught", v: "IS 515, Advanced Spreadsheets, at BYU" },
    { k: "Usually using", v: "dbt · Snowflake · Looker · Omni · Python" },
  ],
};

export const contact = {
  label: "Contact",
  title: "Say hi",
  lede: "Happy to chat about data, side projects, or anything on this page.",
  footer: "Built with Next.js, hosted on Vercel.",
};
