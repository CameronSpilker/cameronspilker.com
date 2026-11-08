/**
 * Color Echo's rules, as pure functions.
 *
 * Four pads. Each round the game plays back the whole sequence so far plus one
 * new pad, and the player repeats it. One wrong press ends the game. Reach the
 * goal (10 rounds unless the player picks Endless) and you win.
 *
 * The random source is an argument, so tests can script the sequence. The
 * page owns the timers, the lights and the sound.
 */

export const PADS = 4;
export type Pad = 0 | 1 | 2 | 3;

/** How many rounds win the game. Null plays until the first mistake. */
export type Goal = 10 | 20 | null;
export const GOALS: readonly Goal[] = [10, 20, null];
export const DEFAULT_GOAL: Goal = 10;

export type Phase = "show" | "input" | "won" | "lost";

export type State = {
  /** Every pad in order. Its length is the current round. */
  sequence: Pad[];
  /** How many pads of this round the player has already repeated. */
  input: number;
  phase: Phase;
  goal: Goal;
  /** On a loss: the pad the player should have pressed. */
  expected: Pad | null;
};

/** What a press did: kept going, finished the round, won, lost, or did nothing (wrong phase). */
export type PressResult = "correct" | "round" | "won" | "wrong" | "ignored";

export type Rng = () => number;

/** A random pad. Guards against an rng that returns exactly 1. */
export function pick(rng: Rng): Pad {
  return Math.min(PADS - 1, Math.max(0, Math.floor(rng() * PADS))) as Pad;
}

/** A fresh game, ready to play round 1 back to the player. */
export function newGame(goal: Goal, rng: Rng): State {
  return { sequence: [pick(rng)], input: 0, phase: "show", goal, expected: null };
}

/** The playback is over: the player's turn to repeat it. */
export function startInput(state: State): State {
  if (state.phase !== "show") return state;
  return { ...state, phase: "input", input: 0 };
}

/** The player pressed a pad. */
export function press(state: State, pad: Pad, rng: Rng): { state: State; result: PressResult } {
  if (state.phase !== "input") return { state, result: "ignored" };

  const want = state.sequence[state.input];
  if (pad !== want) return { state: { ...state, phase: "lost", expected: want }, result: "wrong" };

  const input = state.input + 1;
  if (input < state.sequence.length) return { state: { ...state, input }, result: "correct" };

  if (state.goal !== null && state.sequence.length >= state.goal) {
    return { state: { ...state, input, phase: "won" }, result: "won" };
  }
  return {
    state: { ...state, input: 0, phase: "show", sequence: [...state.sequence, pick(rng)] },
    result: "round",
  };
}

/** The round being played, starting at 1. */
export const round = (state: State) => state.sequence.length;

/** Rounds the player has fully repeated. This is the score. */
export function completed(state: State): number {
  if (state.phase === "won") return state.sequence.length;
  return state.sequence.length - 1;
}

/**
 * How long each pad stays lit during playback, and the dark gap after it.
 * The game speeds up at rounds 5, 9 and 13.
 */
export function tempo(roundNumber: number): { onMs: number; offMs: number } {
  if (roundNumber >= 13) return { onMs: 280, offMs: 120 };
  if (roundNumber >= 9) return { onMs: 360, offMs: 150 };
  if (roundNumber >= 5) return { onMs: 460, offMs: 190 };
  return { onMs: 580, offMs: 240 };
}
