"use client";

import { useEffect, useMemo, useState } from "react";
import { debtTool as copy } from "@/content/tools";
import {
  baseline,
  byYear,
  HORIZON,
  paymentFor,
  simulate,
  underwater,
  type Debt,
  type MonthRow,
  type PlanOptions,
  type Strategy,
} from "@/lib/debt/payoff";
import { BalanceChart } from "./BalanceChart";

/**
 * The debt payoff calculator.
 *
 * Inputs are held as the strings the reader typed, so clearing a field to type
 * a new number does not snap it to zero mid-edit; they become numbers only on
 * the way into the simulation. Everything is remembered in this browser.
 */

type Row = { id: string; name: string; balance: string; apr: string; minPayment: string };

type Saved = {
  debts: Row[];
  extraMonthly: string;
  lumpSum: string;
  lumpSumMonth: string;
  strategy: Strategy;
  rollover: boolean;
  start: string | null;
};

const STORAGE_KEY = "debt-payoff";
const MAX_DEBTS = 20;

const newId = () => Math.random().toString(36).slice(2, 10);

const toRow = (d: { name: string; balance: number; apr: number; minPayment: number }): Row => ({
  id: newId(),
  name: d.name,
  balance: String(d.balance),
  apr: String(d.apr),
  minPayment: String(d.minPayment),
});

function example(): Saved {
  return {
    debts: copy.example.debts.map(toRow),
    extraMonthly: String(copy.example.extraMonthly),
    lumpSum: "",
    lumpSumMonth: "1",
    strategy: "avalanche",
    rollover: true,
    start: null,
  };
}

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s%]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-11" plus n months, as "Dec 2026". Month 1 is the start month itself. */
function dateLabel(start: string | null, month: number): string | null {
  if (!start) return null;
  const [y, m] = start.split("-").map(Number);
  if (!y || !m) return null;
  return monthFmt.format(new Date(Date.UTC(y, m - 1 + month - 1, 1)));
}

function isSaved(value: unknown): value is Saved {
  if (!value || typeof value !== "object") return false;
  const v = value as Saved;
  return (
    Array.isArray(v.debts) &&
    v.debts.every((d) => d && typeof d.id === "string" && typeof d.balance === "string") &&
    typeof v.extraMonthly === "string" &&
    ["avalanche", "snowball", "listed"].includes(v.strategy)
  );
}

const field =
  "w-full min-w-0 rounded-lg border border-line bg-surface/70 px-2.5 py-2 sm:px-3 text-base text-bright tabular-nums placeholder:text-body/50 focus:border-accent focus:outline-none sm:text-sm";
const label = "font-mono text-[11px] tracking-[0.12em] text-body/70 uppercase";
const quiet =
  "rounded-full px-3 py-1.5 text-xs font-semibold text-body transition-colors hover:bg-bright/5 hover:text-bright disabled:opacity-40";

