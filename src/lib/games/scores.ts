/**
 * High scores for games against the computer, kept in the player's own
 * browser. Nothing is sent anywhere: this is one person's top ten, on one
 * device. A shared leaderboard would need storage on a server, and that is a
 * separate decision.
 *
 * Ranked by the player's points, then by the winning margin, then by who got
 * there first: an older score keeps its place against a later equal one.
 */
import type { Difficulty } from "./football.ts";

export type HighScore = {
  /** The player's points. */
  you: number;
  /** The computer's points. */
  cpu: number;
  level: Difficulty;
  /** The day the game ended, as YYYY-MM-DD. */
  date: string;
};

export const MAX_SCORES = 10;

/** True when a is ranked above b. */
function above(a: HighScore, b: HighScore): boolean {
  if (a.you !== b.you) return a.you > b.you;
  const ma = a.you - a.cpu;
  const mb = b.you - b.cpu;
  if (ma !== mb) return ma > mb;
  return a.date < b.date;
}

/**
 * Add a finished game to the list. Returns the new list, best first and at
 * most MAX_SCORES long, and the new game's place in it (1 is the top), or null
 * when it did not make the list. A scoreless game never does.
 */
export function addScore(list: HighScore[], entry: HighScore): { list: HighScore[]; rank: number | null } {
  // A game where you never scored is not a high score, whatever else is on the list.
  if (entry.you === 0) return { list, rank: null };
  let at = list.length;
  for (let i = 0; i < list.length; i++) {
    if (above(entry, list[i])) {
      at = i;
      break;
    }
  }
  if (at >= MAX_SCORES) return { list, rank: null };
  const next = [...list.slice(0, at), entry, ...list.slice(at)].slice(0, MAX_SCORES);
  return { list: next, rank: at + 1 };
}

const isPoints = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1000;

/** Read a saved list back, dropping anything that is not a well formed score. Never throws. */
export function parseScores(raw: unknown): HighScore[] {
  if (!Array.isArray(raw)) return [];
  const out: HighScore[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { you, cpu, level, date } = item as Record<string, unknown>;
    if (!isPoints(you) || !isPoints(cpu)) continue;
    if (level !== "rookie" && level !== "pro") continue;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ you, cpu, level, date });
  }
  // Re-rank on the way in, so a hand edited list still comes out in order.
  return out.reduce<HighScore[]>((list, s) => addScore(list, s).list, []);
}

/** Today as YYYY-MM-DD in the player's own time zone. */
export function today(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
