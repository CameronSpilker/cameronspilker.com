"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { pixelFootball as copy } from "@/content/games";
import { createBeeper } from "@/lib/games/beeper";
import { burstConfetti } from "@/components/tools/confetti";
import { CPU_TAP_MS, cpuMove } from "@/lib/games/cpu";
import {
  COLUMNS,
  LANES,
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
const MODE_KEY = "pixel-football-mode";
/** How long the computer waits before its snap and before setting up its next play. Its step pace is its skill's. */
const CPU_SNAP_MS = 900;
const CPU_NEXT_MS = 2_000;
/** Run turns into Next after a play, but not until this long after it ended, so a mashed Run does not skip the result. */
const NEXT_GUARD_MS = 450;
/** How long the score stays up after someone presses Score. */
const SCORE_SHOW_MS = 2_500;
/** A frame longer than this (a background tab, a debugger) counts as this long. */
const MAX_FRAME_MS = 100;

type Bests = { longestRun: number; mostPoints: number };

/** Who the other side is: the computer, or a friend sharing the device. */
type Mode = "cpu" | "friend";

/** The name a side goes by: You and Computer against the computer, Home and Away between friends. */
function nameOf(team: Team, mode: Mode): string {
  if (mode === "cpu") return team === "home" ? copy.teams.you : copy.teams.cpu;
  return copy.teams[team];
}

/** "Your ball", "Computer's ball", "Home ball", "Away ball". */
function ballOf(team: Team, mode: Mode): string {
  if (mode === "cpu") return team === "home" ? copy.balls.you : copy.balls.cpu;
  return copy.balls[team];
}

/** True when the computer is the one with the ball. */
const cpuHasBall = (state: State, mode: Mode) => mode === "cpu" && state.offense === "away";

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
/** A fixed "random" number, for the one board that has to look the same on the server and in the browser. */
const FIXED_ROLL = () => 0.5;

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

/** The line under the field: what just happened, or what to do now. */
function describe(state: State, paused: boolean, mode: Mode): string {
  const m = copy.messages;
  if (state.phase === "final") {
    const { home, away } = state.score;
    const winner = home === away ? null : nameOf(home > away ? "home" : "away", mode);
    return m.final(winner, Math.max(home, away), Math.min(home, away));
  }
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
    return state.quarterOver ? `${line} ${m.endQuarter(state.quarter)}` : line;
  }

  if (cpuHasBall(state, mode)) return m.cpuBall;
  if (state.phase === "live") return m.running;
  const situation = m.ready(ballOf(state.offense, mode), state.down, state.toGo, 100 - state.ballOn);
  return state.down === 4 ? `${situation} ${m.fourth}` : `${situation} ${m.press}`;
}

