import { site } from "@/content/site";
import { Section } from "./Section";

export function About() {
  return (
    <Section id="about" label="05 / about" title="Who I am">
      <div className="max-w-2xl space-y-4 text-base leading-relaxed">
        <p>
          I am an analytics engineer based in {site.location}. I work across the
          whole stack — pulling from raw APIs, modeling in dbt, orchestrating the
          runs, and shipping the dashboard people actually open. The parts I care
          most about are the unglamorous ones: tests, lineage, and documentation
          that makes a number defensible.
        </p>
        <p>
          I work AI-forward. I treat models as a way to move faster through the
          mechanical parts so more of my attention goes to the judgment calls —
          what to measure, what to trust, and what to throw away.
        </p>
        <p>
          I studied information systems at BYU, and I still teach spreadsheets
          there. TODO: add a closing line about what you are building now and what
          you are looking for.
        </p>
      </div>
    </Section>
  );
}
