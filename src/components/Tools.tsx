import Link from "next/link";
import { toolsIntro } from "@/content/home";
import { liveTools, toolsIndex } from "@/content/tools";
import { Section } from "./Section";
import { ToolCard } from "./tools/ToolCard";

/**
 * The homepage's door to `/tools`. It renders the same card as the index, so
 * the homepage promises exactly what the next page delivers.
 */
export function Tools() {
  return (
    <Section id="tools" label={toolsIndex.label} title={toolsIndex.title} lede={toolsIndex.lede}>
      <ul className="grid gap-5 md:grid-cols-2">
        {liveTools.map((tool) => (
          <li key={tool.slug}>
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>

      <Link
        href="/tools"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-bright"
      >
        {toolsIntro.all}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </Section>
  );
}
