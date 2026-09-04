import type { Metadata } from "next";
import Link from "next/link";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { runResultsTool } from "@/content/tools";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Tools · ${site.name}`,
  description: "Small client-side tools for working with dbt artifacts.",
};

/** Only what is built and live gets a card here. */
const tools = [runResultsTool];

export default function ToolsPage() {
  return (
    <>
      <ToolChrome />
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Tools</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-bright sm:text-5xl">
          Things I needed, so I built them
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          Every one of these runs entirely in your browser. Nothing you load is uploaded anywhere,
          which is the only way a tool that reads a work artifact is worth using at work.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="block rounded-xl border border-line bg-raised/40 p-6 transition-colors hover:border-accent"
              >
                <p className="font-mono text-xs text-accent">{tool.name}</p>
                <p className="mt-3 text-lg font-semibold text-bright">{tool.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-body/80">{tool.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
