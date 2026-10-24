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
  chip: "Analytics engineer · building with AI",
  hello: "Hi, I'm Cameron.",
  line: "I like building things.",
  lede: "At Typeform I build the data that people and AI agents rely on. In my spare time I make side projects, one of them with my brother. Here's what I've been working on.",
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
  lede: "Analytics engineering at Typeform, Apollo.io and Gopuff, with data engineering and analytics before that. The common thread is building sources of truth: data that a dashboard, a person asking a question, and an AI agent can all rely on.",
  linkedin: "Full history on LinkedIn",
  earlier: "Before that",
  more: "Show details",
  less: "Hide details",
};

export const about = {
  label: "About",
  title: "A bit about me",
  paragraphs: [
    "I'm an analytics engineer in Utah. The way I see the job, it's building sources of truth: well modeled data with clear definitions, so a dashboard, a person with a question, and an AI agent all get the same answer.",
    "AI is a big part of how I work. I use it to build faster, and more of what I build is for it now, like the semantic layer and the evals behind conversational analytics at Typeform.",
    "Outside of work I make side projects, one of them with my brother Ethan, and I run a college basketball model in public. I studied information systems at BYU and later went back to teach a spreadsheets class there.",
  ],
  factsTitle: "A few other things",
  facts: [
    { k: "Based in", v: "Utah" },
    { k: "Started out in", v: "Audit analytics, at BYU" },
    { k: "Studied", v: "Information Systems, BYU (BS + MS)" },
    { k: "Taught", v: "IS 515, Advanced Spreadsheets, at BYU" },
    { k: "Side projects", v: "Four live, one with my brother" },
    { k: "Usually using", v: "dbt · Snowflake · Omni · Claude Code · Python" },
  ],
};

export const contact = {
  label: "Contact",
  title: "Say hi",
  lede: "Happy to chat about data, AI, side projects, or anything on this page.",
  footer: "Built with Next.js, hosted on Vercel.",
};
