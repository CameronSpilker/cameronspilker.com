import { site } from "@/content/site";
import { Section } from "./Section";

const facts = [
  { k: "Based in", v: site.location },
  { k: "Studied", v: "Information Systems, BYU (BS + MS)" },
  { k: "Taught", v: "IS 515, Advanced Spreadsheets, at BYU" },
  { k: "Tools", v: "dbt · Snowflake · Looker · Omni · Python" },
];

export function About() {
  return (
    <Section id="about" label="About" title="Who I am">
      <div className="grid gap-12 lg:grid-cols-[1fr_18rem] lg:gap-16">
        <div className="max-w-2xl space-y-4 text-base leading-relaxed">
          <p>
            I am an analytics engineer based in {site.location}. I work across
            the whole stack: pulling from raw APIs, modeling in dbt,
            orchestrating the runs, and shipping the dashboard people actually
            open. The parts I care most about are the unglamorous ones. Tests,
            lineage, and documentation are what make a number defensible.
          </p>
          <p>
            I work AI-forward. I treat models as a way to move faster through
            the mechanical parts so more of my attention goes to the judgment
            calls: what to measure, what to trust, and what to throw away.
          </p>
          <p>
            I studied information systems at BYU and taught spreadsheets there.
            Mostly I like building things with AI and working with data, and I
            am always happy to talk with people doing either. If something here
            is useful to you, or you want to compare notes on any of it, get in
            touch.
          </p>
        </div>

        <dl className="h-fit space-y-5 border-t border-line/70 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          {facts.map((fact) => (
            <div key={fact.k}>
              <dt className="font-mono text-xs tracking-wider text-body/60 uppercase">
                {fact.k}
              </dt>
              <dd className="mt-1 text-sm text-bright">{fact.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
