/**
 * Pixel Football: the rules, with no React and no timers of their own.
 *
 * The page owns the clock and the keyboard. It calls `press` when a button goes
 * down and `advance` once a frame with the time that passed, and draws whatever
 * state comes back. Both take the random source as an argument, so a test can
 * play a whole drive with scripted dice.
 *
 * The rules follow the 1977 LED handheld football games: a 9 yard screen, a
 * runner who only goes forward or across, five defenders, kicks only on fourth
 * down, and a Status press to set up every play. Name, look and sound are our own.
 *
 * Coordinates are screen columns from the offence's own end, 0 to 8. The runner
 * starts each play in column 0. Running off the far end starts the next 9 yards
 * from column 0 with the defence where it stood, and `screenAt` counts the
 * yards on the screens already crossed. Which way the screen faces is the
 * page's business: home runs right, away runs left.
 */

export type Team = "home" | "away";
export type Difficulty = "rookie" | "pro";
/** Status and Score both set up the next play; the page also uses them to pick a readout. */
export type Input = "up" | "down" | "forward" | "kick" | "status" | "score";

/**
 * - ready: lined up, nothing moves until the first arrow.
 * - live: the play is on, the defence closes and the clock runs.
 * - result: the play is over and the board holds still until Status or Score.
 * - final: the fourth quarter is over.
 */
export type Phase = "ready" | "live" | "result" | "final";

export type Spot = { x: number; lane: number };

export type Outcome =
  | { kind: "tackle"; gain: number; firstDown: boolean }
  | { kind: "turnover"; gain: number }
  | { kind: "touchdown"; gain: number }
  | { kind: "fieldGoal"; distance: number }
  | { kind: "punt"; distance: number; touchback: boolean };

/** Things the page might want to play a sound for. */
export type GameEvent =
  | "snap"
  | "step"
  | "tackle"
  | "turnover"
  | "firstDown"
  | "touchdown"
  | "fieldGoal"
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
  /** The runner's screen column and lane. */
  runner: Spot;
  /** Yards on the screens the runner has already run off the end of, this play. */
  screenAt: number;
  defenders: Spot[];
  /** Who made the tackle on the play in `result`, so the board can blink them. */
  tackler: Spot | null;
  outcome: Outcome | null;
  /** Set when the clock ran out during the play now in `result`. */
  quarterOver: boolean;
  /** Time since the defence last moved. */
  sinceStep: number;
  longestRun: number;
};

export type Step = { state: State; events: GameEvent[] };

export const LANES = 3;
/** The screen is 9 yards long. */
export const COLUMNS = 9;
export const DEFENDERS = 5;

/** Live play per quarter in real time: 2 and a half minutes, shown as 15 football minutes. */
export const QUARTER_MS = 150_000;
export const QUARTER_MINUTES = 15;

export const TOUCHDOWN_POINTS = 7;
export const FIELD_GOAL_POINTS = 3;
/** Kicked from 7 yards behind the line, through posts 10 yards deep in the end zone. */
export const KICK_ADDS = 17;
export const LONGEST_FIELD_GOAL = 52;
export const LONGEST_KICK = 65;
export const RESTART_AT = 20;

/**
 * How the two levels differ. The defence moves one tackler at a time, on a
 * beat: you never know which one will step next, but you can see each step
 * happen. Pro reacts 50% faster: its beat is two thirds as long.
 */
export const PACE: Record<Difficulty, { beatMs: number }> = {
  rookie: { beatMs: 450 },
  pro: { beatMs: 300 },
};

/** How many yards off the line sets up at the snap: Rookie gives one more yard to work with. */
export const LINE_OFF: Record<Difficulty, number> = { rookie: 4, pro: 3 };

/**
 * How often a defender who is not yet in the runner's lane moves across
 * rather than forward. Drifting toward the runner is what lets the manual's
 * trick work: pull the defence to one side and the other side opens up.
 */
