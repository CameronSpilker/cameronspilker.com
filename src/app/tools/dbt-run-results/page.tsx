import type { Metadata } from "next";
import { RunResultsVisualizer } from "@/components/tools/RunResultsVisualizer";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { runResultsTool as copy } from "@/content/tools";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `${copy.name} · ${site.name}`,
  description: copy.description,
  alternates: { canonical: `/tools/${copy.slug}` },
  openGraph: {
    title: copy.title,
    description: copy.description,
    url: `${site.url}/tools/${copy.slug}`,
    type: "website",
  },
};

export default function RunResultsPage() {
  return (
    <>
      <ToolChrome />
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{copy.name}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-bright sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{copy.lede}</p>

        <div className="mt-12">
          <RunResultsVisualizer />
        </div>

        <section className="mt-16 border-t border-line pt-8">
          <h2 className="text-lg font-semibold text-bright">{copy.howto.title}</h2>
          <ul className="mt-4 max-w-2xl space-y-2">
            {copy.howto.steps.map((step) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span aria-hidden="true" className="font-mono text-accent">
                  ·
                </span>
                {step}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-body/70">{copy.sample.note}</p>
        </section>
      </main>
    </>
  );
}
