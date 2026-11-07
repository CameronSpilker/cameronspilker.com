"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { pixelFootball as copy } from "@/content/games";
import { createBeeper } from "@/lib/games/beeper";
import {
  COLUMNS,
  LANES,
  QUARTER_MS,
  advance,
  clockReading,
  columnYards,
  fieldPosition,
  newGame,
  press,
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

/** Phones get their own layout, built for two thumbs. The server renders the wide one, and a phone swaps after load. */
const PHONE_QUERY = "(max-width: 639px)";

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

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
      case "turnover":
        line = m.turnover(o.gain);
        break;
      case "touchdown":
        line = m.touchdown(o.gain);
        break;
      case "fieldGoal":
        line = m.fieldGoal(o.distance);
        break;
      case "punt":
        line = m.punt(o.distance, o.touchback);
        break;
    }
    const end = state.quarterOver ? ` ${m.endQuarter(state.quarter)}` : "";
    return `${line}${end} ${m.setUp}`;
  }

  // The clock only runs during live plays, so a full first quarter means nobody has snapped yet.
  if (state.phase === "ready" && state.quarter === 1 && state.clockMs === QUARTER_MS) return m.start;
  const toGoal = 100 - state.ballOn;
  const situation = m.ready(team, state.down, state.toGo, toGoal);
  return state.phase === "ready" && state.down === 4 ? `${situation} ${m.fourth}` : situation;
}

