"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wheelTool as copy } from "@/content/tools";
import {
  MAX_LABEL,
  MAX_OPTIONS,
  parseOptions,
  pickIndex,
  secureRandom,
  slicePath,
  targetRotation,
} from "@/lib/wheel/spin";
import { burstConfetti } from "./confetti";

/**
 * Slice colours: the site's sky, aqua and periwinkle, in a light and a deep
 * step each, so neighbouring slices always differ. Fixed rather than themed:
 * white labels need the same contrast on both appearances.
 */
const SLICES = ["#0a7bd6", "#11a597", "#5f6bff", "#0b5fa8", "#0e8a7e", "#4a52d6"];

const STORAGE_KEY = "wheel-options";
const SIZE = 400;
const C = SIZE / 2;
const R = 176;

function colourFor(i: number, n: number) {
  // With an odd remainder the last slice would match the first; skip ahead.
  if (n > 1 && i === n - 1 && (n - 1) % SLICES.length === 0) return SLICES[2];
  return SLICES[i % SLICES.length];
}

function labelSize(n: number) {
  if (n <= 6) return 17;
  if (n <= 10) return 15;
  if (n <= 16) return 12;
  if (n <= 28) return 9.5;
  return 7;
}

function fit(label: string, n: number) {
  const max = n <= 10 ? 16 : n <= 28 ? 14 : 12;
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function WheelSpinner() {
  const [options, setOptions] = useState<string[]>([...copy.starter]);
  const [draft, setDraft] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [duration, setDuration] = useState(5200);
  const [winner, setWinner] = useState<{ index: number; label: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const pending = useRef<{ index: number; label: string } | null>(null);
  const againRef = useRef<HTMLButtonElement | null>(null);

  // The list is remembered in this browser only, so a reload keeps the wheel.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved) && saved.every((item) => typeof item === "string")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading storage after hydration
        setOptions(saved.slice(0, MAX_OPTIONS));
      }
    } catch {
      // Storage can be blocked. The starter list stands in.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // Not remembered this time, which is fine.
    }
  }, [options]);

  const spin = useCallback(
    (list: string[] = options) => {
      if (spinning || list.length < 2) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const index = pickIndex(list.length);
      const turns = reduced ? 1 : 6 + Math.floor(secureRandom() * 3);
      pending.current = { index, label: list[index] };
      setWinner(null);
      setDuration(reduced ? 700 : 4800 + Math.floor(secureRandom() * 1200));
      setSpinning(true);
      setRotation((current) => targetRotation(current, index, list.length, turns, secureRandom()));
    },
    [options, spinning],
  );

  const finish = () => {
    if (!spinning || !pending.current) return;
    const result = pending.current;
    pending.current = null;
    setSpinning(false);
    setWinner(result);
    setHistory((past) => [result.label, ...past].slice(0, 6));
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) burstConfetti();
  };

  useEffect(() => {
    if (winner) againRef.current?.focus();
  }, [winner]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWinner(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const add = (text: string) => {
    const incoming = parseOptions(text);
    if (incoming.length === 0) return;
    const room = MAX_OPTIONS - options.length;
    setNote(incoming.length > room ? copy.full(MAX_OPTIONS) : null);
    setOptions((list) => [...list, ...incoming.slice(0, Math.max(room, 0))]);
    setDraft("");
  };

  const removeAt = (index: number) => {
    setOptions((list) => list.filter((_, i) => i !== index));
    setNote(null);
  };

  const shuffle = () => {
    setOptions((list) => {
      const next = [...list];
      for (let i = next.length - 1; i > 0; i--) {
        const j = pickIndex(i + 1);
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  };

  const removeAndSpin = () => {
    if (!winner) return;
    const next = options.filter((_, i) => i !== winner.index);
    setOptions(next);
    setWinner(null);
    // Let the wheel redraw with the slice gone before it starts turning.
    requestAnimationFrame(() => spin(next));
  };

  const n = options.length;
  const canSpin = n >= 2 && !spinning;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* The wheel */}
      <section className="glass relative flex flex-col items-center rounded-[28px] px-4 py-8 sm:py-10">
        <div className="relative w-full max-w-[520px]">
          {/* Pointer: fixed at twelve o'clock, outside the turning group. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 40 44"
            className="absolute top-[-6px] left-1/2 z-10 w-9 -translate-x-1/2 drop-shadow-[0_0_10px_var(--accent)] sm:w-11"
          >
            <path d="M20 42 L4 6 Q20 0 36 6 Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2.5" />
            <circle cx="20" cy="10" r="3.5" fill="var(--ink)" />
          </svg>

          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full" role="img" aria-label={copy.count(n)}>
            <defs>
              <radialGradient id="wheel-sheen" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Outer ring and its ticks, the techy part. */}
            <circle cx={C} cy={C} r={R + 18} fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
            {Array.from({ length: 72 }, (_, i) => {
              const a = (i * 5 * Math.PI) / 180;
              const long = i % 6 === 0;
              const r1 = R + 5;
              const r2 = R + (long ? 15 : 10);
              return (
                <line
                  key={i}
                  x1={C + r1 * Math.sin(a)}
                  y1={C - r1 * Math.cos(a)}
                  x2={C + r2 * Math.sin(a)}
                  y2={C - r2 * Math.cos(a)}
                  stroke="var(--accent)"
                  strokeOpacity={long ? 0.75 : 0.3}
                  strokeWidth={long ? 2 : 1}
                />
              );
            })}

            <g
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: `${C}px ${C}px`,
                transition: spinning ? `transform ${duration}ms cubic-bezier(0.1, 0.82, 0.12, 1)` : "none",
              }}
              onTransitionEnd={finish}
            >
              {n === 0 && <circle cx={C} cy={C} r={R} fill="var(--raised)" />}
              {options.map((label, i) => {
                const mid = ((i + 0.5) * 360) / n;
                // Labels on the left half would read upside down; turn them
                // the other way and anchor them at the rim instead.
                const flip = mid > 180;
                return (
                  <g key={`${label}-${i}`}>
                    <path d={slicePath(i, n, R, C)} fill={colourFor(i, n)} stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="1.5" />
                    <text
                      x={flip ? C - R + 16 : C + R - 16}
                      y={C}
                      transform={`rotate(${flip ? mid + 90 : mid - 90} ${C} ${C})`}
                      textAnchor={flip ? "start" : "end"}
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={labelSize(n)}
                      fontWeight={700}
                      className="font-mono"
                      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.25)", strokeWidth: 2 }}
                    >
                      {fit(label, n)}
                    </text>
                  </g>
                );
              })}
              <circle cx={C} cy={C} r={R} fill="url(#wheel-sheen)" pointerEvents="none" />
            </g>

            {/* Hub ring, drawn over the slices; the button sits on top of it. */}
            <circle cx={C} cy={C} r="52" fill="var(--ink)" stroke="var(--accent)" strokeOpacity="0.6" strokeWidth="2" />
          </svg>

          <button
            type="button"
            onClick={() => spin()}
            disabled={!canSpin}
            aria-label={n < 2 ? copy.needMore : copy.spin}
            className="absolute top-1/2 left-1/2 flex h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bright font-mono text-sm font-bold tracking-widest text-ink uppercase shadow-[0_0_24px_var(--accent)] transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:text-base"
          >
            {spinning ? "···" : copy.spin}
          </button>
        </div>

        <button
          type="button"
          onClick={() => spin()}
          disabled={!canSpin}
          className="mt-8 rounded-full bg-bright px-10 py-3.5 text-base font-bold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {spinning ? copy.spinning : n < 2 ? copy.needMore : copy.spin}
        </button>

        {history.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-[11px] tracking-wider text-body/70 uppercase">{copy.history}</span>
            {history.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  i === 0 ? "border-accent text-accent" : "border-line text-body"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* The winner, over the wheel. */}
        {winner && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-ink/55 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wheel-winner"
              className="w-full max-w-sm rounded-[28px] border border-line bg-surface p-6 text-center shadow-[0_24px_60px_var(--glass-shadow)] sm:p-8"
            >
              <p className="font-mono text-xs tracking-[0.25em] text-accent uppercase">{copy.winner}</p>
              <p
                id="wheel-winner"
                aria-live="assertive"
                className="text-gradient mt-3 text-4xl leading-tight font-extrabold tracking-tight break-words sm:text-5xl"
              >
                {winner.label}
              </p>
              <div className="mt-7 flex flex-col gap-2">
                <button
                  ref={againRef}
                  type="button"
                  onClick={() => spin()}
                  className="rounded-full bg-bright px-6 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90"
                >
                  {copy.again}
                </button>
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={removeAndSpin}
                    className="rounded-full border border-line bg-surface/60 px-6 py-3 text-sm font-semibold text-bright transition-colors hover:border-accent hover:text-accent"
                  >
                    {copy.removeAndSpin}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setWinner(null)}
                  className="px-6 py-2 text-sm text-body transition-colors hover:text-bright"
                >
                  {copy.close}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* The options */}
      <section className="glass rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-24">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add(draft);
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (text.includes("\n")) {
                event.preventDefault();
                add(text);
              }
            }}
            maxLength={MAX_LABEL}
            disabled={spinning}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
            className="min-w-0 flex-1 rounded-full border border-line bg-surface/70 px-4 py-2.5 text-base text-bright placeholder:text-body/60 focus:border-accent focus:outline-none sm:text-sm"
          />
          <button
            type="submit"
            disabled={spinning || !draft.trim()}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {copy.add}
          </button>
        </form>

        {note && <p className="mt-2 text-xs text-body">{note}</p>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-body/80">{copy.count(n)}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={shuffle}
              disabled={spinning || n < 2}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-body transition-colors hover:bg-bright/5 hover:text-bright disabled:opacity-40"
            >
              {copy.shuffle}
            </button>
            <button
              type="button"
              onClick={() => {
                setOptions([]);
                setWinner(null);
              }}
              disabled={spinning || n === 0}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-body transition-colors hover:bg-bright/5 hover:text-bright disabled:opacity-40"
            >
              {copy.clear}
            </button>
          </div>
        </div>

        <ul className="mt-3 flex max-h-[22rem] flex-wrap gap-2 overflow-y-auto pr-1">
          {options.map((label, i) => (
            <li
              key={`${label}-${i}`}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface/60 py-1 pr-1 pl-3 text-sm text-bright"
            >
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colourFor(i, n) }} />
              <span className="max-w-[12rem] truncate">{label}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={spinning}
                aria-label={`${copy.remove} ${label}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-body transition-colors hover:bg-bright/10 hover:text-bright disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