function Money({ value, placeholder, onChange, ariaLabel, percent = false }: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  percent?: boolean;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-body/60 ${percent ? "right-2.5 sm:right-3" : "left-2.5 sm:left-3"}`}
      >
        {percent ? "%" : "$"}
      </span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`${field} ${percent ? "pr-6 sm:pr-7" : "pl-5 sm:pl-6"}`}
      />
    </div>
  );
}

function Tile({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: "good" | "critical" }) {
  return (
    <div className="rounded-lg border border-line bg-raised/60 p-4">
      <p className={label}>{title}</p>
      <p
        className="mt-2 text-2xl font-semibold tracking-tight text-bright tabular-nums sm:text-3xl"
        style={tone ? { color: tone === "good" ? "var(--viz-good)" : "var(--viz-critical)" } : undefined}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-body/80">{hint}</p>}
    </div>
  );
}

export function DebtPayoff() {
  const [state, setState] = useState<Saved>(example);
  const [isExample, setIsExample] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"all" | string>("all");
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");

  // Read after hydration: the page is prerendered, so the build machine's
  // clock and an empty storage are what the server saw.
  useEffect(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let next: Saved | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (isSaved(saved)) next = saved;
    } catch {
      // Storage blocked or garbled. The example stands in.
    }
    /* eslint-disable react-hooks/set-state-in-effect -- reading storage and the clock after hydration */
    if (next) setIsExample(false);
    setState((s) => ({ ...(next ?? s), start: next?.start || thisMonth }));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded || isExample) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Not remembered this time.
    }
  }, [state, loaded, isExample]);

  const update = (patch: Partial<Saved>) => {
    setIsExample(false);
    setState((s) => ({ ...s, ...patch }));
  };
  const updateDebt = (id: string, patch: Partial<Row>) =>
    update({ debts: state.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const removeDebt = (id: string) => {
    if (view === id) setView("all");
    update({ debts: state.debts.filter((d) => d.id !== id) });
  };
  const moveDebt = (index: number, by: number) => {
    const debts = [...state.debts];
    const [item] = debts.splice(index, 1);
    debts.splice(index + by, 0, item);
    update({ debts });
  };
  const addPreset = (preset: (typeof copy.presets)[number]) => {
    if (state.debts.length >= MAX_DEBTS) return;
    const minPayment =
      "minPayment" in preset ? preset.minPayment : paymentFor(preset.balance, preset.apr, preset.termMonths);
    update({ debts: [...state.debts, toRow({ ...preset, minPayment: Math.ceil(minPayment) })] });
  };

  const debts: Debt[] = useMemo(
    () =>
      state.debts.map((d) => ({
        id: d.id,
        name: d.name.trim() || "Debt",
        balance: num(d.balance),
        apr: num(d.apr),
        minPayment: num(d.minPayment),
      })),
    [state.debts],
  );

  const options: PlanOptions = useMemo(
    () => ({
      strategy: state.strategy,
      extraMonthly: num(state.extraMonthly),
      lumpSum: num(state.lumpSum),
      lumpSumMonth: Math.max(1, Math.round(num(state.lumpSumMonth)) || 1),
      rollover: state.rollover,
    }),
    [state.strategy, state.extraMonthly, state.lumpSum, state.lumpSumMonth, state.rollover],
  );

  const plan = useMemo(() => simulate(debts, options), [debts, options]);
  const base = useMemo(() => baseline(debts), [debts]);
  const stuck = useMemo(() => new Set(underwater(debts)), [debts]);

  const owed = debts.reduce((s, d) => s + d.balance, 0);
  const monthly = debts.reduce((s, d) => s + (d.balance > 0 ? d.minPayment : 0), 0);
  const hasDebt = owed > 0;
  const span = copy.time.span;
  const when = (month: number) => dateLabel(state.start, month) ?? copy.time.month(month);

  const soonerMonths = plan.months !== null && base.months !== null ? base.months - plan.months : null;
  const saved = base.interest - plan.interest;
  const soonerValue =
    plan.months === null
      ? copy.results.never
      : base.months === null
        ? copy.results.finishes
        : soonerMonths! > 0
          ? span(soonerMonths!)
          : copy.results.same;

  // The schedule shown: every debt summed, or one of them.
  const viewIndex = view === "all" ? -1 : debts.findIndex((d) => d.id === view);
  const rows: MonthRow[] = period === "yearly" ? byYear(plan.rows) : plan.rows;
  const lastActive =
    viewIndex < 0 ? rows.length : rows.findIndex((r) => r.debts[viewIndex].balance === 0) + 1 || rows.length;
  const shown = rows.slice(0, lastActive).map((r) => (viewIndex < 0 ? { ...r } : { ...r, ...r.debts[viewIndex] }));

  const downloadCsv = () => {
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const head = ["Month", "Date", "Payment", "Principal", "Interest", "Balance"];
    for (const d of debts) head.push(...["payment", "principal", "interest", "balance"].map((c) => `${d.name} ${c}`));
    const lines = [head.map(quote).join(",")];
    for (const r of plan.rows) {
      const cells = [String(r.month), dateLabel(state.start, r.month) ?? "", ...[r.payment, r.principal, r.interest, r.balance].map((n) => n.toFixed(2))];
      for (const d of r.debts) cells.push(...[d.payment, d.principal, d.interest, d.balance].map((n) => n.toFixed(2)));
      lines.push(cells.map(quote).join(","));
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = copy.schedule.file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* What you owe */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-bright">{copy.debts.title}</h2>
          <div className="flex gap-1">
            <button type="button" className={quiet} onClick={() => { setState({ ...example(), start: state.start }); setIsExample(true); setView("all"); try { localStorage.removeItem(STORAGE_KEY); } catch {} }}>
              {copy.debts.reset}
            </button>
            <button type="button" className={quiet} disabled={state.debts.length === 0} onClick={() => { setView("all"); update({ debts: [] }); }}>
              {copy.debts.clear}
            </button>
          </div>
        </div>

        {isExample && <p className="mt-2 text-sm text-accent">{copy.example.banner}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={label}>{copy.debts.add}</span>
          {copy.presets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => addPreset(p)}
              disabled={state.debts.length >= MAX_DEBTS}
              className="rounded-full border border-line bg-surface/60 px-3 py-1 text-sm text-bright transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            >
              + {p.name}
            </button>
          ))}
        </div>
        {state.debts.length >= MAX_DEBTS && <p className="mt-2 text-xs text-body">{copy.debts.max(MAX_DEBTS)}</p>}

        {state.debts.length === 0 ? (
          <p className="mt-6 text-sm text-body">{copy.debts.empty}</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            <li aria-hidden="true" className="hidden grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_4.5rem] gap-3 px-1 sm:grid">
              <span className={label}>{copy.debts.name}</span>
              <span className={label}>{copy.debts.balance}</span>
              <span className={label}>{copy.debts.apr}</span>
              <span className={label}>{copy.debts.minPayment}</span>
            </li>
            {state.debts.map((d, i) => (
              <li key={d.id} className="rounded-xl border border-line/70 bg-surface/40 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_4.5rem] sm:gap-3">
                  <div className="order-1 col-span-2 flex gap-2 sm:order-none sm:col-span-1">
                    <input
                      value={d.name}
                      maxLength={40}
                      aria-label={copy.debts.name}
                      onChange={(e) => updateDebt(d.id, { name: e.target.value })}
                      className={field}
                    />
                  </div>
                  <label className="order-3 flex flex-col gap-1 sm:order-none">
                    <span className={`${label} sm:hidden`}>{copy.debts.balance}</span>
                    <Money value={d.balance} ariaLabel={`${d.name} ${copy.debts.balance}`} onChange={(v) => updateDebt(d.id, { balance: v })} />
                  </label>
                  <label className="order-3 flex flex-col gap-1 sm:order-none">
                    <span className={`${label} sm:hidden`}>{copy.debts.aprShort}</span>
                    <Money percent value={d.apr} ariaLabel={`${d.name} ${copy.debts.apr}`} onChange={(v) => updateDebt(d.id, { apr: v })} />
                  </label>
                  <label className="order-3 flex flex-col gap-1 sm:order-none">
                    <span className={`${label} sm:hidden`}>{copy.debts.minPaymentShort}</span>
                    <Money value={d.minPayment} ariaLabel={`${d.name} ${copy.debts.minPayment}`} onChange={(v) => updateDebt(d.id, { minPayment: v })} />
                  </label>
                  <div className="order-2 flex items-center justify-end gap-0.5 sm:order-none">
                    {state.strategy === "listed" && (
                      <>
                        <button type="button" aria-label={`${copy.debts.moveUp} ${d.name}`} disabled={i === 0} onClick={() => moveDebt(i, -1)} className={`${quiet} px-2`}>
                          ↑
                        </button>
                        <button type="button" aria-label={`${copy.debts.moveDown} ${d.name}`} disabled={i === state.debts.length - 1} onClick={() => moveDebt(i, 1)} className={`${quiet} px-2`}>
                          ↓
                        </button>
                      </>
                    )}
                    <button type="button" aria-label={`${copy.debts.remove} ${d.name}`} onClick={() => removeDebt(d.id)} className={`${quiet} px-2.5 text-base`}>
                      ×
                    </button>
                  </div>
                </div>
                {stuck.has(d.id) && (
                  <p className="mt-1.5 flex gap-2 text-xs text-bright">
                    <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--viz-critical)" }} />
                    {copy.debts.underwater}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasDebt && (
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-1 border-t border-line/60 pt-4 text-sm">
            <div className="flex gap-2"><dt className="text-body/80">{copy.debts.total}</dt><dd className="font-semibold text-bright tabular-nums">{money0.format(owed)}</dd></div>
            <div className="flex gap-2"><dt className="text-body/80">{copy.debts.monthly}</dt><dd className="font-semibold text-bright tabular-nums">{money0.format(monthly)}</dd></div>
          </dl>
        )}
      </section>

      {/* Your plan */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <h2 className="text-xl font-bold tracking-tight text-bright">{copy.plan.title}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={label}>{copy.plan.extra}</span>
            <Money value={state.extraMonthly} placeholder="0" ariaLabel={copy.plan.extra} onChange={(v) => update({ extraMonthly: v })} />
            <span className="text-xs text-body/70">{copy.plan.extraHint}</span>
          </label>
          <div className="flex flex-col gap-1">
            <span className={label}>{copy.plan.lump}</span>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
              <Money value={state.lumpSum} placeholder="0" ariaLabel={copy.plan.lump} onChange={(v) => update({ lumpSum: v })} />
              <input
                inputMode="numeric"
                value={state.lumpSumMonth}
                aria-label={copy.plan.lumpMonth}
                title={copy.plan.lumpMonth}
                onChange={(e) => update({ lumpSumMonth: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                className={field}
              />
            </div>
            <span className="text-xs text-body/70">
              {copy.plan.lumpHint} {copy.plan.lumpMonth} {options.lumpSumMonth}
              {dateLabel(state.start, options.lumpSumMonth) ? ` (${dateLabel(state.start, options.lumpSumMonth)})` : ""}
            </span>
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>{copy.plan.start}</span>
            <input
              type="month"
              value={state.start ?? ""}
              onChange={(e) => e.target.value && update({ start: e.target.value })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>{copy.plan.strategy}</span>
            <select
              value={state.strategy}
              onChange={(e) => update({ strategy: e.target.value as Strategy })}
              className={field}
            >
              {(Object.keys(copy.plan.strategies) as Strategy[]).map((k) => (
                <option key={k} value={k}>{copy.plan.strategies[k].label}</option>
              ))}
            </select>
            <span className="text-xs text-body/70">{copy.plan.strategies[state.strategy].hint}</span>
          </label>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-bright">
          <input
            type="checkbox"
            checked={state.rollover}
            onChange={(e) => update({ rollover: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          {copy.plan.rollover}
        </label>
      </section>

      {/* Results */}
      {!hasDebt ? (
        <p className="glass rounded-[28px] p-6 text-sm">{copy.results.nothing}</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
            {plan.months === null ? (
              <Tile title={copy.results.debtFree} value={copy.results.never} hint={copy.results.neverHint} tone="critical" />
            ) : (
              <Tile title={copy.results.debtFree} value={when(plan.months)} hint={copy.results.debtFreeIn(span(plan.months))} />
            )}
            <Tile title={copy.results.interest} value={money0.format(plan.interest)} hint={copy.results.interestHint(money0.format(plan.paid))} />
            <Tile
              title={copy.results.sooner}
              value={soonerValue}
              hint={base.months === null ? copy.results.soonerNever : copy.results.soonerHint(span(base.months))}
              tone={soonerMonths !== null && soonerMonths > 0 ? "good" : undefined}
            />
            <Tile
              title={copy.results.saved}
              value={plan.months === null ? copy.results.never : money0.format(Math.max(0, saved))}
              hint={copy.results.savedHint}
              tone={plan.months !== null && saved >= 1 ? "good" : undefined}
            />
          </section>

          <section className="glass rounded-[28px] p-5 sm:p-6">
            <h2 className="text-xl font-bold tracking-tight text-bright">{copy.chart.title}</h2>
            <BalanceChart plan={plan.rows} base={base.rows} start={plan.startingBalance} label={when} money={money0.format} copy={copy.chart} />
          </section>

          <section className="glass rounded-[28px] p-5 sm:p-6">
            <h2 className="text-xl font-bold tracking-tight text-bright">{copy.order.title}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {Object.values(copy.order.columns).map((c, i) => (
                      <th key={c} className={`py-2 font-mono text-[11px] font-normal tracking-[0.12em] text-body/70 uppercase ${i ? "text-right" : ""}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {debts
                    .map((d, i) => ({ d, r: plan.debts[i], b: base.debts[i] }))
                    .filter(({ d }) => d.balance > 0)
                    .sort((a, b) => (a.r.payoffMonth ?? Infinity) - (b.r.payoffMonth ?? Infinity))
                    .map(({ d, r, b }) => {
                      const gain = r.payoffMonth !== null && b.payoffMonth !== null ? b.payoffMonth - r.payoffMonth : null;
                      return (
                        <tr key={d.id} className="border-b border-line/50">
                          <td className="py-2 pr-3 text-bright">{d.name}</td>
                          <td className="py-2 text-right tabular-nums">{r.payoffMonth === null ? copy.order.never : when(r.payoffMonth)}</td>
                          <td className="py-2 text-right tabular-nums">{money0.format(r.interest)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {r.payoffMonth !== null && b.payoffMonth === null ? copy.results.soonerNever : gain && gain > 0 ? span(gain) : "·"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight text-bright">{copy.schedule.title}</h2>
              <button type="button" onClick={downloadCsv} className="wheel-cta rounded-full px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90">
                {copy.schedule.download}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select value={viewIndex < 0 ? "all" : view} onChange={(e) => setView(e.target.value)} aria-label={copy.schedule.title} className="min-w-0 rounded-lg border border-line bg-surface/70 px-3 py-2 text-base text-bright focus:border-accent focus:outline-none sm:text-sm">
                <option value="all">{copy.schedule.all}</option>
                {debts.filter((d) => d.balance > 0).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div role="group" className="flex rounded-full border border-line p-0.5">
                {(["yearly", "monthly"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={period === p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${period === p ? "bg-accent text-surface" : "text-body hover:text-bright"}`}
                  >
                    {copy.schedule[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 max-h-[32rem] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="sticky top-0 bg-raised">
                  <tr className="text-right">
                    {[period === "yearly" ? copy.schedule.columns.year : copy.schedule.columns.period, copy.schedule.columns.payment, copy.schedule.columns.principal, copy.schedule.columns.interest, copy.schedule.columns.balance].map((c, i) => (
                      <th key={c} className={`px-3 py-2 font-mono text-[11px] font-normal tracking-[0.12em] text-body/70 uppercase ${i ? "" : "text-left"}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const first = period === "yearly" ? (r.month - 1) * 12 + 1 : r.month;
                    const dated = dateLabel(state.start, first);
                    return (
                      <tr key={r.month} className="border-t border-line/50 text-right tabular-nums">
                        <td className="px-3 py-1.5 text-left text-bright">
                          {period === "yearly" ? copy.time.year(r.month) : copy.time.month(r.month)}
                          {dated && <span className="ml-2 text-xs text-body/70">{dated}</span>}
                        </td>
                        <td className="px-3 py-1.5">{money2.format(r.payment)}</td>
                        <td className="px-3 py-1.5">{money2.format(r.principal)}</td>
                        <td className="px-3 py-1.5">{money2.format(r.interest)}</td>
                        <td className="px-3 py-1.5 text-bright">{r.balance === 0 ? copy.schedule.paidOff : money2.format(r.balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {plan.months === null && <p className="mt-3 text-xs text-body">{copy.schedule.cut(HORIZON / 12)}</p>}
          </section>
        </>
      )}

      <p className="text-xs text-body/70">{copy.privacy}</p>
    </div>
  );
}
