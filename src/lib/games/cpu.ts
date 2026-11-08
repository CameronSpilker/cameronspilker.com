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

/**
 * How well the computer plays. Pro always takes its best move and taps fast;
 * Rookie taps slower and now and then takes a worse move, so it can be beaten.
 */
export type Skill = "rookie" | "pro";
export const CPU_TAP_MS: Record<Skill, number> = { rookie: 320, pro: 200 };
/** How often a Rookie computer takes a random safe move instead of its best one. */
export const ROOKIE_SLIP = 0.08;

const occupied = (state: State, x: number, lane: number) =>
  state.defenders.some((d) => d.x === x && d.lane === lane);

/**
 * Defenders one step away from a square, the ones that could tackle there on
 * their very next move. Defenders walk the screen as it is; only the runner
 * wraps to the next 9 yards.
 */
function threats(state: State, x: number, lane: number): number {
  return state.defenders.filter((d) => Math.abs(d.x - x) + Math.abs(d.lane - lane) === 1).length;
}

/** Open yards straight ahead in a lane from column x, before the first defender, up to a screen's worth. */
function openRun(state: State, x: number, lane: number): number {
  for (let step = 1; step < COLUMNS; step++) {
    if (occupied(state, (x + step) % COLUMNS, lane)) return step - 1;
  }
  return COLUMNS;
}

type Choice = { input: Input | null; score: number };

/**
 * Every move open to the runner right now, scored. The score likes open
 * field ahead, likes gaining a yard, and hates ending next to a defender. A
 * square next to a defender is not always fatal, since only one tackler moves
 * per beat, but it is the most likely way to go down.
 */
function choices(state: State): Choice[] {
  const { x, lane } = state.runner;
  const out: Choice[] = [];
  const fx = (x + 1) % COLUMNS;
  if (!occupied(state, fx, lane)) {
    out.push({ input: "forward", score: 3 + openRun(state, fx, lane) - 8 * threats(state, fx, lane) });
  }
  for (const [input, l] of [["up", lane - 1], ["down", lane + 1]] as const) {
    if (l < 0 || l >= LANES || occupied(state, x, l)) continue;
    out.push({ input, score: openRun(state, x, l) - 8 * threats(state, x, l) });
  }
  // Waiting lets the defence come to you and drift into your lane, which is
  // what opens the far side. Only mid play: before the snap nothing moves.
  if (state.phase === "live") {
    out.push({ input: null, score: 0.5 * openRun(state, x, lane) - 8 * threats(state, x, lane) - 1 });
  }
  return out;
}

/**
 * The next button for the computer's runner, or null to hold still this beat.
 * Only meaningful when the computer's side has the ball and the play is ready
 * or live.
 */
export function cpuMove(state: State, rng: Rng, skill: Skill = "pro"): Input | null {
  if (state.phase !== "ready" && state.phase !== "live") return null;

  if (state.phase === "ready" && state.down === 4) {
    const distance = fieldGoalDistance(state.ballOn);
    const inRange = distance !== null && distance <= CPU_FIELD_GOAL;
    if (inRange || state.toGo > GO_FOR_IT) return "kick";
  }

  const options = choices(state);
  // Boxed in on every side. Mid play it can only wait; before the snap nothing moves until it
  // presses something, so it runs into the line rather than stall the game.
  if (options.length === 0) return state.phase === "ready" ? "forward" : null;

  if (skill === "rookie" && rng() < ROOKIE_SLIP) {
    return options[Math.floor(rng() * options.length) % options.length].input;
  }
  let best = options[0];
  for (const o of options) {
    // A little noise breaks ties, so the computer does not always pick the same side.
    if (o.score + rng() * 0.3 > best.score) best = o;
  }
  return best.input;
}
