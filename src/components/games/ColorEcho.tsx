"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { colorEcho as copy } from "@/content/games";
import { createBeeper, type Note } from "@/lib/games/beeper";
import { burstConfetti } from "@/components/tools/confetti";
import {
  DEFAULT_GOAL,
  GOALS,
  PRESS_LIMIT_MS,
  completed,
  newGame,
  press,
  round,
  startInput,
  tempo,
  timeUp,
  type Goal,
  type Pad,
  type State,
} from "@/lib/games/memory";

const BESTS_KEY = "color-echo-bests";
const SOUND_KEY = "color-echo-sound";
const GOAL_KEY = "color-echo-goal";

/** The pause before playback starts, so the player has time to look up. */
const LEAD_IN_MS = 700;
/** After a finished round, how long "Nice" stays up before the next playback. */
const BETWEEN_ROUNDS_MS = 900;
/** How long a pad stays lit, and sounds, when the player presses it. */
const PRESS_MS = 240;

/**
 * Each pad's colour and note. The notes are C, D, E and G from the major
 * pentatonic scale, which has no clashing pair, so any order sounds fine.
 * They are this game's own, not borrowed from any real handheld.
 */
const PADS: { color: string; freq: number }[] = [
  { color: "#ff6b5e", freq: 523.25 },
  { color: "#ffc23d", freq: 587.33 },
  { color: "#2ec4a6", freq: 659.25 },
  { color: "#8a7dff", freq: 783.99 },
];

const MISS: Note[] = [{ freq: 98, ms: 650, wave: "sawtooth", vol: 0.7 }];
const WIN: Note[] = [
  ...PADS.map((p) => ({ freq: p.freq, ms: 110, gap: 20 })),
  { freq: 1046.5, ms: 140, gap: 60 },
  { freq: 783.99, ms: 120, gap: 20 },
  { freq: 1046.5, ms: 520 },
];

/** Speed changes at these rounds, and the readout says so. */
const SPEED_UPS = new Set([5, 9, 13]);

const KEYS: Record<string, Pad> = { "1": 0, "2": 1, "3": 2, "4": 3, q: 0, w: 1, a: 2, s: 3 };

type Bests = Record<string, number>;
const goalKey = (goal: Goal) => (goal === null ? "endless" : String(goal));

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows and full storage: the game still plays, it just forgets.
  }
}

