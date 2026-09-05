import Link from "next/link";
import { liveTools, toolsIndex } from "@/content/tools";
import { Section } from "./Section";
import { ToolCard } from "./tools/ToolCard";

/**
 * The homepage's door to `/tools`.
 *
 * The tools shipped before this section did, which meant they were reachable
 * only by typing the URL: the nav had no entry for them, no project panel was
 * one, and the only link to `/tools` in the codebase lived on the tool pages
 * themselves. A page nothing points at may as well not be deployed.
 *
 * It renders the same card as the index rather than a summary of it, so the
 * homepage promises exactly what the next page delivers.
 */
export function Tools() {
  return (
    <Section id="tools" label={toolsIndex.label} title={toolsIndex.title} lede={toolsIndex.lede}>
      <p className="max-w-2xl text-base leading-relaxed">{toolsIndex.home.lede}</p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {liveTools.map((tool) => (
          <li key={tool.slug}>
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>

      {/* Kept even while one card is the whole list: the index carries the
          privacy claim in full, and it is where the next tool lands. */}
      <Link
        href="/tools"
        className="mt-8 inline-flex items-center gap-2 font-mono text-sm text-accent transition-colors hover:text-bright"
      >
        {toolsIndex.home.all}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </Section>
  );
}
