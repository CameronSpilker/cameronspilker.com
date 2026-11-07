/**
 * The computer as an opponent: it runs the ball for its side the way a
 * reasonable person would, one button at a time. It only decides what to
 * press; the page decides when, so the computer moves at a human pace.
 *
 * The defence is the game's own on every play, so playing the computer means
 * it takes the other side's offence, nothing more.
 */
import { COLUMNS, LANES, fieldGoalDistance, type Input, type Rng, type State } from "./football.ts";

/** On fourth down, the computer kicks unless it needs this many yards or fewer. */
export const GO_FOR_IT = 2;
/** It tries a field goal only from this close: past it, it would rather punt. */
export const CPU_FIELD_GOAL = 45;

const occupied = (state: State, x: number, lane: number) =>
  state.defenders.some((d) => d.x === x && d.lane === lane);

/** The column in front, which past the end of the screen is the start of the next one. */
const ahead = (x: number, steps: number) => (x + steps) % COLUMNS;

/** How crowded a lane is over the next few yards: nearer defenders count for more. */
function crowding(state: State, lane: number): number {
  let score = 0;
  for (let step = 1; step <= 4; step++) {
    if (occupied(state, ahead(state.runner.x, step), lane)) score += 5 - step;
  }
  return score;
}

/**
 * The next button for the computer's runner, or null to hold still this beat.
 * Only meaningful when the computer's side has the ball and the play is ready
 * or live.
 */
export function cpuMove(state: State, rng: Rng): Input | null {
  if (state.phase !== "ready" && state.phase !== "live") return null;

  if (state.phase === "ready" && state.down === 4) {
    const distance = fieldGoalDistance(state.ballOn);
    const inRange = distance !== null && distance <= CPU_FIELD_GOAL;
    if (inRange || state.toGo > GO_FOR_IT) return "kick";
  }

  const { x, lane } = state.runner;
  const blocked = occupied(state, ahead(x, 1), lane);
  const crowded = crowding(state, lane);

  // Clear ahead and not walking into a crowd: run.
  if (!blocked && crowded < 4) return "forward";

  // Otherwise look for a quieter lane next door that is open to step into.
  const options = [lane - 1, lane + 1]
    .filter((l) => l >= 0 && l < LANES && !occupied(state, x, l))
    .map((l) => ({ l, score: crowding(state, l) }))
    .filter((o) => o.score < crowded || blocked)
    .sort((a, b) => a.score - b.score || rng() - 0.5);

  if (options.length > 0) return options[0].l < lane ? "up" : "down";
  // Hemmed in: push forward if there is room. Mid play it can wait for a gap,
  // but before the snap nothing moves until it presses something.
  if (!blocked) return "forward";
  if (state.phase === "live") return null;
  return lane > 0 ? "up" : "down";
}