export function PixelFootball() {
  const [game, setGame] = useState<State>(() => newGame("rookie", rng));
  const [paused, setPaused] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [sound, setSound] = useState(true);
  const [bests, setBests] = useState<Bests>({ longestRun: 0, mostPoints: 0 });
  const [announcement, setAnnouncement] = useState("");
  const [full, setFull] = useState(false);
  const phone = useMediaQuery(PHONE_QUERY);
  const fullscreen = phone && full;

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
      "turnover",
      "quarter",
      "firstDown",
      "tackle",
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
      // The display swaps to the score whenever the score changes, and back to status at the snap.
      const scored = next.score.home !== before.score.home || next.score.away !== before.score.away;
      if (scored || over) setShowScore(true);
      if (next.phase === "live" && before.phase !== "live") setShowScore(false);
    },
    [play],
  );

  const send = useCallback(
    (input: Input) => {
      if (pausedRef.current) return;
      const current = gameRef.current;
      if (current.phase === "final") {
        if (input === "forward") commit({ state: newGame(current.difficulty, rng), events: [] });
        return;
      }
      commit(press(current, input, rng));
    },
    [commit],
  );

  const restart = useCallback(() => {
    setPaused(false);
    setShowScore(false);
    commit({ state: newGame(gameRef.current.difficulty, rng), events: [] });
  }, [commit]);

  const togglePause = useCallback(() => {
    if (gameRef.current.phase === "final") return;
    setPaused((p) => !p);
  }, []);

  /** Score shows the score for a moment, and like Status it sets up the next play. */
  const pressScore = useCallback(() => {
    if (pausedRef.current) return;
    setShowScore(true);
    window.clearTimeout(scoreTimer.current);
    scoreTimer.current = window.setTimeout(() => setShowScore(false), SCORE_SHOW_MS);
    send("score");
  }, [send]);

  const pressStatus = useCallback(() => {
    if (pausedRef.current) return;
    window.clearTimeout(scoreTimer.current);
    setShowScore(false);
    send("status");
  }, [send]);

  /** Changing level mid game ends the game, the way it did on the old handhelds. */
  const setLevel = useCallback(
    (difficulty: Difficulty) => {
      if (difficulty === gameRef.current.difficulty) return;
      save(LEVEL_KEY, difficulty);
      setPaused(false);
      setShowScore(false);
      commit({ state: newGame(difficulty, rng), events: [] });
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

  // While the phone layout fills the screen, the page underneath must not scroll or bounce.
  useEffect(() => {
    if (!fullscreen) return;
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = before.overflow;
      html.style.overscrollBehavior = before.overscroll;
    };
  }, [fullscreen]);

  const closeFull = useCallback(() => {
    const phase = gameRef.current.phase;
    if (phase === "live" || phase === "result") setPaused(true);
    setFull(false);
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
      // Like the old one key "run" button, either sideways arrow runs toward the goal.
      let action: (() => void) | null = null;
      if (key === "ArrowUp" || key === "w" || key === "W") action = () => send("up");
      else if (key === "ArrowDown" || key === "s" || key === "S") action = () => send("down");
      else if (["ArrowRight", "ArrowLeft", "d", "D", "a", "A"].includes(key)) action = () => send("forward");
      else if ((key === " " || key === "Enter") && !onButton) action = pressStatus;
      else if (key === "c" || key === "C") action = pressScore;
      else if (key === "k" || key === "K") action = () => send("kick");
      else if (key === "p" || key === "P" || key === "Escape") action = togglePause;

      if (action === null) return;
      event.preventDefault();
      // One press, one step. Holding a key down is not a sprint.
      if (event.repeat) return;
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, togglePause, pressStatus, pressScore]);

  useEffect(() => {
    const timer = scoreTimer;
    return () => {
      window.clearTimeout(timer.current);
      beeper.current?.close();
    };
  }, []);

  const handheld: HandheldProps = {
    game,
    paused,
    showScore,
    sound,
    onInput: send,
    onScore: pressScore,
    onStatus: pressStatus,
    onLevel: setLevel,
    onSound: toggleSound,
  };

  return (
    <div className="flex flex-col gap-8">
      {phone ? (
        <>
          {fullscreen && <PhoneHandheld {...handheld} onClose={closeFull} />}
          <PhonePreview game={game} paused={paused} onPlay={() => setFull(true)} />
        </>
      ) : (
        <Handheld {...handheld} />
      )}

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

/** Everything the two layouts of the handheld share. */
type HandheldProps = {
  game: State;
  paused: boolean;
  showScore: boolean;
  sound: boolean;
  onInput: (input: Input) => void;
  onScore: () => void;
  onStatus: () => void;
  onLevel: (d: Difficulty) => void;
  onSound: () => void;
};

const caseStyle = {
  background: "linear-gradient(180deg, var(--pf-case), color-mix(in srgb, var(--pf-case) 88%, black))",
  borderColor: "var(--pf-case-edge)",
  color: "var(--pf-print)",
};

function TopBar({ game, sound, onLevel, onSound, children }: HandheldProps & { children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pb-2 sm:pb-3">
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
          style={{
            borderColor: "var(--pf-case-edge)",
            background: sound ? "var(--pf-print)" : "transparent",
            color: sound ? "var(--pf-case)" : "var(--pf-print)",
          }}
        >
          {copy.buttons.sound}
        </button>
        {children}
      </div>
    </div>
  );
}

function Lamps({ game }: { game: State }) {
  return (
    <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-white/45 sm:text-[10px]">
      <Lamp on={game.board === "home"} label={copy.labels.home} />
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
      <Lamp on={game.board === "away"} label={copy.labels.away} reverse />
    </div>
  );
}

/** The wide handheld, for a laptop or a tablet: the field runs left to right. */
function Handheld(props: HandheldProps) {
  const { game, paused, showScore, onInput, onScore, onStatus } = props;
  const runsRight = game.board === "home";
  const canKick = !paused && game.phase === "ready" && game.down === 4;

  return (
    <div className="mx-auto w-full max-w-[680px] select-none" style={{ touchAction: "manipulation" }}>
      <div
        className="rounded-[44px] border-b-[6px] p-5"
        style={{ ...caseStyle, boxShadow: "0 30px 60px var(--pf-shadow), inset 0 2px 0 rgba(255,255,255,0.6)" }}
      >
        <TopBar {...props} />

        {/* The bezel: readout on top, the field under it. */}
        <div className="rounded-[28px] p-4" style={{ background: "var(--pf-bezel)" }}>
          <Readout game={game} scoreMode={showScore || game.phase === "final"} />
          <div className="mt-3 overflow-hidden rounded-xl p-2.5" style={{ background: "var(--pf-glass)" }}>
            <Field game={game} paused={paused} />
          </div>
          <div className="mt-2">
            <Lamps game={game} />
          </div>
        </div>

        <p className="mt-3 min-h-[2.5em] px-2 text-center font-mono text-xs leading-snug">{describe(game, paused)}</p>

        {/* Controls. Pointer down rather than click, so a press moves the instant it lands. */}
        <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-5 px-3">
          <div className="flex flex-col gap-2">
            <PadKey label={copy.buttons.up} onPress={() => onInput("up")}>
              <Arrow dir="up" />
            </PadKey>
            <PadKey label={copy.buttons.down} onPress={() => onInput("down")}>
              <Arrow dir="down" />
            </PadKey>
          </div>
          <div className="flex items-center justify-center gap-3">
            <SmallKey label={copy.buttons.status} onPress={onStatus} />
            <SmallKey label={copy.buttons.score} onPress={onScore} />
            <SmallKey label={copy.buttons.kick} onPress={() => onInput("kick")} go disabled={!canKick} />
          </div>
          <PadKey label={copy.buttons.forward} onPress={() => onInput("forward")} big go>
            <Arrow dir={runsRight ? "right" : "left"} />
          </PadKey>
        </div>
      </div>
    </div>
  );
}

/**
 * The phone handheld, for a phone held upright in both hands the way you text.
 * The field still runs left to right; what changes is where the buttons are.
 * They sit in the bottom of the screen where thumbs rest: lanes under the left
 * thumb, Run under the right, and Status, Score and Kick just above. It fills
 * the screen, so the page cannot scroll out from under a press.
 */
function PhoneHandheld(props: HandheldProps & { onClose: () => void }) {
  const { game, paused, showScore, onInput, onScore, onStatus, onClose } = props;
  const canKick = !paused && game.phase === "ready" && game.down === 4;
  const runsRight = game.board === "home";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col select-none"
      style={{
        ...caseStyle,
        touchAction: "none",
        overscrollBehavior: "none",
        paddingTop: "max(10px, env(safe-area-inset-top))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="px-3">
        <TopBar {...props}>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.buttons.close}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none"
            style={{ background: "var(--pf-print)", color: "var(--pf-case)" }}
          >
            &times;
          </button>
        </TopBar>
      </div>

      <div className="mx-2 flex flex-col gap-2 rounded-[22px] px-2 py-3" style={{ background: "var(--pf-bezel)" }}>
        <Readout game={game} scoreMode={showScore || game.phase === "final"} />
        <div className="overflow-hidden rounded-xl p-1" style={{ background: "var(--pf-glass)" }}>
          <Field game={game} paused={paused} big />
        </div>
        <div className="px-1">
          <Lamps game={game} />
        </div>
      </div>

      <p className="mx-4 mt-3 min-h-[2.6em] text-center font-mono text-xs leading-snug">{describe(game, paused)}</p>

      {/* Everything above is for the eyes; everything from here down is for the thumbs. */}
      <div className="flex-1" />

      <div className="flex items-center justify-center gap-5 pb-4">
        <SmallKey label={copy.buttons.status} onPress={onStatus} />
        <SmallKey label={copy.buttons.score} onPress={onScore} />
        <SmallKey label={copy.buttons.kick} onPress={() => onInput("kick")} go disabled={!canKick} />
      </div>

      <div className="flex items-end justify-between px-5">
        <div className="flex flex-col gap-3">
          <PadKey label={copy.buttons.up} onPress={() => onInput("up")} large>
            <Arrow dir="up" />
          </PadKey>
          <PadKey label={copy.buttons.down} onPress={() => onInput("down")} large>
            <Arrow dir="down" />
          </PadKey>
        </div>
        <PadKey label={copy.buttons.forward} onPress={() => onInput("forward")} big go>
          <Arrow dir={runsRight ? "right" : "left"} />
        </PadKey>
      </div>
    </div>
  );
}

/** On a phone, the page shows the field and one big button that opens the game full screen. */
function PhonePreview({ game, paused, onPlay }: { game: State; paused: boolean; onPlay: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-[32px] border-b-[6px] p-3" style={{ ...caseStyle, boxShadow: "0 24px 48px var(--pf-shadow)" }}>
        <div className="rounded-[22px] px-2 py-3" style={{ background: "var(--pf-bezel)" }}>
          <Readout game={game} scoreMode={game.phase === "final"} />
          <div className="mt-2 overflow-hidden rounded-xl p-1" style={{ background: "var(--pf-glass)" }}>
            <Field game={game} paused={paused} big />
          </div>
        </div>
        <button
          type="button"
          onClick={onPlay}
          className="mt-3 w-full rounded-full py-4 font-mono text-sm font-bold tracking-[0.25em] text-white uppercase"
          style={{ background: "var(--pf-go)", boxShadow: "0 4px 0 rgba(0,0,0,0.3)" }}
        >
          {game.phase === "ready" && game.quarter === 1 && game.score.home + game.score.away === 0
            ? copy.buttons.play
            : copy.buttons.resumeFull}
        </button>
      </div>
      <p className="mt-3 text-center text-xs">{copy.phoneNote}</p>
    </div>
  );
}

function Readout({ game, scoreMode }: { game: State; scoreMode: boolean }) {
  const l = copy.labels;
  const spot = fieldPosition(game);
  // Inside the 10 the yards to go box goes dark: it is goal to go.
  const toGo = yardsToGo(game);

  const cells: { label: string; value: string; width: number; side?: Team | null }[] = scoreMode
    ? [
        { label: l.home, value: String(game.score.home % 100), width: 2 },
        { label: l.time, value: clockReading(game), width: 3 },
        { label: l.away, value: String(game.score.away % 100), width: 2 },
      ]
    : [
        { label: l.down, value: String(game.down), width: 1 },
        { label: l.field, value: String(spot.yard), width: 2, side: spot.side },
        { label: l.toGo, value: toGo === null ? "" : String(toGo), width: 2 },
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

/**
 * The field: 9 columns by 3 lanes, running toward the goal of the side with
 * the ball. `big` squares the cells up for a narrow phone screen, so the dots
 * stay large.
 */
function Field({ game, paused, big = false }: { game: State; paused: boolean; big?: boolean }) {
  const { runner, defenders, tackler } = game;
  const yards = columnYards(game);
  const away = game.board === "away";
  const holding = game.phase === "result" && !paused;
  const o = game.outcome;
  const allBlink = holding && (o?.kind === "touchdown" || o?.kind === "fieldGoal");

  const cells: ReactNode[] = [];
  for (let lane = 0; lane < LANES; lane++) {
    for (let screen = 0; screen < COLUMNS; screen++) {
      const c = away ? COLUMNS - 1 - screen : screen;
      const yard = yards[c];
      const isRunner = runner.x === c && runner.lane === lane;
      const isDefender = !isRunner && defenders.some((d) => d.x === c && d.lane === lane);
      const isTackler = holding && tackler !== null && tackler.x === c && tackler.lane === lane;
      // A yard line sits on the edge of the cell nearest the offence's own goal.
      const marked = yard === 100 || (yard % 10 === 0 && yard > 0 && yard < 100);
      const line = `1px solid ${yard === 100 ? "var(--pf-goal)" : marked ? "var(--pf-line)" : "transparent"}`;
      const blink = isTackler || (allBlink && (isRunner || isDefender));

      cells.push(
        <div
          key={`${lane}-${screen}`}
          className={`flex items-center justify-center ${big ? "aspect-[0.9]" : "aspect-[1.35]"}`}
          style={{ [away ? "borderRight" : "borderLeft"]: line, background: yard > 100 ? "rgba(255,61,46,0.06)" : undefined }}
        >
          <span
            className={`block rounded-full ${blink ? "pf-blink" : ""} ${
              isRunner
                ? `pf-glow-strong w-[78%] ${big ? "h-[32%]" : "h-[38%]"}`
                : isDefender
                  ? `w-[64%] ${big ? "h-[24%]" : "h-[28%]"}`
                  : `w-[48%] ${big ? "h-[16%]" : "h-[20%]"}`
            }`}
            style={{
              // The runner is white hot in the middle; a defender is a solid, plainly dimmer red;
              // an unlit cell is barely there, so only the players catch the eye.
              background: isRunner
                ? "radial-gradient(ellipse at center, #fff4ef 0%, var(--pf-led-hot) 35%, var(--pf-led) 75%)"
                : isDefender
                  ? "var(--pf-led-dim)"
                  : "var(--pf-led-off)",
              boxShadow: isDefender ? "inset 0 0 0 1px rgba(255,120,100,0.35)" : undefined,
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
  large,
  go,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  big?: boolean;
  large?: boolean;
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
        big ? "h-24 w-24" : large ? "h-[72px] w-[72px]" : "h-14 w-14"
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
        className={`h-9 w-16 rounded-full transition-transform active:translate-y-0.5 sm:h-8 sm:w-14 ${disabled ? "opacity-50" : ""}`}
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