function readBests(): Bests {
  try {
    const raw = JSON.parse(load(BESTS_KEY) ?? "null") as unknown;
    if (typeof raw !== "object" || raw === null) return {};
    const out: Bests = {};
    for (const goal of GOALS) {
      const v = (raw as Record<string, unknown>)[goalKey(goal)];
      if (typeof v === "number" && Number.isInteger(v) && v > 0 && v < 10_000) out[goalKey(goal)] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function ColorEcho() {
  const [game, setGame] = useState<State | null>(null);
  const [lit, setLit] = useState<Pad | null>(null);
  const [missed, setMissed] = useState<Pad | null>(null);
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [sound, setSound] = useState(true);
  const [bests, setBests] = useState<Bests>({});
  const [newBest, setNewBest] = useState(false);
  const [nice, setNice] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  /** Bumped each time the press clock restarts, so the countdown bar starts over. Zero when it is not running. */
  const [clock, setClock] = useState(0);

  const gameRef = useRef<State | null>(null);
  const soundRef = useRef(sound);
  const bestsRef = useRef<Bests>({});
  const beeper = useRef<ReturnType<typeof createBeeper> | null>(null);
  const timers = useRef<number[]>([]);
  const clockTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Preferences and bests live in this browser only.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading storage after hydration */
    const saved = readBests();
    bestsRef.current = saved;
    setBests(saved);
    if (load(SOUND_KEY) === "off") setSound(false);
    const g = load(GOAL_KEY);
    const match = GOALS.find((x) => goalKey(x) === g);
    if (match !== undefined) setGoal(match);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const notes = useCallback((n: Note[]) => {
    if (!soundRef.current) return;
    beeper.current ??= createBeeper();
    beeper.current.notes(n);
  }, []);

  const tone = useCallback((pad: Pad, ms: number) => notes([{ freq: PADS[pad].freq, ms, wave: "triangle", vol: 0.8 }]), [notes]);

  const commit = useCallback((next: State) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const recordBest = useCallback((state: State) => {
    const key = goalKey(state.goal);
    const done = completed(state);
    if (done <= (bestsRef.current[key] ?? 0)) return;
    const next = { ...bestsRef.current, [key]: done };
    bestsRef.current = next;
    setBests(next);
    setNewBest(true);
    save(BESTS_KEY, JSON.stringify(next));
  }, []);

  const stopClock = useCallback(() => {
    window.clearTimeout(clockTimer.current);
    clockTimer.current = undefined;
    setClock(0);
  }, []);

  /** The game is over: a wrong pad or too slow. Show the pad that was due. */
  const lose = useCallback(
    (lost: State) => {
      stopClock();
      setLit(null);
      notes(MISS);
      setMissed(lost.expected);
      recordBest(lost);
      setAnnouncement(copy.announce.lost(completed(lost), copy.pads[lost.expected ?? 0].name, lost.miss === "slow"));
    },
    [notes, recordBest, stopClock],
  );

  /** Give the player PRESS_LIMIT_MS for their next press. */
  const startClock = useCallback(() => {
    window.clearTimeout(clockTimer.current);
    setClock((c) => c + 1);
    clockTimer.current = window.setTimeout(() => {
      const current = gameRef.current;
      if (!current || current.phase !== "input") return;
      const lost = timeUp(current);
      commit(lost);
      lose(lost);
    }, PRESS_LIMIT_MS);
  }, [commit, lose]);

  /** Light the whole sequence up, one pad at a time, then hand over to the player. */
  const playback = useCallback(
    (state: State) => {
      const n = round(state);
      const { onMs, offMs } = tempo(n);
      setAnnouncement(copy.announce.watch(n));
      let at = LEAD_IN_MS;
      for (const pad of state.sequence) {
        later(() => {
          setLit(pad);
          tone(pad, onMs);
        }, at);
        later(() => setLit(null), at + onMs);
        at += onMs + offMs;
      }
      later(() => {
        const current = gameRef.current;
        if (!current) return;
        commit(startInput(current));
        startClock();
        setAnnouncement(copy.announce.yourTurn(n));
      }, at);
    },
    [commit, later, startClock, tone],
  );

  const start = useCallback(() => {
    clearTimers();
    stopClock();
    const s = newGame(goal, Math.random);
    commit(s);
    setLit(null);
    setMissed(null);
    setNice(false);
    setNewBest(false);
    playback(s);
  }, [clearTimers, commit, goal, playback, stopClock]);

  const hit = useCallback(
    (pad: Pad) => {
      const current = gameRef.current;
      if (!current || current.phase !== "input") return;
      const { state: next, result } = press(current, pad, Math.random);
      commit(next);

      if (result === "wrong") {
        lose(next);
        return;
      }
      if (result === "correct") startClock();
      else stopClock();

      setLit(pad);
      tone(pad, PRESS_MS);
      later(() => setLit((l) => (l === pad ? null : l)), PRESS_MS);

      if (result === "round") {
        setNice(true);
        later(() => {
          setNice(false);
          playback(next);
        }, BETWEEN_ROUNDS_MS);
      } else if (result === "won") {
        later(() => notes(WIN), PRESS_MS);
        recordBest(next);
        setAnnouncement(copy.announce.won(next.sequence.length));
        burstConfetti();
      }
    },
    [commit, later, lose, notes, playback, recordBest, startClock, stopClock, tone],
  );

  /** Wake the audio from a real tap, click or key press. Phones only allow sound after one. */
  useEffect(() => {
    const unlock = () => {
      if (!soundRef.current) return;
      beeper.current ??= createBeeper();
      beeper.current.unlock();
    };
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    for (const e of events) window.addEventListener(e, unlock, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, unlock);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const pad = KEYS[e.key.toLowerCase()];
      if (pad !== undefined) {
        e.preventDefault();
        hit(pad);
        return;
      }
      // Space and Enter on a focused button already press that button.
      if ((e.key === " " || e.key === "Enter") && !target?.closest("button")) {
        const phase = gameRef.current?.phase;
        if (phase === undefined || phase === "won" || phase === "lost") {
          e.preventDefault();
          start();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hit, start]);

  useEffect(() => {
    // Switching tabs mid turn should not cost the game: the clock stops while hidden and starts over on return.
    const onHide = () => {
      if (document.hidden) {
        beeper.current?.rest();
        if (gameRef.current?.phase === "input") {
          window.clearTimeout(clockTimer.current);
          clockTimer.current = undefined;
        }
      } else if (gameRef.current?.phase === "input") {
        startClock();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [startClock]);

  useEffect(
    () => () => {
      clearTimers();
      window.clearTimeout(clockTimer.current);
      beeper.current?.close();
    },
    [clearTimers],
  );

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    save(SOUND_KEY, next ? "on" : "off");
    if (!next) beeper.current?.rest();
  };

  const pickGoal = (g: Goal) => {
    setGoal(g);
    save(GOAL_KEY, goalKey(g));
  };

  const phase = game?.phase;
  const playing = phase === "show" || phase === "input";
  const over = phase === "won" || phase === "lost";
  const s = copy.status;

  let headline: string;
  let sub: string | null = null;
  if (!game) headline = s.idle;
  else if (phase === "won") headline = s.won(game.sequence.length);
  else if (phase === "lost") headline = game.miss === "slow" ? s.slow : s.lost(completed(game));
  else if (nice) headline = s.nice;
  else headline = phase === "input" ? s.yourTurn : s.watch;
  if (game && playing) {
    sub = s.round(round(game), game.goal);
    if (phase === "show" && !nice && SPEED_UPS.has(round(game))) sub = `${sub} · ${s.speedUp}`;
  }
  if (over && newBest) sub = s.newBest;
  if (phase === "lost" && game?.miss === "slow") sub = newBest ? `${s.lost(completed(game))} · ${s.newBest}` : s.lost(completed(game));

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-6">
      <div className="glass w-full rounded-[32px] p-4 sm:p-5">
        <GoalPicker goal={goal} disabled={playing} onPick={pickGoal} />

        <div className="mt-4 min-h-[64px] text-center" aria-hidden="true">
          <p className="text-xl font-bold tracking-tight text-bright sm:text-2xl">{headline}</p>
          <p className="mt-1 font-mono text-xs tracking-wider text-body uppercase">{sub ?? " "}</p>
        </div>

        <Progress game={game} />

        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-2/3 overflow-hidden rounded-full" style={{ background: clock ? "var(--line)" : "transparent" }}>
          {clock > 0 && (
            <div key={clock} className="ce-clock h-full rounded-full bg-accent" style={{ animationDuration: `${PRESS_LIMIT_MS}ms` }} />
          )}
        </div>

        <div
          className="mt-3 grid grid-cols-2 gap-3 rounded-[28px] p-3 sm:gap-4 sm:p-4"
          style={{ background: "#0b1220", touchAction: "manipulation" }}
        >
          {PADS.map((p, i) => {
            const pad = i as Pad;
            // The pad that was due lights up after a miss, and blinks, so the player sees the answer.
            const on = lit === pad || missed === pad;
            return (
              <button
                key={i}
                type="button"
                aria-label={copy.padLabel(copy.pads[i].name, copy.pads[i].key)}
                aria-disabled={phase !== "input"}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  hit(pad);
                }}
                onClick={(e) => {
                  // A click with no pointer behind it came from the keyboard or a screen reader.
                  if (e.detail === 0) hit(pad);
                }}
                className={`relative flex aspect-square items-center justify-center rounded-[22px] transition-[background-color,box-shadow,transform] duration-75 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  on ? "scale-[0.97]" : ""
                } ${missed === pad ? "ce-miss" : ""}`}
                style={{
                  background: on ? p.color : `color-mix(in srgb, ${p.color} 38%, #0b1220)`,
                  boxShadow: on
                    ? `0 0 36px 6px color-mix(in srgb, ${p.color} 70%, transparent), inset 0 0 0 2px rgba(255,255,255,0.5)`
                    : "inset 0 -6px 0 rgba(0,0,0,0.25)",
                  cursor: phase === "input" ? "pointer" : "default",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <Shape pad={pad} on={on} />
                <span
                  aria-hidden="true"
                  className="absolute top-2.5 left-3 font-mono text-[11px] font-bold"
                  style={{ color: on ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.45)" }}
                >
                  {copy.pads[i].key}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={playing}
            className="rounded-full bg-bright px-8 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            {over ? copy.buttons.again : copy.buttons.start}
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={sound ? copy.buttons.soundIsOn : copy.buttons.soundIsOff}
            className="rounded-full border border-line px-4 py-3 font-mono text-[11px] font-bold tracking-wider text-bright uppercase"
          >
            {copy.buttons.sound} · {sound ? copy.buttons.on : copy.buttons.off}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <BestsTable bests={bests} />
    </div>
  );
}

/** One dot per light in this round. Dots fill as the player repeats them. */
function Progress({ game }: { game: State | null }) {
  const count = game ? game.sequence.length : 0;
  const filled = !game ? 0 : game.phase === "input" || game.phase === "lost" ? game.input : game.phase === "won" ? count : 0;
  return (
    <div aria-hidden="true" className="flex min-h-[10px] flex-wrap justify-center gap-1.5 px-2">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{
            background: i < filled ? "var(--accent)" : "transparent",
            border: "1.5px solid var(--accent)",
            opacity: i < filled ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

/** A shape per pad, so colour is never the only way to tell them apart. */
function Shape({ pad, on }: { pad: Pad; on: boolean }) {
  const fill = on ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)";
  const shapes: ReactNode[] = [
    <circle key="c" cx="20" cy="20" r="13" />,
    <polygon key="t" points="20,6 34,32 6,32" />,
    <rect key="s" x="8" y="8" width="24" height="24" rx="3" />,
    <polygon key="d" points="20,4 36,20 20,36 4,20" />,
  ];
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="h-1/3 w-1/3" fill={fill}>
      {shapes[pad]}
    </svg>
  );
}

function GoalPicker({ goal, disabled, onPick }: { goal: Goal; disabled: boolean; onPick: (g: Goal) => void }) {
  return (
    <div role="radiogroup" aria-label={copy.goal.label} className="flex flex-wrap items-center justify-center gap-2">
      <span className="font-mono text-[11px] font-bold tracking-wider text-body uppercase">{copy.goal.label}</span>
      <div className="flex rounded-full border border-line p-0.5">
        {GOALS.map((g) => {
          const active = g === goal;
          return (
            <button
              key={goalKey(g)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onPick(g)}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase transition-opacity disabled:opacity-50 ${
                active ? "bg-bright text-ink" : "text-bright"
              }`}
            >
              {copy.goal.option(g)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BestsTable({ bests }: { bests: Bests }) {
  return (
    <section className="w-full text-sm">
      <h2 className="font-semibold text-bright">{copy.best.title}</h2>
      <dl className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {GOALS.map((g) => (
          <div key={goalKey(g)} className="glass rounded-2xl px-3 py-2 text-center">
            <dt className="font-mono text-[11px] tracking-wider uppercase">{copy.best.line(g)}</dt>
            <dd className="mt-0.5 font-semibold text-bright">{copy.best.value(bests[goalKey(g)] ?? 0, g)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
