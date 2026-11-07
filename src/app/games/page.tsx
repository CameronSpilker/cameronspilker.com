import type { Metadata } from "next";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { GameCard } from "@/components/games/GameCard";
import { gamesIndex, liveGames } from "@/content/games";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Games · ${site.name}`,
  description: gamesIndex.metaDescription,
};

export default function GamesPage() {
  return (
    <>
      <ToolChrome section={{ href: "/games", label: "games" }} />
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{gamesIndex.label}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-bright sm:text-5xl">
          {gamesIndex.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{gamesIndex.lede}</p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {liveGames.map((game) => (
            <li key={game.slug}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
