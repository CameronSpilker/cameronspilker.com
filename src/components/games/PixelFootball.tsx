"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { pixelFootball as copy } from "@/content/games";
import { createBeeper } from "@/lib/games/beeper";
import {
  COLUMNS,
  LANES,
  QUARTER_MS,
  RUNNER_COLUMN,
  advance,
  clockReading,
  fieldPosition,
  newGame,
  press,
  visible,
  yardsToGo,
  type Difficulty,
  type GameEvent,
  type Input,
  type State,
  type Step,
  type Team,
} from "@/lib/games/football";
import { SevenSegment } from "./SevenSegment";

const BESTS_KEY = "pixel-football-bests";
const SOUND_KEY = "pixel-football-sound";
const LEVEL_KEY = "pixel-football-level";
/** How long the score stays up after someone presses Score. */
const SCORE_SHOW_MS = 2_500;
/** A frame longer than this (a background tab, a debugger) counts as this long. */
const MAX_FRAME_MS = 100;

type Bests = { longestRun: number; mostPoints: number };

const rng = Math.random;

function readBests(): Bests {
  try {
    const raw = JSON.parse(localStorage.getItem(BESTS_KEY) ?? "null") as Partial<Bests> | null;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return { longestRun: n(raw?.longestRun), mostPoints: n(raw?.mostPoints) };
  } catch {
    return { longestRun: 0, mostPoints: 0 };
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows and full storage: the game still plays, it just forgets.
  }
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The line under the field: what just happened, or what is next. */
function describe(state: State, paused: boolean): string {
  const m = copy.messages;
  const team = copy.teams[state.offense];
  if (state.phase === "final") return m.final(state.score.home, state.score.away);
  if (paused) return m.paused;

  if (state.phase === "result" && state.outcome) {
    const o = state.outcome;
    let line: string;
    switch (o.kind) {
      case "tackle":
        line = o.firstDown ? m.firstDown(o.gain) : m.tackle(o.gain);
        break;
      case "return":
        line = m.returned(o.gain);
        break;
      case "turnover":
        line = m.turnover(o.gain);
        break;
      case "touchdown":
        line = m.touchdown(o.gain);
        break;
      case "safety":
        line = m.safety;
        break;
      case "fieldGoal":
        line = m.fieldGoal(o.distance);
        break;
      case "missedKick":
        line = m.missedKick(o.distance);
        break;
      case "touchback":
        line = m.touchback(o.kick, o.distance);
        break;
    }
    return state.quarterOver ? `${line} ${m.endQuarter(state.quarter)}` : line;
  }

  if (state.phase === "kickoff") {
    // The clock only runs during live plays, so a full first quarter at 0 to 0 means the opening kick.
    const opening = state.quarter === 1 && state.clockMs === QUARTER_MS && state.score.home + state.score.away === 0;
    return opening ? m.start : m.kickoff(team);
  }
  if (state.returning) return m.returnReady(team, state.returning.kind, state.returning.yards, state.ballOn);

  const situation = m.ready(team, state.down, state.toGo, 100 - state.ballOn);
  return state.phase === "ready" && state.down === 4 ? `${situation} ${m.fourth}` : situation;
}

export function PixelFootball() {
  const [game, setGame] = useState<State>(() => newGame("rookie"));
  const [paused, setPaused] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [sound, setSound] = useState(true);
  const [bests, setBests] = useState<Bests>({ longestRun: 0, mostPoints: 0 });
  const [announcement, setAnnouncement] = useState("");

  const gameRef = useRef(game);
  const pausedRef = useRef(paused);
  const soundRef = useRef(sound);
  const beeper = useRef<ReturnType<typeof createBeeper> | null>(null);
  const scoreTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Preferences and bests live in this browser only.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading storage after hydration */
    setBests(readBests());
    if (load(SOUND_KEY) === "off") setSound(false);
    const level = load(LEVEL_KEY);
    if (level === "pro") {
      const next = { ...gameRef.current, difficulty: "pro" as const };
      gameRef.current = next;
      setGame(next);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const play = useCallback((events: GameEvent[]) => {
    if (!soundRef.current || events.length === 0) return;
    beeper.current ??= createBeeper();
    // The biggest moment wins when a step brings several: a tackle that is also a first down.
    const order: GameEvent[] = [
      "final",
      "touchdown",
      "fieldGoal",
      "safety",
      "turnover",
      "quarter",
      "firstDown",
      "tackle",
      "returnReady",
      "kick",
      "step",
    ];
    const loudest = order.find((e) => events.includes(e));
    if (loudest) beeper.current.play(loudest);
  }, []);

  const commit = useCallback(
    (step: Step) => {
      const before = gameRef.current;
      const next = step.state;
      if (next === before) return;
      gameRef.current = next;
      setGame(next);
      play(step.events);

      const ended = next.phase === "result" && before.phase !== "result";
      const over = next.phase === "final" && before.phase !== "final";
      if (ended || over) {
        setAnnouncement(describe(next, false));
        setBests((old) => {
          const updated = {
            longestRun: Math.max(old.longestRun, next.longestRun),
            mostPoints: Math.max(old.mostPoints, next.score.home, next.score.away),
          };
          if (updated.longestRun !== old.longestRun || updated.mostPoints !== old.mostPoints) {
            save(BESTS_KEY, JSON.stringify(updated));
            return updated;
          }
          return old;
        });
      }
      // The display swaps to the score whenever the score changes.
      const scored = next.score.home !== before.score.home || next.score.away !== before.score.away;
      if (scored || over) setShowScore(true);
      if (next.phase === "ready" && before.phase !== "ready") setShowScore(false);
    },
    [play],
  );

  const send = useCallback(
    (input: Input) => {
      if (pausedRef.current) return;
      const current = gameRef.current;
      if (current.phase === "final") {
        if (input === "forward") commit({ state: newGame(current.difficulty), events: [] });
        return;
      }
      commit(press(current, input, rng));
    },
    [commit],
  );

  const restart = useCallback(() => {
    setPaused(false);
    setShowScore(false);
    commit({ state: newGame(gameRef.current.difficulty), events: [] });
  }, [commit]);

  const togglePause = useCallback(() => {
    if (gameRef.current.phase === "final") return;
    setPaused((p) => !p);
  }, []);

  const flashScore = useCallback(() => {
    setShowScore(true);
    window.clearTimeout(scoreTimer.current);
    scoreTimer.current = window.setTimeout(() => setShowScore(false), SCORE_SHOW_MS);
  }, []);

  const showStatus = useCallback(() => {
    window.clearTimeout(scoreTimer.current);
    setShowScore(false);
  }, []);

  const setLevel = useCallback(
    (difficulty: Difficulty) => {
      save(LEVEL_KEY, difficulty);
      commit({ state: { ...gameRef.current, difficulty }, events: [] });
    },
    [commit],
  );

  const toggleSound = useCallback(() => {
    setSound((on) => {
      save(SOUND_KEY, on ? "off" : "on");
      return !on;
    });
  }, []);

  // The clock and the defence: one advance per animation frame.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const ms = Math.min(MAX_FRAME_MS, now - last);
      last = now;
      if (!pausedRef.current) commit(advance(gameRef.current, ms, rng));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [commit]);

  // Leaving the tab pauses a game that is under way.
  useEffect(() => {
    const onHide = () => {
      const phase = gameRef.current.phase;
      if (document.hidden && (phase === "live" || phase === "result")) setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      // Space and Enter on a focused button belong to that button.
      const onButton = tag === "BUTTON" || tag === "A";

      const key = event.key;
      const runsRight = gameRef.current.board === "home";
      let input: Input | null = null;
      if (key === "ArrowUp" || key === "w" || key === "W") input = "up";
      else if (key === "ArrowDown" || key === "s" || key === "S") input = "down";
      else if (key === "ArrowRight" || key === "d" || key === "D") input = runsRight ? "forward" : "back";
      else if (key === "ArrowLeft" || key === "a" || key === "A") input = runsRight ? "back" : "forward";
      else if ((key === " " || key === "Enter") && !onButton) input = "forward";
      else if (key === "k" || key === "K") input = "kick";
      else if (key === "p" || key === "P" || key === "Escape") {
        event.preventDefault();
        if (!event.repeat) togglePause();
        return;
      }

      if (input === null) return;
      event.preventDefault();
      // One press, one step. Holding a key down is not a sprint.
      if (event.repeat) return;
      send(input);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, togglePause]);

  useEffect(() => {
    const timer = scoreTimer;
    return () => {
      window.clearTimeout(timer.current);
      beeper.current?.close();
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <Handheld
        game={game}
        paused={paused}
        showScore={showScore}
        sound={sound}
        onInput={send}
        onScore={flashScore}
        onStatus={showStatus}
        onLevel={setLevel}
        onSound={toggleSound}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={restart}
          className="rounded-full bg-bright px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          {copy.buttons.newGame}
        </button>
        <button
          type="button"
          onClick={togglePause}
          disabled={game.phase === "final"}
          className="glass rounded-full px-5 py-2.5 text-sm font-semibold text-bright transition-opacity disabled:opacity-40"
        >
          {paused ? copy.buttons.resume : copy.buttons.pause}
        </button>
      </div>

      <Scoreboard game={game} bests={bests} />
    </div>
  );
}

function Handheld({
  game,
  paused,
  showScore,
  sound,
  onInput,
  onScore,
  onStatus,
  onLevel,
  onSound,
}: {
  game: State;
  paused: boolean;
  showScore: boolean;
  sound: boolean;
  onInput: (input: Input) => void;
  onScore: () => void;
  onStatus: () => void;
  onLevel: (d: Difficulty) => void;
  onSound: () => void;
}) {
  const runsRight = game.board === "home";
  const scoreMode = showScore || game.phase === "final";
  const message = describe(game, paused);
  const canKick = !paused && (game.phase === "kickoff" || (game.phase === "ready" && game.down === 4 && !game.returning));

  return (
    <div className="mx-auto w-full max-w-[680px] select-none" style={{ touchAction: "manipulation" }}>
      <div
        className="rounded-[34px] border-b-[6px] p-3 sm:rounded-[44px] sm:p-5"
        style={{
          background: "linear-gradient(180deg, var(--pf-case), color-mix(in srgb, var(--pf-case) 88%, black))",
          borderColor: "var(--pf-case-edge)",
          boxShadow: "0 30px 60px var(--pf-shadow), inset 0 2px 0 rgba(255,255,255,0.6)",
          color: "var(--pf-print)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-2 pb-2 sm:pb-3">
          <p className="font-mono text-[11px] leading-none font-bold tracking-[0.3em] sm:text-sm">
            {copy.brand} <span className="font-normal">{copy.model}</span>
          </p>
          <div className="flex items-center gap-2">
            <Switch
              label={copy.level.label}
              options={[
                { value: "rookie", label: copy.level.rookie },
                { value: "pro", label: copy.level.pro },
              ]}
              value={game.difficulty}
              onChange={(v) => onLevel(v as Difficulty)}
            />
            <button
              type="button"
              onClick={onSound}
              aria-pressed={sound}
              className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]"
              style={{ borderColor: "var(--pf-case-edge)", background: sound ? "var(--pf-print)" : "transparent", color: sound ? "var(--pf-case)" : "var(--pf-print)" }}
            >
              {copy.buttons.sound}
            </button>
          </div>
        </div>

        {/* The bezel: readout on top, the field under it. */}
        <div className="rounded-[22px] p-2.5 sm:rounded-[28px] sm:p-4" style={{ background: "var(--pf-bezel)" }}>
          <Readout game={game} scoreMode={scoreMode} />

          <div
            className="relative mt-2 overflow-hidden rounded-xl p-1.5 sm:mt-3 sm:p-2.5"
            style={{ background: "var(--pf-glass)", boxShadow: "inset 0 0 18px rgba(255,61,46,0.08)" }}
          >
            <Field game={game} paused={paused} />
          </div>

          <div className="mt-2 flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-white/45 sm:text-[10px]">
            <Lamp on={game.board === "home"} label={`${copy.labels.home} ▶`} />
            <div className="flex items-center gap-2">
              <span>{copy.labels.quarter}</span>
              {[1, 2, 3, 4].map((q) => (
                <span
                  key={q}
                  className={`h-1.5 w-1.5 rounded-full ${game.quarter === q ? "pf-glow" : ""}`}
                  style={{ background: game.quarter === q ? "var(--pf-led)" : "var(--pf-led-off)" }}
                />
              ))}
            </div>
            <Lamp on={game.board === "away"} label={`◀ ${copy.labels.away}`} reverse />
          </div>
        </div>

        <p className="mt-3 min-h-[2.5em] px-2 text-center font-mono text-[11px] leading-snug sm:text-xs">{message}</p>

        {/* Controls. Pointer down rather than click, so a tap moves the instant it lands. */}
        <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1 sm:mt-3 sm:gap-5 sm:px-3">
          <div className="flex flex-col gap-2">
            <PadKey label={copy.buttons.up} onPress={() => onInput("up")}>
              <Arrow dir="up" />
            </PadKey>
            <PadKey label={copy.buttons.down} onPress={() => onInput("down")}>
              <Arrow dir="down" />
            </PadKey>
          </div>

          {/* On a phone the small keys drop to their own row under the pad. */}
          <div className="order-last col-span-3 flex items-center justify-center gap-3 sm:order-none sm:col-span-1">
            <SmallKey label={copy.buttons.status} onPress={onStatus} />
            <SmallKey label={copy.buttons.score} onPress={onScore} />
            <SmallKey label={copy.buttons.kick} onPress={() => onInput("kick")} go disabled={!canKick} />
          </div>

          <div className={`flex items-center gap-2 sm:gap-3 ${runsRight ? "" : "flex-row-reverse"}`}>
            <PadKey label={copy.buttons.back} onPress={() => onInput("back")}>
              <Arrow dir={runsRight ? "left" : "right"} />
            </PadKey>
            <PadKey label={copy.buttons.forward} onPress={() => onInput("forward")} big go>
              <Arrow dir={runsRight ? "right" : "left"} />
            </PadKey>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ game, scoreMode }: { game: State; scoreMode: boolean }) {
  const l = copy.labels;
  // No downs on a kickoff or a return: those readouts go dark, the way a dash would.
  const noDowns = game.phase === "kickoff" || (game.returning !== null && game.phase !== "result");
  const spot = fieldPosition(game);

  const cells: { label: string; value: string; width: number; side?: Team | null }[] = scoreMode
    ? [
        { label: l.home, value: String(game.score.home % 100), width: 2 },
        { label: l.time, value: clockReading(game), width: 3 },
        { label: l.away, value: String(game.score.away % 100), width: 2 },
      ]
    : [
        { label: l.down, value: noDowns ? "-" : String(game.down), width: 1 },
        { label: l.field, value: String(spot.yard), width: 2, side: spot.side },
        { label: l.toGo, value: noDowns ? "-" : String(yardsToGo(game)), width: 2 },
      ];

  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden="true">
      {cells.map((g) => (
        <div key={g.label} className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] tracking-[0.25em] text-white/45 sm:text-[10px]">{g.label}</span>
          <span className="flex h-7 items-center gap-1 rounded-md px-1.5 py-1 sm:h-10 sm:px-2" style={{ background: "var(--pf-glass)" }}>
            {g.side !== undefined && <SideLamp on={g.side === "home"} dir="left" />}
            <SevenSegment value={g.value} width={g.width} />
            {g.side !== undefined && <SideLamp on={g.side === "away"} dir="right" />}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The marker beside the yard line: lit on the side of midfield the ball is on. */
function SideLamp({ on, dir }: { on: boolean; dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 6 10" className={`h-2/5 w-auto ${on ? "pf-glow" : ""}`} aria-hidden="true">
      <path
        d={dir === "left" ? "M6 0 L0 5 L6 10 Z" : "M0 0 L6 5 L0 10 Z"}
        fill={on ? "var(--pf-led)" : "var(--pf-led-off)"}
        opacity={on ? 1 : 0.6}
      />
    </svg>
  );
}

function Field({ game, paused }: { game: State; paused: boolean }) {
  const { runner, defenders, tackler } = visible(game);
  const mirrored = game.board === "away";
  const holding = game.phase === "result" && !paused;
  const o = game.outcome;
  const allBlink = holding && (o?.kind === "touchdown" || o?.kind === "fieldGoal");

  const cells: ReactNode[] = [];
  for (let lane = 0; lane < LANES; lane++) {
    for (let screen = 0; screen < COLUMNS; screen++) {
      const c = mirrored ? COLUMNS - 1 - screen : screen;
      const yard = game.lineAt + game.runner.x + (c - RUNNER_COLUMN);
      const isRunner = runner.x === c && runner.lane === lane;
      const isDefender = defenders.some((d) => d.x === c && d.lane === lane);
      const isTackler = holding && tackler !== null && tackler.x === c && tackler.lane === lane;
      const endZone = yard > 100;
      // A yard line sits on the edge of the cell nearest the offence's own goal.
      const marked = yard === 100 || (yard % 10 === 0 && yard > 0 && yard < 100);
      const edge = mirrored ? "borderRight" : "borderLeft";

      cells.push(
        <div
          key={`${lane}-${screen}`}
          className="flex aspect-[1.35] items-center justify-center"
          style={{
            [edge]: `1px solid ${yard === 100 ? "var(--pf-goal)" : marked ? "var(--pf-line)" : "transparent"}`,
            background: endZone ? "rgba(255,61,46,0.05)" : undefined,
          }}
        >
          <span
            className={`block w-[62%] rounded-[3px] ${isRunner ? "pf-glow h-[30%]" : "h-[26%]"} ${
              isTackler || (allBlink && (isRunner || isDefender)) ? "pf-blink" : ""
            }`}
            style={{
              // The runner is a hot dot with a pale core; defenders are the same LED at a fraction of the current.
              background: isRunner
                ? "linear-gradient(180deg, var(--pf-led) 0%, var(--pf-led-hot) 50%, var(--pf-led) 100%)"
                : isDefender
                  ? "var(--pf-led-dim)"
                  : "var(--pf-led-off)",
            }}
          />
        </div>,
      );
    }
  }

  return (
    <div
      role="img"
      aria-label={describe(game, paused)}
      className="grid"
      style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  );
}

function Lamp({ on, label, reverse }: { on: boolean; label: string; reverse?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${reverse ? "flex-row-reverse" : ""}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${on ? "pf-glow" : ""}`}
        style={{ background: on ? "var(--pf-led)" : "var(--pf-led-off)" }}
      />
      <span style={{ color: on ? "rgba(255,255,255,0.75)" : undefined }}>{label}</span>
    </span>
  );
}

function usePress(onPress: () => void) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      onPress();
    },
  };
}

/**
 * The pad keys stay out of the tab order: the keyboard already has every one of
 * them, and a focused pad key would turn Space into two presses.
 */
function PadKey({
  label,
  onPress,
  children,
  big,
  go,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  big?: boolean;
  go?: boolean;
}) {
  const handlers = usePress(onPress);
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      {...handlers}
      className={`flex items-center justify-center rounded-full text-white transition-transform active:translate-y-0.5 active:scale-95 ${
        big ? "h-20 w-20 sm:h-24 sm:w-24" : "h-12 w-12 sm:h-14 sm:w-14"
      }`}
      style={{
        background: `radial-gradient(circle at 35% 30%, ${go ? "var(--pf-go-top)" : "var(--pf-key-top)"}, ${go ? "var(--pf-go)" : "var(--pf-key)"})`,
        boxShadow: "0 4px 0 rgba(0,0,0,0.35), 0 8px 14px rgba(0,0,0,0.2)",
      }}
    >
      {children}
    </button>
  );
}

function SmallKey({ label, onPress, go, disabled }: { label: string; onPress: () => void; go?: boolean; disabled?: boolean }) {
  const handlers = usePress(onPress);
  return (
    <span className="flex flex-col items-center gap-1">
      <button
        type="button"
        tabIndex={-1}
        aria-label={label}
        aria-disabled={disabled}
        {...handlers}
        className={`h-7 w-12 rounded-full transition-transform active:translate-y-0.5 sm:h-8 sm:w-14 ${disabled ? "opacity-50" : ""}`}
        style={{
          background: go ? "var(--pf-go)" : "var(--pf-key)",
          boxShadow: "0 3px 0 rgba(0,0,0,0.35)",
        }}
      />
      <span className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase sm:text-[10px]">{label}</span>
    </span>
  );
}

function Switch({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border p-0.5" style={{ borderColor: "var(--pf-case-edge)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]"
          style={{
            background: value === o.value ? "var(--pf-print)" : "transparent",
            color: value === o.value ? "var(--pf-case)" : "var(--pf-print)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Arrow({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const rotate = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M12 5 L20 16 H4 Z" fill="currentColor" />
    </svg>
  );
}

function Scoreboard({ game, bests }: { game: State; bests: Bests }) {
  const s = copy.scoreboard;
  const team = (t: Team) => (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm">
        {copy.teams[t]}
        {game.phase !== "final" && game.offense === t && <span className="ml-2 text-xs text-accent">{"●"}</span>}
      </dt>
      <dd className="font-mono text-2xl font-bold text-bright">{game.score[t]}</dd>
    </div>
  );

  return (
    <section className="mx-auto grid w-full max-w-[680px] gap-4 sm:grid-cols-2">
      <div className="glass rounded-[24px] p-5">
        <h2 className="text-xs font-semibold text-accent">{s.title}</h2>
        <dl className="mt-3 space-y-1">
          {team("home")}
          {team("away")}
        </dl>
        <p className="mt-3 font-mono text-xs">
          {s.quarter(game.quarter)} · {clockReading(game)}
        </p>
      </div>
      <div className="glass rounded-[24px] p-5">
        <h2 className="text-xs font-semibold text-accent">{s.best}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>{s.longestRun}</dt>
            <dd className="font-mono text-bright">{bests.longestRun ? s.yards(bests.longestRun) : s.none}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{s.mostPoints}</dt>
            <dd className="font-mono text-bright">{bests.mostPoints || s.none}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