export const LANE_PULL = 0.75;

export type Rng = () => number;

const other = (team: Team): Team => (team === "home" ? "away" : "home");

/** Yards to the line to gain, which near the goal is the goal itself. */
const toGoFrom = (ballOn: number) => Math.min(10, 100 - ballOn);

/** How far a field goal from here would be, or null when it is out of range. */
export function fieldGoalDistance(ballOn: number): number | null {
  const distance = 100 - ballOn + KICK_ADDS;
  return distance <= LONGEST_FIELD_GOAL ? distance : null;
}

/** The chance the kicker goes for it and makes it: near certain up close, a long shot at the limit. */
export function fieldGoalChance(distance: number): number {
  if (distance <= 27) return 0.97;
  if (distance > LONGEST_FIELD_GOAL) return 0;
  const t = (distance - 27) / (LONGEST_FIELD_GOAL - 27);
  return 0.97 - t * (0.97 - 0.35);
}

/**
 * The defence at the snap: the line of three, a linebacker behind it and a
 * safety deep. Which lane the linebacker and the safety take is left to
 * chance, so no two snaps look quite alike.
 */
export function formation(rng: Rng, difficulty: Difficulty = "pro"): Spot[] {
  const off = LINE_OFF[difficulty];
  const line = [0, 1, 2].map((lane) => ({ x: off, lane }));
  const backer = { x: 5, lane: Math.floor(rng() * LANES) % LANES };
  const safety = { x: 8, lane: Math.floor(rng() * LANES) % LANES };
  return [...line, backer, safety];
}

/** Yards gained on the play so far. */
export const gained = (state: State) => state.screenAt + state.runner.x;

function lineUp(state: State, rng: Rng): State {
  return {
    ...state,
    phase: "ready",
    board: state.offense,
    lineAt: state.ballOn,
    runner: { x: 0, lane: 1 },
    screenAt: 0,
    defenders: formation(rng, state.difficulty),
    tackler: null,
    outcome: null,
    quarterOver: false,
    sinceStep: 0,
  };
}

/** Home has the ball, first and ten on its own 20. */
export function newGame(difficulty: Difficulty, rng: Rng): State {
  return lineUp(
    {
      phase: "ready",
      difficulty,
      offense: "home",
      board: "home",
      ballOn: RESTART_AT,
      lineAt: RESTART_AT,
      down: 1,
      toGo: 10,
      score: { home: 0, away: 0 },
      quarter: 1,
      clockMs: QUARTER_MS,
      runner: { x: 0, lane: 1 },
      screenAt: 0,
      defenders: [],
      tackler: null,
      outcome: null,
      quarterOver: false,
      sinceStep: 0,
      longestRun: 0,
    },
    rng,
  );
}

/** Give the ball to the other side at `ballOn`, first and ten. */
function changeOver(state: State, ballOn: number): State {
  return { ...state, offense: other(state.offense), ballOn, down: 1, toGo: toGoFrom(ballOn) };
}

/**
 * Freeze the board on the play that just ended, until Status or Score. Callers
 * set `board` to the side that ran the play before the ball changes hands, so
 * the board keeps facing the way that play went. If that play used up the last
 * of the fourth quarter, the game is over then and there.
 */
function hold(state: State, outcome: Outcome, events: GameEvent[]): Step {
  const quarterOver = state.clockMs <= 0;
  if (quarterOver && state.quarter === 4) {
    return { state: { ...state, phase: "final", outcome, quarterOver: false }, events: [...events, "final"] };
  }
  return {
    state: { ...state, phase: "result", outcome, quarterOver },
    events: quarterOver ? [...events, "quarter"] : events,
  };
}

