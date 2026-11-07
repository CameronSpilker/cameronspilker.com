"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { diceTool as copy } from "@/content/tools";
import {
  DEFAULT_COLOURS,
  DIE_SIDES,
  MAX_GROUPS,
  MAX_PER_GROUP,
  clampCount,
  normalizeHex,
  notation,
  parseSavedGroups,
  rollGroups,
  shapeKey,
  type DiceGroup,
  type RollResult,
} from "@/lib/dice/roll";
import { kindsFor, labelsForValue, type SolidKind } from "@/lib/dice/solids";
import { Die } from "./Die";

const STORAGE_KEY = "dice-sets";

/**
 * How long a throw takes, longest die included. The result is already decided
 * when it starts; this is only how long the total waits to appear.
 */
const ROLL_MS = 1400;

/** Space between dice, in pixels. Matches the tray's gap-3. */
const GAP = 12;

/** The table on a first visit: one ordinary six sided die. */
const START: DiceGroup[] = [{ id: 1, sides: 6, count: 1, colour: DEFAULT_COLOURS[0] }];

/** Kinds offered first when someone adds a set, most asked for first. */
const ADD_ORDER = [20, 6, 8, 10, 12, 4, 100] as const;

type HistoryEntry = { id: number; what: string; total: number };

/**
 * Smaller dice the more of them there are, and never wider than the tray
 * allows, so a big roll still fits a phone. Up to 3 dice share a row, then 4,
 * 5 and 6.
 */
function dieSize(count: number, width: number): number {
  const [base, cols] = count <= 3 ? [120, 3] : count <= 8 ? [92, 4] : count <= 20 ? [70, 5] : [54, 6];
  if (width <= 0) return base;
  const perRow = Math.min(count, cols);
  return Math.max(36, Math.min(base, Math.floor((width - GAP * (perRow - 1)) / perRow)));
}

/** Identifies one physical die on the table. A d100 is two of them. */
const dieKey = (group: DiceGroup, j: number, kind: SolidKind) => `${group.id}-${group.sides}-${j}-${kind}`;

