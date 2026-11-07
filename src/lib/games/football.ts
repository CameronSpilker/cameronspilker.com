/**
 * Pixel Football: the rules, with no React and no timers of their own.
 *
 * The page owns the clock and the keyboard. It calls `press` when a button goes
 * down and `advance` once a frame with the time that passed, and draws whatever
 * state comes back. Both take the random source as an argument, so a test can
 * play a whole drive with scripted dice.
 *
 * Coordinates are offence relative. The runner starts each play at x = 0 in the
 * middle lane and gains a yard for every step forward. Defenders sit at x > 0.
 * Which way that is on screen is the page's business: the home side runs right
 * and the away side runs left.
 */

export type Team = "home" | "away";
export type Difficulty = "rookie" | "pro";
export type Input = "up" | "down" | "forward" | "kick";

/**
 * - ready: lined up, nothing moves until the first press.
 * - live: the play is on, the defence closes and the clock runs.
 * - result: the play is over and the board holds still so it can be read.
 * - final: the fourth quarter is over.
 */
export type Phase = "ready" | "live" | "result" | "final";

export type Spot = { x: number; lane: number };

export type Outcome =
  | { kind: "tackle"; gain: number; firstDown: boolean }
  | { kind: "turnover"; gain: number }
  | { kind: "touchdown"; gain: number }
  | { kind: "fieldGoal"; distance: number }
  | { kind: "missedKick"; distance: number }
  | { kind: "punt"; distance: number; touchback: boolean };

/** Things the page might want to play a sound for. */
export type GameEvent =
  | "snap"
  | "step"
  | "tackle"
  | "firstDown"
  | "touchdown"
  | "fieldGoal"
  | "miss"
  | "punt"
  | "quarter"
  | "final";

export type State = {
  phase: Phase;
  difficulty: Difficulty;
  /** Who has the ball for the next snap. */
  offense: Team;
  /** The team whose play the board is showing. Differs from `offense` only in `result`. */
  board: Team;
  /** Yards from the offence's own goal line, 1 to 99. */
  ballOn: number;
  /** Where the play on the board was snapped from. Unlike `ballOn`, it holds still through `result`. */
  lineAt: number;
  down: 1 | 2 | 3 | 4;
  toGo: number;
  score: Record<Team, number>;
  quarter: 1 | 2 | 3 | 4;
  /** Game clock left in the quarter, in milliseconds. It only runs while a play is live. */
  clockMs: number;
  runner: Spot;
  defenders: Spot[];
  outcome: Outcome | null;
  /** Time left on the pause after a play. */
  holdMs: number;
  /** Set when the clock ran out during the play now in `result`. */
  quarterOver: boolean;
  /** Time since the defence last moved. */
  sinceStep: number;
  /** Who got the ball first, so the other side gets it after halftime. */
  openedWith: Team;
  longestRun: number;
};

export type Step = { state: State; events: GameEvent[] };

export const LANES = 3;
/** Columns on screen. The runner sits in the second one and the field scrolls past. */
export const COLUMNS = 9;
export const RUNNER_COLUMN = 1;
export const DEFENDERS = 5;

export const QUARTER_MS = 45_000;
export const HOLD_MS = 1_400;
/** A longer hold when the quarter or the game ends, so the banner can be read. */
export const QUARTER_HOLD_MS = 2_400;

export const TOUCHDOWN_POINTS = 7;
export const FIELD_GOAL_POINTS = 3;
/** Kicked from 7 yards behind the line, through posts 10 yards deep in the end zone. */
export const KICK_ADDS = 17;
export const LONGEST_FIELD_GOAL = 52;
export const RESTART_AT = 20;

/**
 * How the two levels differ. The defence moves on a beat; on each beat every
 * defender moves with this chance. Pro is a faster beat and a keener defence.
 */
export const PACE: Record<Difficulty, { beatMs: number; chance: number }> = {
  rookie: { beatMs: 520, chance: 0.55 },
  pro: { beatMs: 340, chance: 0.7 },
};

/**
 * Where the defence lines up, runner at (0, 1). Nobody starts in the column
 * right in front of the runner, so the first step is never a tackle.
 */
