"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Run, RunNode } from "@/lib/dbt/parse";
import type { Summary } from "@/lib/dbt/metrics";
import { formatDuration, formatOffset, formatTimestamp } from "@/lib/dbt/format";
import { nodeColor, type ColorMode } from "@/lib/dbt/viz";
import { runResultsTool as copy } from "@/content/tools";

const GUTTER = 108;
const ROW_HEIGHT = 26;
const BAR_HEIGHT = 14;
const TOP_PAD = 26;
const AXIS_HEIGHT = 26;
const OVERVIEW_HEIGHT = 54;
const RIGHT_PAD = 16;

/** Tick steps in ms, coarse enough that labels never collide at any zoom. */
const TICK_STEPS = [
  100, 250, 500, 1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000,
  900_000, 1_800_000, 3_600_000,
];

function tickStep(spanMs: number, targetCount: number): number {
  const rough = spanMs / targetCount;
  return TICK_STEPS.find((step) => step >= rough) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

type View = { start: number; end: number };

export function Timeline({
  run,
  summary,
  colorMode,
  query,
  onlyFailures,
  selected,
  onSelect,
}: {
  run: Run;
  summary: Summary;
  colorMode: ColorMode;
  query: string;
  onlyFailures: boolean;
  selected: RunNode | null;
  onSelect: (node: RunNode | null) => void;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ node: RunNode; x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; view: View } | null>(null);

  const bounds = useMemo<View>(
    () => ({ start: run.startedAt ?? 0, end: run.completedAt ?? 1 }),
    [run.startedAt, run.completedAt],
  );
  const current = view ?? bounds;
  const span = Math.max(1, current.end - current.start);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(120, width - GUTTER - RIGHT_PAD);
  const rows = run.threads;
  const height = TOP_PAD + rows.length * ROW_HEIGHT + AXIS_HEIGHT;

  const toX = useCallback(
    (time: number) => GUTTER + ((time - current.start) / span) * plotWidth,
    [current.start, span, plotWidth],
  );

  const matches = useCallback(
    (node: RunNode) => {
      if (onlyFailures && node.outcome !== "fail" && node.outcome !== "warn") return false;
      if (!query) return true;
      return node.uniqueId.toLowerCase().includes(query.trim().toLowerCase());
    },
    [onlyFailures, query],
  );

  // Only what is on screen gets a rect. A twenty thousand node run stays
  // responsive because the DOM never holds more than a screen of bars.
  const visible = useMemo(
    () => run.timed.filter((node) => (node.completedAt ?? 0) >= current.start && (node.startedAt ?? 0) <= current.end),
    [run.timed, current.start, current.end],
  );

  const ticks = useMemo(() => {
    const step = tickStep(span, Math.max(3, Math.floor(plotWidth / 110)));
    const first = Math.ceil((current.start - bounds.start) / step) * step + bounds.start;
    const out: number[] = [];
    for (let time = first; time <= current.end; time += step) out.push(time);
    return out;
  }, [span, plotWidth, current.start, current.end, bounds.start]);

  const clamp = useCallback(
    (next: View): View => {
      const width = Math.min(bounds.end - bounds.start, Math.max(200, next.end - next.start));
      let start = Math.max(bounds.start, Math.min(next.start, bounds.end - width));
      if (start + width > bounds.end) start = bounds.end - width;
      return { start, end: start + width };
    },
    [bounds.start, bounds.end],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      // Trackpad pinch arrives as a wheel event with ctrlKey set, so this reads
      // as pinch to zoom without stealing ordinary page scrolling.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - GUTTER) / plotWidth));
      const anchor = current.start + ratio * span;
      const factor = Math.exp(event.deltaY * 0.002);
      setView(
        clamp({
          start: anchor - (anchor - current.start) * factor,
          end: anchor + (current.end - anchor) * factor,
        }),
      );
    },
    [clamp, current.start, current.end, span, plotWidth],
  );

  const msPerPixel = span / plotWidth;

  return (
    <div ref={frame} className="relative w-full">
      <svg
        role="img"
        aria-label={copy.chart.title}
        width={width}
        height={height}
        onWheel={onWheel}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = { pointerId: event.pointerId, x: event.clientX, view: current };
          setPanning(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const shift = (event.clientX - state.x) * msPerPixel;
          setView(clamp({ start: state.view.start - shift, end: state.view.end - shift }));
        }}
        onPointerUp={() => {
          drag.current = null;
          setPanning(false);
        }}
        onPointerLeave={() => {
          drag.current = null;
          setPanning(false);
          setHover(null);
        }}
        className="touch-none select-none"
        style={{ cursor: panning ? "grabbing" : "grab" }}
      >
        {/* The stretch where the run was down to one thread. Named, because an
            unexplained shaded band is worse than no band. */}
        {summary.longestSoloStart !== null && summary.longestSoloMs > span * 0.04 && (
          <g>
            {/* A slim marker over the rows rather than a wash across them. A
                shaded block behind the bars competes with the bars. */}
            <rect
              x={Math.max(GUTTER, toX(summary.longestSoloStart))}
              y={TOP_PAD - 5}
              width={Math.max(
                2,
                toX(summary.longestSoloStart + summary.longestSoloMs) -
                  Math.max(GUTTER, toX(summary.longestSoloStart)),
              )}
              height={3}
              rx={1.5}
              fill="var(--viz-warning)"
            />
            <text
              x={Math.max(GUTTER, toX(summary.longestSoloStart))}
              y={TOP_PAD - 10}
              className="fill-body font-mono text-[10px]"
            >
              {copy.chart.soloBand} · {formatDuration(summary.longestSoloMs)}
            </text>
          </g>
        )}

        {ticks.map((tick) => (
          <line
            key={tick}
            x1={toX(tick)}
            x2={toX(tick)}
            y1={TOP_PAD}
            y2={TOP_PAD + rows.length * ROW_HEIGHT}
            stroke="var(--viz-grid)"
            strokeWidth={1}
          />
        ))}

        {rows.map((thread, index) => (
          <text
            key={thread}
            x={GUTTER - 12}
            y={TOP_PAD + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
            textAnchor="end"
            className="fill-body font-mono text-[11px]"
          >
            {thread}
          </text>
        ))}

        <g
          onPointerMove={(event) => {
            const key = (event.target as SVGElement).dataset?.node;
            if (!key) return setHover(null);
            const node = run.timed.find((item) => item.key === key);
            if (!node) return setHover(null);
            const rect = frame.current?.getBoundingClientRect();
            setHover({
              node,
              x: event.clientX - (rect?.left ?? 0),
              y: event.clientY - (rect?.top ?? 0),
            });
          }}
          onClick={(event) => {
            const key = (event.target as SVGElement).dataset?.node;
            const node = key ? (run.timed.find((item) => item.key === key) ?? null) : null;
            onSelect(node && node.key === selected?.key ? null : node);
          }}
        >
          {visible.map((node) => {
            const row = rows.indexOf(node.thread);
            if (row < 0) return null;
            const x = toX(node.startedAt as number);
            const end = toX(node.completedAt as number);
            const isSelected = selected?.key === node.key;
            return (
              <rect
                key={node.key}
                data-node={node.key}
                x={Math.max(GUTTER, x)}
                y={TOP_PAD + row * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                width={Math.max(2, Math.min(end, GUTTER + plotWidth) - Math.max(GUTTER, x))}
                height={BAR_HEIGHT}
                rx={2}
                fill={nodeColor(node, colorMode)}
                opacity={matches(node) ? 1 : 0.16}
                stroke={isSelected ? "var(--color-bright)" : undefined}
                strokeWidth={isSelected ? 2 : undefined}
              />
            );
          })}
        </g>

        <line
          x1={GUTTER}
          x2={GUTTER + plotWidth}
          y1={TOP_PAD + rows.length * ROW_HEIGHT}
          y2={TOP_PAD + rows.length * ROW_HEIGHT}
          stroke="var(--viz-axis)"
        />
        {ticks.map((tick) => (
          <text
            key={tick}
            x={toX(tick)}
            y={TOP_PAD + rows.length * ROW_HEIGHT + 16}
            textAnchor="middle"
            className="fill-body font-mono text-[10px] tabular-nums"
          >
            {formatOffset(tick - bounds.start)}
          </text>
        ))}
      </svg>

      <Overview
        run={run}
        summary={summary}
        width={width}
        view={current}
        bounds={bounds}
        onChange={(next) => setView(clamp(next))}
      />

      {hover && <Tooltip node={hover.node} x={hover.x} y={hover.y} runStart={bounds.start} width={width} />}
    </div>
  );
}

/**
 * The strip under the chart: how many threads were busy, across the whole run,
 * with the current window drawn over it. It is the navigation control and the
 * shape of the run at once, which a plain range slider is not.
 */
function Overview({
  run,
  summary,
  width,
  view,
  bounds,
  onChange,
}: {
  run: Run;
  summary: Summary;
  width: number;
  view: View;
  bounds: View;
  onChange: (view: View) => void;
}) {
  const plotWidth = Math.max(120, width - GUTTER - RIGHT_PAD);
  const total = Math.max(1, bounds.end - bounds.start);
  const peak = Math.max(1, summary.peakConcurrency);
  const drag = useRef<{ from: number } | null>(null);

  const toX = useCallback(
    (time: number) => GUTTER + ((time - bounds.start) / total) * plotWidth,
    [bounds.start, total, plotWidth],
  );
  const toTime = (clientX: number, rect: DOMRect) =>
    bounds.start + ((clientX - rect.left - GUTTER) / plotWidth) * total;

  const area = useMemo(() => {
    if (summary.concurrency.length === 0) return "";
    const base = OVERVIEW_HEIGHT - 14;
    const points = summary.concurrency.flatMap((segment) => {
      const y = base - (segment.level / peak) * (base - 6);
      return [`${toX(segment.start)},${y}`, `${toX(segment.end)},${y}`];
    });
    return `M ${GUTTER},${base} L ${points.join(" L ")} L ${GUTTER + plotWidth},${base} Z`;
  }, [summary.concurrency, peak, plotWidth, toX]);

  return (
    <svg
      width={width}
      height={OVERVIEW_HEIGHT}
      className="touch-none select-none"
      style={{ cursor: "ew-resize" }}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { from: toTime(event.clientX, rect) };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const to = toTime(event.clientX, rect);
        const [start, end] = drag.current.from < to ? [drag.current.from, to] : [to, drag.current.from];
        if (end - start > total / 400) onChange({ start, end });
      }}
      onPointerUp={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        // A click without a drag means show everything again.
        if (drag.current && Math.abs(toTime(event.clientX, rect) - drag.current.from) <= total / 400) {
          onChange(bounds);
        }
        drag.current = null;
      }}
    >
      <text x={GUTTER - 12} y={OVERVIEW_HEIGHT - 18} textAnchor="end" className="fill-body font-mono text-[10px]">
        {copy.chart.overview}
      </text>
      <path d={area} fill="var(--viz-model)" opacity={0.28} />
      <rect
        x={toX(view.start)}
        y={2}
        width={Math.max(2, toX(view.end) - toX(view.start))}
        height={OVERVIEW_HEIGHT - 16}
        fill="var(--color-bright)"
        opacity={0.08}
        stroke="var(--viz-axis)"
      />
      <line
        x1={GUTTER}
        x2={GUTTER + plotWidth}
        y1={OVERVIEW_HEIGHT - 14}
        y2={OVERVIEW_HEIGHT - 14}
        stroke="var(--viz-axis)"
      />
      <title>{`${run.threads.length} threads, ${formatDuration(total)}`}</title>
    </svg>
  );
}