export function PixelFootball() {
  // The first board is drawn on the server and again in the browser. It must come out the same in both,
  // or the browser keeps a lit cell the server drew for a defender who is not there. So no dice until
  // a real game starts: the formation's random lanes use a fixed roll here.
  const [game, setGame] = useState<State>(() => newGame("rookie", FIXED_ROLL));
  const [paused, setPaused] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [sound, setSound] = useState(true);
  const [bests, setBests] = useState<Bests>({ longestRun: 0, mostPoints: 0 });
  const [announcement, setAnnouncement] = useState("");
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<Mode>("cpu");
  // The pop up opens the game: "start" picks who to play and starts fresh, "help" just shows the steps.
  const [intro, setIntro] = useState<"start" | "help" | null>("start");
  const phone = useMediaQuery(PHONE_QUERY);
  const fullscreen = phone && full;

  const gameRef = useRef(game);
  const pausedRef = useRef(paused);
  const soundRef = useRef(sound);
  const beeper = useRef<ReturnType<typeof createBeeper> | null>(null);
  const scoreTimer = useRef<number | undefined>(undefined);
  const modeRef = useRef(mode);
  const introRef = useRef(intro);
  const cpuClock = useRef(0);
  const resultAt = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    introRef.current = intro;
  }, [intro]);

  // Preferences and bests live in this browser only.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading storage after hydration */
    setBests(readBests());
    if (load(SOUND_KEY) === "off") setSound(false);
    if (load(MODE_KEY) === "friend") setMode("friend");
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
    // A kick thumps first, and what came of it plays once the ball is away.
    const kicked = events.includes("kick");
    if (kicked) beeper.current.play("kick");
    // Otherwise the biggest moment wins when a step brings several: a tackle that is also a first down.
    const order: GameEvent[] = [
      "final",
      "touchdown",
      "fieldGoal",
      "turnover",
      "quarter",
      "firstDown",
      "tackle",
      "snap",
      "step",
    ];
    const loudest = order.find((e) => events.includes(e));
    if (loudest) beeper.current.play(loudest, kicked ? 380 : 0);
  }, []);

  /** Wake the audio from a real tap, click or key press. Phones only allow sound after one. */
  const unlockSound = useCallback(() => {
    if (!soundRef.current) return;
    beeper.current ??= createBeeper();
    beeper.current.unlock();
  }, []);

  useEffect(() => {
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    for (const e of events) window.addEventListener(e, unlockSound, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, unlockSound);
    };
  }, [unlockSound]);

  const commit = useCallback(
    (step: Step) => {
      const before = gameRef.current;
      const next = step.state;
      if (next === before) return;
      gameRef.current = next;
      setGame(next);
      play(step.events);

      // The computer's timing starts over whenever the phase moves on.
      if (next.phase !== before.phase) cpuClock.current = 0;
      if (next.phase === "result" && before.phase !== "result") resultAt.current = performance.now();

      const ended = next.phase === "result" && before.phase !== "result";
      const over = next.phase === "final" && before.phase !== "final";
      if (ended || over) {
        setAnnouncement(describe(next, false, modeRef.current));
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
      // A score is a moment: confetti over everything, the phone layout included.
      if (scored) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduced) {
          const big = next.outcome?.kind === "touchdown";
          burstConfetti(big ? 260 : 140, big ? 3400 : 2600, 130);
        }
      }
      if (next.phase === "live" && before.phase !== "live") setShowScore(false);
    },
    [play],
  );

  const send = useCallback(
    (input: Input) => {
      if (pausedRef.current || introRef.current) return;
      const current = gameRef.current;
      if (current.phase === "final") return;

      // After a play, Run means Next: one big button does both jobs.
      if (current.phase === "result" && input === "forward") {
        if (performance.now() - resultAt.current < NEXT_GUARD_MS) return;
        setShowScore(false);
        commit(press(current, "status", rng));
        return;
      }
      // While the computer has the ball, its buttons are its own.
      const setsUp = input === "status" || input === "score";
      if (cpuHasBall(current, modeRef.current) && !setsUp) return;
      commit(press(current, input, rng));
    },
    [commit],
  );

  /** Next play: what the banner button, Run after a play, and Space all do. */
  const next = useCallback(() => {
    if (pausedRef.current || introRef.current) return;
    window.clearTimeout(scoreTimer.current);
    setShowScore(false);
    commit(press(gameRef.current, "status", rng));
  }, [commit]);

  /** New game opens the pop up, so the reader picks who to play first. */
  const newGameAsk = useCallback(() => setIntro("start"), []);

  const start = useCallback(
    (picked: Mode) => {
      setMode(picked);
      modeRef.current = picked;
      save(MODE_KEY, picked);
      setPaused(false);
      setShowScore(false);
      commit({ state: newGame(gameRef.current.difficulty, rng), events: [] });
      setIntro(null);
      introRef.current = null;
      setFull(true);
      unlockSound();
    },
    [commit, unlockSound],
  );

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

  const help = useCallback(() => setIntro("help"), []);
  const closeIntro = useCallback(() => setIntro(null), []);

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

  /** Turning sound on plays a chime straight away, so you know it works. */
  const toggleSound = useCallback(() => {
    const on = !soundRef.current;
    soundRef.current = on;
    setSound(on);
    save(SOUND_KEY, on ? "on" : "off");
    if (on) {
      unlockSound();
      beeper.current?.play("firstDown");
    } else {
      beeper.current?.rest();
    }
  }, [unlockSound]);

  /** The computer's side of the game: it snaps, runs, kicks and sets up its next play at a human pace. */
  const driveCpu = useCallback(
    (ms: number) => {
      const g = gameRef.current;
      if (!cpuHasBall(g, modeRef.current) || g.phase === "final") {
        cpuClock.current = 0;
        return;
      }
      cpuClock.current += ms;
      // The computer plays at the level picked: on Pro it taps faster and always takes its best move.
      const wait = g.phase === "ready" ? CPU_SNAP_MS : g.phase === "live" ? CPU_TAP_MS[g.difficulty] : CPU_NEXT_MS;
      if (cpuClock.current < wait) return;
      cpuClock.current = 0;
      if (g.phase === "result") {
        setShowScore(false);
        commit(press(g, "status", rng));
        return;
      }
      const move = cpuMove(g, rng, g.difficulty);
      if (move) commit(press(g, move, rng));
    },
    [commit],
  );

  // The clock, the defence and the computer: one advance per animation frame.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const ms = Math.min(MAX_FRAME_MS, now - last);
      last = now;
      if (!pausedRef.current && !introRef.current) {
        commit(advance(gameRef.current, ms, rng));
        driveCpu(ms);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [commit, driveCpu]);

  // Leaving the tab pauses a game that is under way.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) beeper.current?.rest();
      const phase = gameRef.current.phase;
      if (document.hidden && (phase === "live" || phase === "result")) setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // While the phone layout or the pop up is open, the page underneath must not scroll or bounce.
  const locked = fullscreen || intro !== null;
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = before.overflow;
      html.style.overscrollBehavior = before.overscroll;
    };
  }, [locked]);

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
      // The pop up has its own buttons; Escape closes it when there is a game to go back to.
      if (introRef.current) {
        if (key === "Escape" && introRef.current === "help") setIntro(null);
        return;
      }
      // Like the old one key "run" button, either sideways arrow runs toward the goal.
      let action: (() => void) | null = null;
      if (key === "ArrowUp" || key === "w" || key === "W") action = () => send("up");
      else if (key === "ArrowDown" || key === "s" || key === "S") action = () => send("down");
      else if (["ArrowRight", "ArrowLeft", "d", "D", "a", "A"].includes(key)) action = () => send("forward");
      else if ((key === " " || key === "Enter") && !onButton) action = gameRef.current.phase === "result" ? next : pressStatus;
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
  }, [send, togglePause, pressStatus, pressScore, next]);

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
    mode,
    onNext: next,
    onNewGame: newGameAsk,
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
          <PhonePreview game={game} paused={paused} mode={mode} onPlay={() => setFull(true)} />
        </>
      ) : (
        <Handheld {...handheld} />
      )}

      {intro && <Intro choose={intro === "start"} mode={mode} onPick={start} onClose={closeIntro} />}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={newGameAsk}
          className="rounded-full bg-bright px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          {copy.buttons.newGame}
        </button>
        <button
          type="button"
          onClick={help}
          className="glass rounded-full px-5 py-2.5 text-sm font-semibold text-bright"
        >
          {copy.buttons.howTo}
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

      <Scoreboard game={game} bests={bests} mode={mode} />
    </div>
  );
}