export function DiceRoller() {
  const [groups, setGroups] = useState<DiceGroup[]>(START);
  const [result, setResult] = useState<RollResult | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [throwId, setThrowId] = useState(0);
  const [trayWidth, setTrayWidth] = useState(0);
  const tray = useRef<HTMLButtonElement | null>(null);
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(2);
  const historyId = useRef(1);
  const rollingRef = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  // The table is remembered in this browser only, so a reload keeps the dice.
  useEffect(() => {
    try {
      const saved = parseSavedGroups(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
      if (saved) {
        nextId.current = saved.length + 1;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading storage after hydration
        setGroups(saved);
      }
    } catch {
      // Storage can be blocked or hold junk. The single d6 stands in.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(groups.map(({ sides, count, colour }) => ({ sides, count, colour }))),
      );
    } catch {
      // Not remembered this time, which is fine.
    }
  }, [groups]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Dice are sized to the tray, so watch how wide it is.
  useEffect(() => {
    const el = tray.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setTrayWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const key = shapeKey(groups);
  const what = notation(groups);
  const totalDice = groups.reduce((n, g) => n + g.count, 0);
  const current = result && result.key === key ? result : null;

  const land = useCallback(
    (rolled: RollResult, label: string) => {
      setResult(rolled);
      setLanded((n) => n + 1);
      setHistory((past) => [{ id: historyId.current++, what: label, total: rolled.total }, ...past].slice(0, 8));
      // One set needs no labels ("4, 5"); several do ("2d6 4, 5; 1d20 17").
      const faces =
        rolled.groups.length === 1
          ? rolled.groups[0].values.join(", ")
          : rolled.groups.map((g) => `${g.values.length}d${g.sides} ${g.values.join(", ")}`).join("; ");
      setAnnouncement(copy.announce(label, faces, rolled.total));
    },
    [],
  );

  const roll = () => {
    if (rollingRef.current) return;
    // Decided here, in full, before anything moves.
    const rolled = rollGroups(groups);
    const faces: Record<string, string> = {};
    groups.forEach((group, g) => {
      rolled.groups[g].values.forEach((value, j) => {
        for (const die of labelsForValue(group.sides, value)) faces[dieKey(group, j, die.kind)] = die.label;
      });
    });
    setShown(faces);
    setThrowId((n) => n + 1);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      land(rolled, what);
      return;
    }
    rollingRef.current = true;
    setRolling(true);
    timer.current = window.setTimeout(() => {
      rollingRef.current = false;
      setRolling(false);
      land(rolled, what);
    }, ROLL_MS);
  };

  const update = (id: number, patch: Partial<Omit<DiceGroup, "id">>) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const remove = (id: number) => {
    setGroups((list) => (list.length > 1 ? list.filter((g) => g.id !== id) : list));
  };

  const add = () => {
    setGroups((list) => {
      if (list.length >= MAX_GROUPS) return list;
      const sides = ADD_ORDER.find((s) => !list.some((g) => g.sides === s)) ?? 6;
      const colour =
        DEFAULT_COLOURS.find((c) => !list.some((g) => g.colour === c)) ?? DEFAULT_COLOURS[list.length % DEFAULT_COLOURS.length];
      return [...list, { id: nextId.current++, sides, count: 1, colour }];
    });
  };

  // Every physical die on the table, in order, with the face it last landed on.
  const dice = useMemo(() => {
    const out: { key: string; kind: SolidKind; colour: string; label: string | null }[] = [];
    for (const group of groups) {
      for (let j = 0; j < group.count; j++) {
        for (const kind of kindsFor(group.sides)) {
          const key = dieKey(group, j, kind);
          out.push({ key, kind, colour: group.colour, label: shown[key] ?? null });
        }
      }
    }
    return out;
  }, [groups, shown]);

  const size = dieSize(dice.length, trayWidth);
  const single = totalDice === 1;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        {/* The table */}
        <section className="glass flex flex-col items-center rounded-[28px] px-4 py-6 sm:px-8 sm:py-10">
          <button
            ref={tray}
            type="button"
            onClick={roll}
            aria-label={copy.rollAria(what)}
            className="group flex min-h-[11rem] w-full touch-manipulation items-center justify-center rounded-[22px] p-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:min-h-[15rem]"
          >
            <span className="flex flex-wrap items-center justify-center gap-3">
              {dice.map((die, i) => (
                <Die
                  key={die.key}
                  kind={die.kind}
                  label={die.label}
                  colour={die.colour}
                  size={size}
                  throwId={throwId}
                  index={i}
                  glow={!rolling && die.kind === "d20" && die.label === "20"}
                />
              ))}
            </span>
          </button>

          {/* The result. Same height whether rolled or not, so nothing jumps. */}
          <div className="mt-6 flex min-h-[7.5rem] w-full flex-col items-center justify-start text-center">
            {current && !rolling ? (
              <>
                <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
                  {single ? what : copy.total}
                </p>
                <p key={landed} className="dice-total text-gradient mt-1 text-6xl leading-none font-extrabold tracking-tight sm:text-7xl">
                  {current.total}
                </p>
                <Breakdown groups={groups} result={current} />
              </>
            ) : (
              <>
                <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{what}</p>
                <p className="mt-3 text-sm text-body">{rolling ? copy.rolling : copy.ready}</p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={roll}
            className="wheel-cta mt-2 w-full max-w-xs touch-manipulation rounded-full px-10 py-3.5 text-base font-bold transition-transform hover:scale-[1.03] active:scale-95"
          >
            {rolling ? copy.rolling : copy.roll}
          </button>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          {history.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono text-[11px] tracking-wider text-body/70 uppercase">{copy.history}</span>
              {history.map((entry, i) => (
                <span
                  key={entry.id}
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${
                    i === 0 ? "border-accent text-accent" : "border-line text-body"
                  }`}
                >
                  {entry.what} · {entry.total}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setHistory([])}
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-body transition-colors hover:bg-bright/5 hover:text-bright"
              >
                {copy.clearHistory}
              </button>
            </div>
          )}
        </section>

        {/* The dice to roll */}
        <section className="glass rounded-[28px] p-4 sm:p-6 lg:sticky lg:top-24">
          <fieldset disabled={rolling} className="grid gap-4">
            {groups.map((group, index) => (
              <GroupEditor
                key={group.id}
                group={group}
                index={index}
                canRemove={groups.length > 1}
                onChange={(patch) => update(group.id, patch)}
                onRemove={() => remove(group.id)}
              />
            ))}

            {groups.length < MAX_GROUPS && (
              <button
                type="button"
                onClick={add}
                className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm font-semibold text-body transition-colors hover:border-accent hover:text-accent"
              >
                + {copy.add}
              </button>
            )}
            <p className="text-xs text-body/80">{copy.limits(MAX_PER_GROUP, MAX_GROUPS)}</p>
          </fieldset>
        </section>
      </div>

      <p className="text-sm text-body">
        <span className="font-semibold text-bright">{copy.fairness.title}.</span> {copy.fairness.body}
      </p>
    </div>
  );
}

/** How each set added up, and the natural 20 or 1 a single d20 deserves. */
function Breakdown({ groups, result }: { groups: DiceGroup[]; result: RollResult }) {
  const multi = groups.length > 1 || groups[0].count > 1;
  const nat = (sides: number, values: number[]) =>
    sides === 20 && values.length === 1 ? (values[0] === 20 ? copy.natural20 : values[0] === 1 ? copy.natural1 : null) : null;

  if (!multi) {
    const g = result.groups[0];
    const label = nat(g.sides, g.values);
    return label ? <p className="mt-2 text-sm font-bold text-accent">{label}</p> : null;
  }

  return (
    <ul className="mt-3 flex max-w-full flex-col items-center gap-1 text-sm">
      {result.groups.map((g, i) => {
        const label = nat(g.sides, g.values);
        return (
          <li key={groups[i].id} className="flex max-w-full flex-wrap items-center justify-center gap-x-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border border-line" style={{ backgroundColor: groups[i].colour }} />
            <span className="font-mono font-semibold text-bright">
              {g.values.length}d{g.sides}
            </span>
            <span className="font-mono break-all text-body">
              {g.values.length > 1 ? `${g.values.join(" + ")} = ${g.sum}` : g.sum}
            </span>
            {label && <span className="font-bold text-accent">{label}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function GroupEditor({
  group,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  group: DiceGroup;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<DiceGroup, "id">>) => void;
  onRemove: () => void;
}) {
  // What is in a text box while someone types in it. Null means "show the
  // real value", which is every moment the box is not being edited.
  const [countDraft, setCountDraft] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const base = `set-${group.id}`;

  const commitCount = () => {
    if (countDraft !== null && countDraft !== "") onChange({ count: clampCount(parseInt(countDraft, 10)) });
    setCountDraft(null);
  };

  const commitHex = () => {
    const hex = hexDraft === null ? null : normalizeHex(hexDraft);
    if (hex) onChange({ colour: hex });
    setHexDraft(null);
  };

  const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4" role="group" aria-labelledby={`${base}-title`}>
      <div className="flex items-center justify-between gap-3">
        <p id={`${base}-title`} className="flex items-center gap-2 text-sm font-semibold text-bright">
          <span aria-hidden="true" className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: group.colour }} />
          {copy.set(index + 1)}
          <span className="font-mono text-body">
            {group.count}d{group.sides}
          </span>
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-body transition-colors hover:bg-bright/5 hover:text-bright"
          >
            {copy.remove}
          </button>
        )}
      </div>

      {/* Kind of die */}
      <p id={`${base}-type`} className="mt-4 text-xs font-semibold text-body">
        {copy.type}
      </p>
      <div role="radiogroup" aria-labelledby={`${base}-type`} className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7 lg:grid-cols-4">
        {DIE_SIDES.map((sides) => (
          <label key={sides} className="relative">
            <input
              type="radio"
              name={`${base}-sides`}
              value={sides}
              checked={group.sides === sides}
              onChange={() => onChange({ sides })}
              className="peer sr-only"
            />
            <span className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-line font-mono text-sm font-semibold text-body transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:border-accent">
              d{sides}
            </span>
          </label>
        ))}
      </div>

      {/* How many */}
      <label htmlFor={`${base}-count`} className="mt-4 block text-xs font-semibold text-body">
        {copy.count}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ count: clampCount(group.count - 1) })}
          disabled={group.count <= 1}
          aria-label={copy.fewer}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-lg font-bold text-bright transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-bright"
        >
          −
        </button>
        <input
          id={`${base}-count`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={countDraft ?? String(group.count)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
            setCountDraft(digits);
            const n = parseInt(digits, 10);
            if (n >= 1 && n <= MAX_PER_GROUP) onChange({ count: n });
          }}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commitCount}
          onKeyDown={blurOnEnter}
          className="h-10 w-16 rounded-full border border-line bg-surface/70 text-center font-mono text-base font-semibold text-bright focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange({ count: clampCount(group.count + 1) })}
          disabled={group.count >= MAX_PER_GROUP}
          aria-label={copy.more}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-lg font-bold text-bright transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-bright"
        >
          +
        </button>
      </div>

      {/* Colour */}
      <label htmlFor={`${base}-hex`} className="mt-4 block text-xs font-semibold text-body">
        {copy.colour}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <label
          className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line shadow-inner focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
          style={{ backgroundColor: group.colour }}
        >
          <span className="sr-only">{copy.pick}</span>
          <input
            type="color"
            value={group.colour}
            onChange={(event) => {
              const hex = normalizeHex(event.target.value);
              if (hex) onChange({ colour: hex });
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          id={`${base}-hex`}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={7}
          aria-label={copy.hex}
          value={hexDraft ?? group.colour}
          onChange={(event) => {
            const value = event.target.value;
            setHexDraft(value);
            // Apply as soon as six digits are in. Three digits wait for the
            // box to lose focus, or "#abc" would flash on the way to "#abcdef".
            if (/^#?[0-9a-f]{6}$/i.test(value.trim())) {
              const hex = normalizeHex(value);
              if (hex) onChange({ colour: hex });
            }
          }}
          onBlur={commitHex}
          onKeyDown={blurOnEnter}
          className="h-10 w-28 rounded-full border border-line bg-surface/70 px-4 font-mono text-base text-bright focus:border-accent focus:outline-none sm:text-sm"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {copy.swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => {
              setHexDraft(null);
              onChange({ colour: hex });
            }}
            aria-label={copy.swatch(hex)}
            aria-pressed={group.colour === hex}
            className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
              group.colour === hex ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-surface" : "border-bright/25"
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
}