export const FORMATIONS: readonly (readonly [number, number][])[] = [
  [[2, 0], [2, 2], [4, 1], [6, 0], [6, 2]],
  [[3, 1], [2, 0], [5, 2], [6, 0], [8, 1]],
  [[2, 2], [3, 0], [5, 1], [7, 2], [8, 0]],
  [[2, 1], [4, 0], [4, 2], [6, 1], [8, 0]],
];

export type Rng = () => number;

const other = (team: Team): Team => (team === "home" ? "away" : "home");

/** Yards to the line to gain, which near the goal is the goal itself. */
const toGoFrom = (ballOn: number) => Math.min(10, 100 - ballOn);

/** How far a field goal from here would be, or null when it is out of range. */
export function fieldGoalDistance(ballOn: number): number | null {
  const distance = 100 - ballOn + KICK_ADDS;
  return distance <= LONGEST_FIELD_GOAL ? distance : null;
}

/** The chance a kick from this distance is good: near certain up close, a long shot at the limit. */
export function fieldGoalChance(distance: number): number {
  if (distance <= 27) return 0.97;
  if (distance > LONGEST_FIELD_GOAL) return 0;
  const t = (distance - 27) / (LONGEST_FIELD_GOAL - 27);
  return 0.97 - t * (0.97 - 0.35);
}

export function formation(rng: Rng): Spot[] {
  const pick = FORMATIONS[Math.floor(rng() * FORMATIONS.length) % FORMATIONS.length];
  const flip = rng() < 0.5;
  return pick.map(([x, lane]) => ({ x, lane: flip ? LANES - 1 - lane : lane }));
}

function lineUp(state: State, rng: Rng): State {
  return {
    ...state,
    phase: "ready",
    board: state.offense,
    lineAt: state.ballOn,
    runner: { x: 0, lane: 1 },
    defenders: formation(rng),
    outcome: null,
    holdMs: 0,
    quarterOver: false,
    sinceStep: 0,
  };
}

export function newGame(difficulty: Difficulty, rng: Rng, openedWith: Team = "home"): State {
  return lineUp(
    {
      phase: "ready",
      difficulty,
      offense: openedWith,
      board: openedWith,
      ballOn: RESTART_AT,
      lineAt: RESTART_AT,
      down: 1,
      toGo: 10,
      score: { home: 0, away: 0 },
      quarter: 1,
      clockMs: QUARTER_MS,
      runner: { x: 0, lane: 1 },
      defenders: [],
      outcome: null,
      holdMs: 0,
      quarterOver: false,
      sinceStep: 0,
      openedWith,
      longestRun: 0,
    },
    rng,
  );
}

const occupied = (spots: Spot[], x: number, lane: number) => spots.some((s) => s.x === x && s.lane === lane);

/** Give the ball to the other side at `ballOn`, first and ten. */
function changeOver(state: State, ballOn: number): State {
  return { ...state, offense: other(state.offense), ballOn, down: 1, toGo: toGoFrom(ballOn) };
}

/**
 * Freeze the board on the play that just ended. Callers set `board` to the side
 * that ran the play before the ball changes hands, so the board keeps facing
 * the way that play went.
 */
function hold(state: State, outcome: Outcome): State {
  const quarterOver = state.clockMs <= 0;
  return {
    ...state,
    phase: "result",
    outcome,
    holdMs: quarterOver ? QUARTER_HOLD_MS : HOLD_MS,
    quarterOver,
  };
}

/** The runner went down at their current spot. Work out the next snap. */
function tackled(state: State): Step {
  const gain = state.runner.x;
  const spot = state.ballOn + gain;
  const longestRun = Math.max(state.longestRun, gain);
  const base = { ...state, longestRun, board: state.offense };

  if (gain >= state.toGo) {
    const next = { ...base, ballOn: spot, down: 1 as const, toGo: toGoFrom(spot) };
    return { state: hold(next, { kind: "tackle", gain, firstDown: true }), events: ["tackle", "firstDown"] };
  }
  if (state.down === 4) {
    const next = changeOver(base, 100 - spot);
    return { state: hold(next, { kind: "turnover", gain }), events: ["tackle"] };
  }
  const next = { ...base, ballOn: spot, down: (state.down + 1) as State["down"], toGo: state.toGo - gain };
  return { state: hold(next, { kind: "tackle", gain, firstDown: false }), events: ["tackle"] };
}