function Tooltip({
  node,
  x,
  y,
  runStart,
  width,
}: {
  node: RunNode;
  x: number;
  y: number;
  runStart: number;
  width: number;
}) {
  const flip = x > width - 280;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 w-64 rounded-md border border-line bg-raised/95 p-3 shadow-lg backdrop-blur-sm"
      style={{ left: flip ? x - 268 : x + 14, top: Math.max(0, y - 12) }}
    >
      <p className="font-mono text-[11px] break-all text-bright">{node.uniqueId}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
        <dt className="text-body/70">total</dt>
        <dd className="text-right text-bright">{formatDuration(node.wallMs)}</dd>
        <dt className="text-body/70">compile</dt>
        <dd className="text-right">{node.compileMs === null ? "n/a" : formatDuration(node.compileMs)}</dd>
        <dt className="text-body/70">execute</dt>
        <dd className="text-right">{node.executeMs === null ? "n/a" : formatDuration(node.executeMs)}</dd>
        <dt className="text-body/70">start</dt>
        <dd className="text-right">{formatOffset((node.startedAt ?? runStart) - runStart)}</dd>
        <dt className="text-body/70">thread</dt>
        <dd className="text-right">{node.thread}</dd>
        <dt className="text-body/70">status</dt>
        <dd className="text-right">{node.status}</dd>
      </dl>
      {node.message && <p className="mt-2 text-[11px] leading-snug text-body">{node.message}</p>}
      <p className="mt-2 font-mono text-[10px] text-body/60">
        {node.startedAt === null ? "" : formatTimestamp(node.startedAt)}
      </p>
    </div>
  );
}
