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
      className="block rounded-xl border border-line bg-raised/40 p-6 transition-colors hover:border-accent"
    >
      <p className="font-mono text-xs text-accent">{tool.name}</p>
      <p className="mt-3 text-lg font-semibold text-bright">{tool.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-body/80">{tool.description}</p>
    </Link>
  );
}