function touchdown(state: State): Step {
  const gain = state.runner.x;
  const score = { ...state.score, [state.offense]: state.score[state.offense] + TOUCHDOWN_POINTS };
  const next = changeOver({ ...state, score, longestRun: Math.max(state.longestRun, gain), board: state.offense }, RESTART_AT);
  return { state: hold(next, { kind: "touchdown", gain }), events: ["touchdown"] };
}

function kick(state: State, rng: Rng): Step {
  const base = { ...state, board: state.offense };
  const distance = fieldGoalDistance(state.ballOn);

  if (distance !== null) {
    if (rng() < fieldGoalChance(distance)) {
      const score = { ...state.score, [state.offense]: state.score[state.offense] + FIELD_GOAL_POINTS };
      const next = changeOver({ ...base, score }, RESTART_AT);
      return { state: hold(next, { kind: "fieldGoal", distance }), events: ["fieldGoal"] };
    }
    // A miss gives the ball back from where it was kicked, or the 20 if that is closer to goal.
    const next = changeOver(base, Math.max(RESTART_AT, 100 - state.ballOn));
    return { state: hold(next, { kind: "missedKick", distance }), events: ["miss"] };
  }

  const yards = 30 + Math.floor(rng() * 21);
  const lands = state.ballOn + yards;
  const touchback = lands >= 100;
  const next = changeOver(base, touchback ? RESTART_AT : 100 - lands);
  return { state: hold(next, { kind: "punt", distance: yards, touchback }), events: ["punt"] };
}

/**
 * Defenders the runner has left behind, off the back of the screen, come back
 * in at the far edge in an open lane. Without this a runner past the first wave
 * walks into the end zone; with it there is always a secondary to beat.
 */
export function regroup(defenders: Spot[], runner: Spot, rng: Rng): Spot[] {
  const back = runner.x - RUNNER_COLUMN;
  const edge = runner.x + COLUMNS - 1 - RUNNER_COLUMN;
  const out = defenders.map((d) => ({ ...d }));
  for (let i = 0; i < out.length; i++) {
    if (out[i].x >= back) continue;
    const open = [0, 1, 2].filter((lane) => !out.some((o, j) => j !== i && o.x === edge && o.lane === lane));
    if (open.length === 0) continue;
    out[i] = { x: edge, lane: open[Math.floor(rng() * open.length) % open.length] };
  }
  return out;
}

/** Where the runner ends up after a move, or null if the move goes off the field. */
function moveRunner(runner: Spot, input: Input): Spot | null {
  if (input === "up") return runner.lane > 0 ? { ...runner, lane: runner.lane - 1 } : null;
  if (input === "down") return runner.lane < LANES - 1 ? { ...runner, lane: runner.lane + 1 } : null;
  if (input === "forward") return { ...runner, x: runner.x + 1 };
  return null;
}

/** A button went down. Anything that does not apply right now is ignored. */
export function press(state: State, input: Input, rng: Rng): Step {
  if (state.phase === "result" || state.phase === "final") return { state, events: [] };

  if (input === "kick") {
    if (state.phase !== "ready" || state.down !== 4) return { state, events: [] };
    return kick(state, rng);
  }

  const to = moveRunner(state.runner, input);
  if (!to) return { state, events: [] };

  const events: GameEvent[] = state.phase === "ready" ? ["snap"] : [];
  const live: State = { ...state, phase: "live" };

  // Running into a defender is a tackle where you stand.
  if (occupied(live.defenders, to.x, to.lane)) {
    const step = tackled(live);
    return { state: step.state, events: [...events, ...step.events] };
  }

  const moved = { ...live, runner: to, defenders: regroup(live.defenders, to, rng) };
  if (moved.ballOn + to.x >= 100) {
    const step = touchdown(moved);
    return { state: step.state, events: [...events, ...step.events] };
  }
  return { state: moved, events: [...events, "step"] };
}