/** Everything the two layouts of the handheld share. */
type HandheldProps = {
  game: State;
  paused: boolean;
  showScore: boolean;
  sound: boolean;
  mode: Mode;
  onNext: () => void;
  onNewGame: () => void;
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
        {/* Says ON or OFF in words: a dark button alone read as off to people, and a tap then muted the game. */}
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.blur();
            onSound();
          }}
          aria-pressed={sound}
          aria-label={sound ? copy.buttons.soundIsOn : copy.buttons.soundIsOff}
          className="flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]"
          style={{
            borderColor: "var(--pf-case-edge)",
            background: sound ? "var(--pf-print)" : "transparent",
            color: sound ? "var(--pf-case)" : "var(--pf-print)",
          }}
        >
          <SpeakerIcon on={sound} />
          {sound ? copy.buttons.on : copy.buttons.off}
        </button>
        {children}
      </div>
    </div>
  );
}

/** A speaker, with sound waves when on and a cross when off. */
function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
      {on ? (
        <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M11 6l4 4M15 6l-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Lamps({ game, mode }: { game: State; mode: Mode }) {
  const l = copy.labels;
  return (
    <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-white/45 sm:text-[10px]">
      <Lamp on={game.board === "home"} label={mode === "cpu" ? l.you : l.home} />
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
      <Lamp on={game.board === "away"} label={mode === "cpu" ? l.cpu : l.away} reverse />
    </div>
  );
}

/** The wide handheld, for a laptop or a tablet: the field runs left to right. */
function Handheld(props: HandheldProps) {
  const { game, paused, showScore, onInput, onScore, onStatus } = props;
  const runsRight = game.board === "home";
  const canKick = !paused && game.phase === "ready" && game.down === 4 && !cpuHasBall(game, props.mode);

  return (
    <div className="mx-auto w-full max-w-[680px] select-none" style={{ touchAction: "manipulation" }}>
      <div
        className="rounded-[44px] border-b-[6px] p-5"
        style={{ ...caseStyle, boxShadow: "0 30px 60px var(--pf-shadow), inset 0 2px 0 rgba(255,255,255,0.6)" }}
      >
        <TopBar {...props} />

        {/* The bezel: readout on top, the field under it. */}
        <div className="rounded-[28px] p-4" style={{ background: "var(--pf-bezel)" }}>
          <Readout game={game} scoreMode={showScore || game.phase === "final"} mode={props.mode} />
          <div className="relative mt-3">
            <Stadium game={game}>
              <Field game={game} paused={paused} mode={props.mode} />
            </Stadium>
            <PlayBanner {...props} />
          </div>
          <div className="mt-2">
            <Lamps game={game} mode={props.mode} />
          </div>
        </div>

        <p className="mt-3 min-h-[2.5em] px-2 text-center font-mono text-xs leading-snug">{describe(game, paused, props.mode)}</p>

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
          <RunKey game={game} paused={paused} mode={props.mode} runsRight={runsRight} onInput={onInput} />
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
  const canKick = !paused && game.phase === "ready" && game.down === 4 && !cpuHasBall(game, props.mode);
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
        <Readout game={game} scoreMode={showScore || game.phase === "final"} mode={props.mode} />
        <div className="relative">
          <Stadium game={game} compact>
            <Field game={game} paused={paused} mode={props.mode} big />
          </Stadium>
          <PlayBanner {...props} />
        </div>
        <div className="px-1">
          <Lamps game={game} mode={props.mode} />
        </div>
      </div>

      <p className="mx-4 mt-3 min-h-[2.6em] text-center font-mono text-xs leading-snug">{describe(game, paused, props.mode)}</p>

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
        <RunKey game={game} paused={paused} mode={props.mode} runsRight={runsRight} onInput={onInput} />
      </div>
    </div>
  );
}

/** On a phone, the page shows the field and one big button that opens the game full screen. */
function PhonePreview({ game, paused, mode, onPlay }: { game: State; paused: boolean; mode: Mode; onPlay: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-[32px] border-b-[6px] p-3" style={{ ...caseStyle, boxShadow: "0 24px 48px var(--pf-shadow)" }}>
        <div className="rounded-[22px] px-2 py-3" style={{ background: "var(--pf-bezel)" }}>
          <Readout game={game} scoreMode={game.phase === "final"} mode={mode} />
          <div className="mt-2">
            <Stadium game={game} compact>
              <Field game={game} paused={paused} mode={mode} big />
            </Stadium>
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

/**
 * What just happened, laid over the field after every play, and what comes
 * next. A big Next play button sets it up, unless the computer has the ball
 * next, in which case it sets up its own play after a moment.
 */
function PlayBanner({ game, paused, mode, onNext, onNewGame }: HandheldProps) {
  const b = copy.banner;
  if (paused) return null;

  if (game.phase === "final") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/65 px-3 text-center">
        <p className="font-mono text-sm font-bold text-white sm:text-base">{describe(game, false, mode)}</p>
        <button
          type="button"
          onClick={onNewGame}
          className="pf-pulse rounded-full px-5 py-2 font-mono text-xs font-bold tracking-[0.2em] text-white uppercase"
          style={{ background: "var(--pf-go)" }}
        >
          {copy.buttons.newGame}
        </button>
      </div>
    );
  }
  if (game.phase !== "result" || !game.outcome) return null;

  // A score gets the whole field: big gold words, the points, and the new score.
  if (game.outcome.kind === "touchdown" || game.outcome.kind === "fieldGoal") {
    const touchdown = game.outcome.kind === "touchdown";
    const scorer = nameOf(game.board, mode);
    const cpuNextScore = cpuHasBall(game, mode);
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/70 px-3 text-center">
        <p
          className="pf-blink-slow font-mono text-xl font-black tracking-[0.12em] uppercase sm:text-3xl"
          style={{ color: "var(--pf-post)", textShadow: "0 0 12px rgba(244,197,66,0.7)" }}
        >
          {touchdown ? b.touchdown : b.fieldGoal}
        </p>
        <p className="font-mono text-xs font-bold text-white sm:text-sm">
          {b.points(touchdown ? 7 : 3, scorer)}
        </p>
        <p className="font-mono text-[11px] text-white/80 sm:text-xs">
          {b.scoreLine(nameOf("home", mode), game.score.home, nameOf("away", mode), game.score.away)}
          {game.quarterOver && ` · ${b.endQuarter(game.quarter)}`}
        </p>
        {cpuNextScore ? (
          <p className="font-mono text-[10px] text-white/60 sm:text-xs">{b.cpuNext}</p>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="pf-pulse mt-1 rounded-full px-4 py-1.5 font-mono text-[11px] font-bold tracking-[0.2em] text-white uppercase sm:px-5 sm:py-2 sm:text-xs"
            style={{ background: "var(--pf-go)" }}
          >
            {copy.buttons.nextPlay} &#9654;
          </button>
        )}
      </div>
    );
  }

  const o = game.outcome;
  const headline = {
    tackle: o.kind === "tackle" ? (o.firstDown ? b.firstDown(o.gain) : b.tackle(o.gain)) : "",
    turnover: b.turnover,
    touchdown: b.touchdown,
    fieldGoal: b.fieldGoal,
    punt: o.kind === "punt" ? (o.touchback ? b.touchback : b.punt(o.distance)) : "",
  }[o.kind];
  const nextTeam = nameOf(game.offense, mode);
  const changed = game.offense !== game.board;
  const cpuNext = cpuHasBall(game, mode);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/60 px-3 text-center">
      <p className="font-mono text-sm font-bold tracking-wide text-white sm:text-lg">
        {headline}
        {game.quarterOver && ` · ${b.endQuarter(game.quarter)}`}
      </p>
      <p className="font-mono text-[10px] text-white/75 sm:text-xs">
        {b.next(ballOf(game.offense, mode), game.down, game.toGo, 100 - game.ballOn)}
      </p>
      {mode === "friend" && changed && (
        <p className="font-mono text-[10px] font-bold sm:text-xs" style={{ color: "var(--pf-go-top)" }}>
          {b.passTo(nextTeam)}
        </p>
      )}
      {cpuNext ? (
        <p className="font-mono text-[10px] text-white/60 sm:text-xs">{b.cpuNext}</p>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="pf-pulse mt-1 rounded-full px-4 py-1.5 font-mono text-[11px] font-bold tracking-[0.2em] text-white uppercase sm:px-5 sm:py-2 sm:text-xs"
          style={{ background: "var(--pf-go)" }}
        >
          {copy.buttons.nextPlay} &#9654;
        </button>
      )}
    </div>
  );
}