/** The runner went down. Work out the next snap. */
function tackled(state: State, tackler: Spot): Step {
  const gain = gained(state);
  const spot = state.ballOn + gain;
  const base: State = { ...state, longestRun: Math.max(state.longestRun, gain), board: state.offense, tackler };

  if (gain >= state.toGo) {
    const next = { ...base, ballOn: spot, down: 1 as const, toGo: toGoFrom(spot) };
    return hold(next, { kind: "tackle", gain, firstDown: true }, ["tackle", "firstDown"]);
  }
  if (state.down === 4) {
    return hold(changeOver(base, 100 - spot), { kind: "turnover", gain }, ["turnover"]);
  }
  const next = { ...base, ballOn: spot, down: (state.down + 1) as State["down"], toGo: state.toGo - gain };
  return hold(next, { kind: "tackle", gain, firstDown: false }, ["tackle"]);
}

/** Seven points, and the other side starts on its own 20. */
function touchdown(state: State): Step {
  const gain = gained(state);
  const score = { ...state.score, [state.offense]: state.score[state.offense] + TOUCHDOWN_POINTS };
  const base = { ...state, score, longestRun: Math.max(state.longestRun, gain), board: state.offense };
  return hold(changeOver(base, RESTART_AT), { kind: "touchdown", gain }, ["touchdown"]);
}

/**
 * Fourth down only. The kicker decides: in range, a field goal, more likely
 * the closer it is. Otherwise a punt of 1 to 65 yards. A punt into the end
 * zone comes out to the 20. A failed field goal try is not a separate result:
 * the kicker just ends up punting.
 */
function kick(state: State, rng: Rng): Step {
  const base = { ...state, board: state.offense };
  const distance = fieldGoalDistance(state.ballOn);

  if (distance !== null && rng() < fieldGoalChance(distance)) {
    const score = { ...state.score, [state.offense]: state.score[state.offense] + FIELD_GOAL_POINTS };
    return hold(changeOver({ ...base, score }, RESTART_AT), { kind: "fieldGoal", distance }, ["fieldGoal"]);
  }

  // Two rolls averaged: anything from 1 to 65 yards, but mostly mid length, so a shank is rare.
  const roll = () => 1 + (Math.floor(rng() * LONGEST_KICK) % LONGEST_KICK);
  const yards = Math.round((roll() + roll()) / 2);
  const lands = state.ballOn + yards;
  const touchback = lands >= 100;
  const next = changeOver(base, touchback ? RESTART_AT : 100 - lands);
  return hold(next, { kind: "punt", distance: yards, touchback }, ["turnover"]);
}

/** After a play: the next snap, the next quarter, or the second half. */
function setUp(state: State, rng: Rng): Step {
  if (!state.quarterOver) return { state: lineUp(state, rng), events: [] };

  const quarter = (state.quarter + 1) as State["quarter"];
  let next: State = { ...state, quarter, clockMs: QUARTER_MS };
  // The second half starts with the away side, first and ten on its own 20.
  if (quarter === 3) next = { ...next, offense: "away", ballOn: RESTART_AT, down: 1, toGo: 10 };
  return { state: lineUp(next, rng), events: [] };
}

