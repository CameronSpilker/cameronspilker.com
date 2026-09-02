import { Section } from "./Section";

const layers = [
  { name: "Ingest", tool: "Python + GitHub / PyPI APIs" },
  { name: "Store", tool: "DuckDB" },
  { name: "Transform", tool: "dbt Core" },
  { name: "Orchestrate", tool: "Dagster" },
  { name: "Present", tool: "Evidence.dev" },
];

const decisions = [
  {
    q: "Why DuckDB?",
    a: "Free forever, runs anywhere, and Evidence reads it natively. The dataset is small enough that a warehouse bill would buy nothing but a logo on the diagram.",
  },
  {
    q: "Why Dagster over Airflow?",
    a: "Asset-oriented scheduling maps cleanly onto a dbt DAG, so the lineage is one graph instead of two systems that have to agree.",
  },
  {
    q: "Why Evidence?",
    a: "Dashboards as code, versioned in the same repo as the models they read. Nothing lives only inside a BI tool's UI.",
  },
];

export function DataStack() {
  return (
    <Section
      id="stack"
      label="Analytics engineering"
      title="Full Data Stack Lab"
      lede="A public analytics project that tracks the health and growth of the open-source data ecosystem — the tools I use, measured with the tools I use. Every layer is in one repo and readable end to end."
    >
      {/* The pipeline is a genuine sequence, so it gets numbered steps and a
          connecting rail. Nothing else on the page is numbered. */}
      <ol className="relative grid gap-3 sm:grid-cols-5">
        <span
          aria-hidden="true"
          className="absolute top-9 right-4 left-4 hidden h-px bg-gradient-to-r from-accent/50 via-line to-line sm:block"
        />
        {layers.map((layer, i) => (
          <li
            key={layer.name}
            className="relative rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent/40"
          >
            <p className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-2 font-medium text-bright">{layer.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-body/80">{layer.tool}</p>
          </li>
        ))}
      </ol>

      <dl className="mt-14 grid gap-8 sm:grid-cols-3">
        {decisions.map((d) => (
          <div key={d.q}>
            <dt className="font-mono text-sm text-bright">{d.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed">{d.a}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 font-mono text-sm">
        <a
          href="https://github.com/CameronSpilker/full-data-stack-lab"
          className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
        >
          Read the repo →
        </a>
        {/* TODO: link the live Evidence dashboard once it is deployed. */}
        {/* TODO: link hosted dbt docs once GitHub Pages is wired up. */}
      </div>
    </Section>
  );
}
