import Link from "next/link";
import type { liveGames } from "@/content/games";

/** One game, as a card. Shared by the homepage section and `/games`, like `ToolCard`. */
export function GameCard({ game }: { game: (typeof liveGames)[number] }) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="glass group block h-full rounded-[28px] p-6 transition-transform hover:-translate-y-0.5"
    >
      <p className="text-xs font-semibold text-accent">{game.label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-bright">{game.name}</p>
      <p className="mt-2 text-sm leading-relaxed">{game.description}</p>
      <p className="mt-4 text-sm font-semibold text-accent">
        Play <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
      </p>
    </Link>
  );
}