/**
 * The big orange key. It runs during a play and becomes Next once a play is
 * over, so the one button the thumb rests on always does the next thing.
 */
function RunKey({
  game,
  paused,
  mode,
  runsRight,
  onInput,
}: {
  game: State;
  paused: boolean;
  mode: Mode;
  runsRight: boolean;
  onInput: (input: Input) => void;
}) {
  const isNext = !paused && game.phase === "result" && !cpuHasBall(game, mode);
  const idle = !paused && game.phase !== "result" && cpuHasBall(game, mode);
  return (
    <PadKey
      label={isNext ? copy.buttons.next : copy.buttons.forward}
      onPress={() => onInput("forward")}
      big
      go
      pulse={isNext}
      dim={idle || game.phase === "final"}
    >
      {isNext ? (
        <span className="font-mono text-sm font-bold tracking-[0.15em]">{copy.buttons.next.toUpperCase()}</span>
      ) : (
        <Arrow dir={runsRight ? "right" : "left"} />
      )}
    </PadKey>
  );
}

/**
 * The pop up that opens the game: three steps, then who to play. Opened
 * again from How to play, it shows the steps and a way back to the game.
 */
function Intro({
  choose,
  mode,
  onPick,
  onClose,
}: {
  choose: boolean;
  mode: Mode;
  onPick: (mode: Mode) => void;
  onClose: () => void;
}) {
  const i = copy.intro;
  const options: { value: Mode; label: string; note: string }[] = [
    { value: "cpu", label: i.cpu, note: i.cpuNote },
    { value: "friend", label: i.friend, note: i.friendNote },
  ];
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pf-intro-title"
    >
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-[28px] bg-surface p-6 text-body shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="pf-intro-title" className="text-2xl font-extrabold tracking-tight text-bright">
            {i.title}
          </h2>
          {!choose && (
            <button type="button" onClick={onClose} aria-label={i.close} className="text-2xl leading-none text-body hover:text-bright">
              &times;
            </button>
          )}
        </div>

        <ol className="mt-5 space-y-4">
          {i.steps.map((step, n) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold text-white"
                style={{ background: "var(--pf-go)" }}
              >
                {n + 1}
              </span>
              <div>
                <p className="font-semibold text-bright">{step.title}</p>
                <p className="text-sm leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {choose ? (
          <>
            <p className="mt-6 text-sm font-semibold text-bright">{i.choose}</p>
            <div className="mt-3 grid gap-3">
              {options.map((o) => {
                const primary = o.value === mode;
                return (
                  <button
                    key={o.value}
                    type="button"
                    autoFocus={primary}
                    onClick={() => onPick(o.value)}
                    className={`rounded-2xl px-5 py-4 text-left transition-transform active:scale-[0.98] ${
                      primary ? "text-white" : "border border-line text-bright"
                    }`}
                    style={primary ? { background: "var(--pf-go)" } : undefined}
                  >
                    <span className="block text-lg font-bold">{o.label}</span>
                    <span className={`block text-sm ${primary ? "text-white/85" : ""}`}>{o.note}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="mt-6 w-full rounded-2xl px-5 py-4 text-lg font-bold text-white"
            style={{ background: "var(--pf-go)" }}
          >
            {copy.buttons.resumeFull}
          </button>
        )}

        <p className="mt-4 hidden text-xs sm:block">{i.keys}</p>
      </div>
    </div>
  );
}

function Readout({ game, scoreMode, mode }: { game: State; scoreMode: boolean; mode: Mode }) {
  const l = copy.labels;
  const spot = fieldPosition(game);
  // Inside the 10 the yards to go box goes dark: it is goal to go.
  const toGo = yardsToGo(game);

  const cells: { label: string; value: string; width: number; side?: Team | null }[] = scoreMode
    ? [
        { label: mode === "cpu" ? l.you : l.home, value: String(game.score.home % 100), width: 2 },
        { label: l.time, value: clockReading(game), width: 3 },
        { label: mode === "cpu" ? l.cpu : l.away, value: String(game.score.away % 100), width: 2 },
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
 * The stadium around the field: stands full of crowd above and below, a light
 * tower in each corner, and a goalpost at each end. The goalpost the side with
 * the ball is running toward is lit, so the way to go is never in doubt.
 */
function Stadium({ game, compact = false, children }: { game: State; compact?: boolean; children: ReactNode }) {
  const towardRight = game.board === "home";
  const stand = `pf-crowd ${compact ? "h-3" : "h-4"}`;
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ background: "var(--pf-stands)" }}>
      <div className={stand} aria-hidden="true" />
      <div className={`grid grid-cols-[auto_1fr_auto] items-center ${compact ? "gap-0.5 px-0.5" : "gap-1 px-1"}`}>
        <Goalpost lit={!towardRight} compact={compact} />
        <div
          className="overflow-hidden rounded-[3px]"
          style={{ background: "var(--pf-turf)", boxShadow: "0 0 0 2px var(--pf-chalk), 0 0 18px rgba(0,0,0,0.5)" }}
        >
          {children}
        </div>
        <Goalpost lit={towardRight} compact={compact} />
      </div>
      <div className={stand} aria-hidden="true" />
      {/* Light towers in the four corners, washing the field. */}
      {["left-1 top-0.5", "right-1 top-0.5", "left-1 bottom-0.5", "right-1 bottom-0.5"].map((at) => (
        <span key={at} aria-hidden="true" className={`pf-floodlight absolute ${at} h-1.5 w-3 rounded-sm`} />
      ))}
    </div>
  );
}

/** A goalpost seen from the side, at the back of an end zone. Lit when it is the one to run at. */
function Goalpost({ lit, compact }: { lit: boolean; compact: boolean }) {
  return (
    <svg
      viewBox="0 0 12 28"
      aria-hidden="true"
      className={`${compact ? "h-9 w-3" : "h-14 w-4"} ${lit ? "pf-glow" : ""}`}
      style={{ color: lit ? "var(--pf-post)" : "rgba(255,255,255,0.25)" }}
    >
      <path d="M2 2 V14 H10 V2 M6 14 V27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The field: 9 columns by 3 lanes of turf, running toward the goal of the
 * side with the ball. Chalk marks every yard faintly, every 5 more strongly,
 * with the yard numbers at each 10 and a bold goal line; past it, the end
 * zone. `big` squares the cells up for a narrow phone screen, so the dots
 * stay large.
 */
function Field({ game, paused, mode, big = false }: { game: State; paused: boolean; mode: Mode; big?: boolean }) {
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
      const blink = isTackler || (allBlink && (isRunner || isDefender));

      // A yard line sits on the edge of the cell nearest the offence's own goal.
      const endZone = yard > 100;
      const chalk =
        yard === 100
          ? "3px solid var(--pf-chalk)"
          : endZone
            ? "1px solid transparent"
            : yard % 5 === 0
              ? "1px solid rgba(255,255,255,0.45)"
              : "1px solid rgba(255,255,255,0.1)";
      // Mowing stripes: every other yard a shade lighter.
      const turf = endZone
        ? "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 5px, transparent 5px 10px), var(--pf-endzone)"
        : yard % 2 === 0
          ? "var(--pf-turf-stripe)"
          : undefined;
      // Yard numbers along the bottom at every 10, read from the nearer goal, as on a real field.
      const number = lane === LANES - 1 && yard % 10 === 0 && yard > 0 && yard < 100 ? (yard <= 50 ? yard : 100 - yard) : null;

      cells.push(
        <div
          key={`${lane}-${screen}`}
          className={`relative flex items-center justify-center ${big ? "aspect-[0.78]" : "aspect-[1.35]"}`}
          style={{ [away ? "borderRight" : "borderLeft"]: chalk, background: turf }}
        >
          {number !== null && (
            <span
              aria-hidden="true"
              className={`absolute bottom-0.5 font-mono font-bold text-white/45 ${big ? "text-[8px]" : "text-[10px]"} ${
                away ? "right-[3px]" : "left-[3px]"
              }`}
            >
              {number}
            </span>
          )}
          <span
            className={`relative block rounded-full ${blink ? "pf-blink" : ""} ${
              isRunner
                ? `pf-glow-strong w-[78%] ${big ? "h-[32%]" : "h-[38%]"}`
                : isDefender
                  ? `w-[64%] ${big ? "h-[24%]" : "h-[28%]"}`
                  : `w-[48%] ${big ? "h-[16%]" : "h-[20%]"}`
            }`}
            style={{
              // The runner is white hot in the middle; a defender is a solid red with a light rim, so it
              // stands off the green; an unlit cell is a faint shadow on the grass.
              background: isRunner
                ? "radial-gradient(ellipse at center, #fff4ef 0%, var(--pf-led-hot) 35%, var(--pf-led) 75%)"
                : isDefender
                  ? "var(--pf-led-dim)"
                  : "var(--pf-turf-dot)",
              boxShadow: isDefender ? "inset 0 0 0 1px rgba(255,150,130,0.6), 0 1px 3px rgba(0,0,0,0.6)" : undefined,
            }}
          />
        </div>,
      );
    }
  }

  return (
    <div
      role="img"
      aria-label={describe(game, paused, mode)}
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
  pulse,
  dim,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  big?: boolean;
  large?: boolean;
  go?: boolean;
  pulse?: boolean;
  dim?: boolean;
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
      } ${pulse ? "pf-pulse" : ""} ${dim ? "opacity-40" : ""}`}
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
          onClick={(event) => {
            // Let go of focus, so Space goes back to the game rather than pressing this again.
            event.currentTarget.blur();
            onChange(o.value);
          }}
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

function Scoreboard({ game, bests, mode }: { game: State; bests: Bests; mode: Mode }) {
  const s = copy.scoreboard;
  const team = (t: Team) => (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm">
        {nameOf(t, mode)}
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
