import Link from "next/link";
import { gamesIndex, liveGames } from "@/content/games";
import { Section } from "./Section";
import { GameCard } from "./games/GameCard";

/** The homepage's door to `/games`, built the same way as the tools section. */
export function Games() {
  return (
    <Section id="games" label={gamesIndex.label} title={gamesIndex.title} lede={gamesIndex.lede}>
      <ul className="grid gap-5 md:grid-cols-2">
        {liveGames.map((game) => (
          <li key={game.slug}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>

      <Link
        href="/games"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-bright"
      >
        {gamesIndex.all}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </Section>
  );
}
