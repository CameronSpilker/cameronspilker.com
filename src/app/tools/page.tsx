import type { Metadata } from "next";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { ToolCard } from "@/components/tools/ToolCard";
import { liveTools, toolsIndex } from "@/content/tools";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Tools · ${site.name}`,
  description: toolsIndex.metaDescription,
};

export default function ToolsPage() {
  return (
    <>
      <ToolChrome />
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
          {toolsIndex.label}
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-bright sm:text-5xl">
          {toolsIndex.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{toolsIndex.lede}</p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {liveTools.map((tool) => (
            <li key={tool.slug}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