/**
 * One defender's idea of a good step: close the lane gap once level or nearly
 * level with the runner, otherwise close the distance, with the odd lane change
 * on the way so the defence does not move as a block.
 */
function chase(d: Spot, runner: Spot, rng: Rng): Spot {
  const dx = d.x - runner.x;
  const dy = runner.lane - d.lane;
  const towardLane = { x: d.x, lane: d.lane + Math.sign(dy) };

  if (dy !== 0 && (Math.abs(dx) <= 1 || rng() < 0.25)) return towardLane;
  if (dx > 0) return { x: d.x - 1, lane: d.lane };
  if (dx < 0) return { x: d.x + 1, lane: d.lane };
  return towardLane;
}

/** Move the defence one beat. If someone reaches the runner, the play ends there. */
export function defend(state: State, rng: Rng): Step {
  const { chance } = PACE[state.difficulty];
  const defenders = state.defenders.map((d) => ({ ...d }));

  for (let i = 0; i < defenders.length; i++) {
    if (rng() >= chance) continue;
    const to = chase(defenders[i], state.runner, rng);
    if (to.x === state.runner.x && to.lane === state.runner.lane) {
      defenders[i] = to;
      return tackled({ ...state, defenders });
    }
    const blocked = defenders.some((o, j) => j !== i && o.x === to.x && o.lane === to.lane);
    if (!blocked) defenders[i] = to;
  }
  return { state: { ...state, defenders }, events: [] };
}

/** After the hold: line up again, or roll the quarter over, or end the game. */
function afterHold(state: State, rng: Rng): Step {
  if (!state.quarterOver) return { state: lineUp(state, rng), events: [] };

  if (state.quarter === 4) {
    return { state: { ...state, phase: "final", holdMs: 0, quarterOver: false }, events: ["final"] };
  }

  const quarter = (state.quarter + 1) as State["quarter"];
  let next: State = { ...state, quarter, clockMs: QUARTER_MS };
  if (quarter === 3) {
    // The second half opens with the side that did not get the ball first.
    const receiving = other(state.openedWith);
    next = { ...next, offense: receiving, ballOn: RESTART_AT, down: 1, toGo: 10 };
  }
  return { state: lineUp(next, rng), events: ["quarter"] };
}

/** Let `ms` of real time pass. */
export function advance(state: State, ms: number, rng: Rng): Step {
  if (state.phase === "ready" || state.phase === "final") return { state, events: [] };

  if (state.phase === "result") {
    const holdMs = state.holdMs - ms;
    if (holdMs > 0) return { state: { ...state, holdMs }, events: [] };
    return afterHold(state, rng);
  }

  // Live. The clock can reach zero mid play; the play still finishes.
  let current: State = { ...state, clockMs: Math.max(0, state.clockMs - ms), sinceStep: state.sinceStep + ms };
  const { beatMs } = PACE[current.difficulty];
  const events: GameEvent[] = [];
  while (current.phase === "live" && current.sinceStep >= beatMs) {
    const step = defend({ ...current, sinceStep: current.sinceStep - beatMs }, rng);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

/** The winner, or null for a tie. */
export function winner(state: State): Team | null {
  if (state.score.home === state.score.away) return null;
  return state.score.home > state.score.away ? "home" : "away";
}

/** Yards to the goal line from where the runner is now. */
export function yardsToGoal(state: State): number {
  if (state.phase === "result") return 100 - state.ballOn;
  return 100 - state.ballOn - state.runner.x;
}

/** Yards still to gain for a first down, counting the run in progress. */
export function yardsToGo(state: State): number {
  if (state.phase === "live") return Math.max(0, state.toGo - state.runner.x);
  return state.toGo;
}

/** Which defenders are on screen, as screen columns 0 to COLUMNS - 1. */
export function visible(state: State): { runner: Spot; defenders: Spot[] } {
  const shift = RUNNER_COLUMN - state.runner.x;
  const defenders = state.defenders
    .map((d) => ({ x: d.x + shift, lane: d.lane }))
    .filter((d) => d.x >= 0 && d.x < COLUMNS);
  return { runner: { x: RUNNER_COLUMN, lane: state.runner.lane }, defenders };
}
