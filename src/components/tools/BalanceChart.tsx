"use client";

import { useEffect, useRef, useState } from "react";
import type { MonthRow } from "@/lib/debt/payoff";

/**
 * Total balance, month by month: the plan against minimums only.
 *
 * Two series, so two slots: the plan takes the first categorical colour and the
 * comparison sits in muted grey, dashed, so the pair reads apart without colour
 * too. The readout above the chart replaces a floating tooltip, which a finger
 * on a phone would cover.
 */

/** Drawn at the width it is shown at, so 11px text stays 11px on a phone. */
const MAX_W = 720;
const PAD = { top: 12, right: 12, bottom: 28, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

/**
 * Axis labels like $250K. Written out rather than left to Intl's compact
 * notation, which Node and browsers round differently, and a server render
 * that says $100.0K under a client one that says $100K is a hydration error.
 */
function compact(v: number) {
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (v >= 1e6) return `$${trim(v / 1e6)}M`;
  if (v >= 1e3) return `$${trim(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

export function BalanceChart({
  plan,
  base,
  start,
  label,
  money,
  copy,
}: {
  plan: MonthRow[];
  base: MonthRow[];
  start: number;
  label: (month: number) => string;
  money: (n: number) => string;
  copy: { plan: string; baseline: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(MAX_W);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const H = W < 480 ? 220 : 260;
  const months = Math.max(plan.length, base.length, 1);
  const top = niceMax(Math.max(start, ...base.map((r) => r.balance)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (m: number) => PAD.left + (m / months) * iw;
  const y = (v: number) => PAD.top + ih - (v / top) * ih;

  const at = (rows: MonthRow[], m: number) => (m === 0 ? start : m <= rows.length ? rows[m - 1].balance : 0);
  const path = (rows: MonthRow[]) => {
    let d = `M${x(0)},${y(start)}`;
    for (const r of rows) d += `L${x(r.month).toFixed(1)},${y(r.balance).toFixed(1)}`;
    return d;
  };
  const planPath = path(plan);
  const area = `${planPath}L${x(plan.length)},${y(0)}L${x(0)},${y(0)}Z`;

  const yearsTotal = months / 12;
  const every = [1, 2, 5, 10].find((n) => yearsTotal / n <= (W < 480 ? 5 : 8)) ?? 10;
  const xTicks: number[] = [];
  for (let yr = 0; yr * 12 <= months; yr += every) xTicks.push(yr);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);

  const shownMonth = hover ?? null;

  return (
    <div ref={box} className="mt-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="flex items-center gap-2 text-bright">
          <span aria-hidden="true" className="h-0.5 w-5 rounded" style={{ backgroundColor: "var(--viz-model)" }} />
          {copy.plan}
          {shownMonth !== null && <span className="font-semibold tabular-nums">{money(at(plan, shownMonth))}</span>}
        </span>
        <span className="flex items-center gap-2 text-bright">
          <span aria-hidden="true" className="w-5 border-t-2 border-dashed" style={{ borderColor: "var(--viz-muted)" }} />
          {copy.baseline}
          {shownMonth !== null && <span className="font-semibold tabular-nums">{money(at(base, shownMonth))}</span>}
        </span>
        {shownMonth !== null && <span className="font-mono text-body/80">{shownMonth === 0 ? label(1) : label(shownMonth)}</span>}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block w-full touch-pan-y select-none"
        role="img"
        aria-label={`${copy.plan}: ${label(plan.length)}. ${copy.baseline}: ${label(base.length)}.`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const m = Math.round(((px - PAD.left) / iw) * months);
          setHover(Math.min(months, Math.max(0, m)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" />
            <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--color-body)" className="font-mono">
              {compact(v)}
            </text>
          </g>
        ))}
        {xTicks.map((yr) => (
          <text key={yr} x={x(yr * 12)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-body)" className="font-mono">
            {yr === 0 ? "0" : `${yr}y`}
          </text>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--viz-axis)" />

        <path d={area} fill="var(--viz-model)" fillOpacity="0.12" />
        <path d={path(base)} fill="none" stroke="var(--viz-muted)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={planPath} fill="none" stroke="var(--viz-model)" strokeWidth="2.5" strokeLinejoin="round" />

        {shownMonth !== null && (
          <g pointerEvents="none">
            <line x1={x(shownMonth)} x2={x(shownMonth)} y1={PAD.top} y2={y(0)} stroke="var(--viz-axis)" />
            <circle cx={x(shownMonth)} cy={y(at(base, shownMonth))} r="3.5" fill="var(--viz-muted)" />
            <circle cx={x(shownMonth)} cy={y(at(plan, shownMonth))} r="4" fill="var(--viz-model)" stroke="var(--color-surface)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </div>
  );
}