/** A button went down. Anything that does not apply right now is ignored. */
export function press(state: State, input: Input, rng: Rng): Step {
  if (state.phase === "final") return { state, events: [] };

  if (input === "status" || input === "score") {
    return state.phase === "result" ? setUp(state, rng) : { state, events: [] };
  }
  if (state.phase === "result") return { state, events: [] };

  if (input === "kick") {
    if (state.phase !== "ready" || state.down !== 4) return { state, events: [] };
    return kick(state, rng);
  }

  const { runner } = state;
  let to: Spot;
  let screenAt = state.screenAt;
  if (input === "up") {
    if (runner.lane === 0) return { state, events: [] };
    to = { ...runner, lane: runner.lane - 1 };
  } else if (input === "down") {
    if (runner.lane === LANES - 1) return { state, events: [] };
    to = { ...runner, lane: runner.lane + 1 };
  } else if (runner.x === COLUMNS - 1) {
    // Off the far end: the next 9 yards, from column 0, with the defence where it stands.
    to = { ...runner, x: 0 };
    screenAt += COLUMNS;
  } else {
    to = { ...runner, x: runner.x + 1 };
  }

  const events: GameEvent[] = state.phase === "ready" ? ["snap"] : [];
  const live: State = { ...state, phase: "live" };

  // Running into a defender is a tackle where you stand.
  const hit = live.defenders.find((d) => d.x === to.x && d.lane === to.lane);
  if (hit) {
    const step = tackled(live, hit);
    return { state: step.state, events: [...events, ...step.events] };
  }

  const moved: State = { ...live, runner: to, screenAt };
  if (moved.ballOn + gained(moved) >= 100) {
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

  if (dy !== 0 && (Math.abs(dx) <= 1 || rng() < LANE_PULL)) return towardLane;
  if (dx > 0) return { x: d.x - 1, lane: d.lane };
  if (dx < 0) return { x: d.x + 1, lane: d.lane };
  return towardLane;
}

/**
 * Move the defence one beat: one tackler, picked at random, takes one step
 * toward the runner. If it is boxed in by its own side, the next one tries.
 * If it reaches the runner, the play ends there.
 */
export function defend(state: State, rng: Rng): Step {
  const defenders = state.defenders.map((d) => ({ ...d }));
  const first = Math.floor(rng() * defenders.length) % Math.max(1, defenders.length);

  for (let k = 0; k < defenders.length; k++) {
    const i = (first + k) % defenders.length;
    const to = chase(defenders[i], state.runner, rng);
    if (to.x === state.runner.x && to.lane === state.runner.lane) {
      // The tackler stays a step off the runner so both stay visible on the board.
      return tackled({ ...state, defenders }, defenders[i]);
    }
    const blocked = defenders.some((o, j) => j !== i && o.x === to.x && o.lane === to.lane);
    if (blocked) continue;
    defenders[i] = to;
    break;
  }
  return { state: { ...state, defenders }, events: [] };
}

/** Let `ms` of real time pass. Only a live play has anything to do with time. */
export function advance(state: State, ms: number, rng: Rng): Step {
  if (state.phase !== "live") return { state, events: [] };

  // The clock can reach zero mid play; the play still finishes.
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

/** Where the ball is right now, in yards from the offence's own goal line. */
function spotNow(state: State): number {
  return state.phase === "live" ? state.ballOn + gained(state) : state.ballOn;
}

/**
 * The yard line the ball is on, 0 to 50, and which half it is in. Home defends
 * the left goal, so the home half is the left one; `side` is null at midfield.
 */
export function fieldPosition(state: State): { yard: number; side: Team | null } {
  const spot = spotNow(state);
  const fromHome = state.offense === "home" ? spot : 100 - spot;
  const yard = Math.max(0, Math.min(50, fromHome <= 50 ? fromHome : 100 - fromHome));
  const side = fromHome < 50 ? "home" : fromHome > 50 ? "away" : null;
  return { yard, side };
}

/**
 * Yards still to gain for a first down, counting the run in progress. Null
 * inside 10 yards of the goal, where the readout goes blank.
 */
export function yardsToGo(state: State): number | null {
  if (100 - spotNow(state) < 10) return null;
  if (state.phase === "live") return Math.max(0, state.toGo - gained(state));
  return state.toGo;
}

/** The game clock in football minutes with one decimal, the way the readout shows it: 15.0 down to 0.0. */
export function clockReading(state: State): string {
  const tenths = Math.ceil((state.clockMs / QUARTER_MS) * QUARTER_MINUTES * 10);
  return (tenths / 10).toFixed(1);
}

/** The yard line under each screen column, counted from the offence's own goal. */
export function columnYards(state: State): number[] {
  const start = state.lineAt + state.screenAt;
  return Array.from({ length: COLUMNS }, (_, c) => start + c);
}
