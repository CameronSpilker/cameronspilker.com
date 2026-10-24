import Link from "next/link";
import type { liveTools } from "@/content/tools";

/**
 * One tool, as a card.
 *
 * Shared by the homepage section and the `/tools` index so the two never drift.
 * The whole card is the link rather than a button inside it: a card that looks
 * clickable and is not is worse than no card.
 */
export function ToolCard({ tool }: { tool: (typeof liveTools)[number] }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="glass group block h-full rounded-[28px] p-6 transition-transform hover:-translate-y-0.5"
    >
      <p className="text-xs font-semibold text-accent">{tool.name}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-bright">{tool.title}</p>
      <p className="mt-2 text-sm leading-relaxed">{tool.description}</p>
      <p className="mt-4 text-sm font-semibold text-accent">
        Open <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
      </p>
    </Link>
  );
}
