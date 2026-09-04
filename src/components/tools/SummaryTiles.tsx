"use client";

import type { Run } from "@/lib/dbt/parse";
import type { Summary } from "@/lib/dbt/metrics";
import { formatBytes, formatCount, formatDuration, formatOffset, formatPercent } from "@/lib/dbt/format";
import { runResultsTool as copy } from "@/content/tools";

/**
 * The verdict, above the chart.
 *
 * A Gantt tells you what happened. These say whether it was any good. The four
 * headline tiles are the ones that change what you would do next: how long it
 * took, how much of the thread pool that time actually used, the longest
 * stretch where the pool was down to one thread, and whether anything broke.
 */

function Tile({
  label,
  value,
  hint,
  tone = "neutral",
  meter,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  meter?: number;
}) {
  const accent = {
    neutral: "var(--color-accent)",
    good: "var(--viz-good)",
    warning: "var(--viz-warning)",
    critical: "var(--viz-critical)",
  }[tone];

  return (
    <div className="rounded-lg border border-line bg-raised/60 p-4">
      <p className="font-mono text-[11px] tracking-[0.12em] text-body/70 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-bright tabular-nums sm:text-3xl">
        {value}
      </p>
      {meter !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(2, meter * 100))}%`, backgroundColor: accent }}
          />
        </div>
      )}
      <p className="mt-2 text-xs leading-snug text-body/80">{hint}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2">
      <dt className="text-xs text-body/80">{label}</dt>
      <dd className="font-mono text-xs text-bright tabular-nums">{value}</dd>
    </div>
  );
}

export function SummaryTiles({ run, summary }: { run: Run; summary: Summary }) {
  const failures = summary.counts.fail;
  const totalPhase = summary.compileMs + summary.executeMs;
  const testMs = summary.groups.find((group) => group.group === "test")?.totalMs ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={copy.tiles.wall.label}
          value={formatDuration(summary.wallMs)}
          hint={`${formatDuration(summary.nodeMs)} of node time across ${summary.threadCount} threads`}
        />
        <Tile
          label={copy.tiles.utilization.label}
          value={formatPercent(summary.utilization)}
          hint={`${summary.meanConcurrency.toFixed(1)} of ${summary.threadCount} threads busy on average`}
          meter={summary.utilization}
          tone={summary.utilization < 0.5 ? "warning" : "good"}
        />
        <Tile
          label={copy.tiles.solo.label}
          value={formatDuration(summary.longestSoloMs)}
          hint={
            summary.longestSoloStart === null || run.startedAt === null
              ? copy.tiles.solo.hint
              : `Starts at ${formatOffset(summary.longestSoloStart - run.startedAt)} into the run`
          }
          tone={summary.longestSoloMs > summary.wallMs * 0.2 ? "warning" : "neutral"}
        />
        <Tile
          label={copy.tiles.failures.label}
          value={formatCount(failures)}
          hint={
            failures === 0
              ? `${formatCount(summary.counts.ok)} passed, ${formatCount(summary.untimed)} never ran`
              : `${formatCount(summary.counts.warn)} warned, ${formatCount(summary.untimed)} never ran`
          }
          tone={failures > 0 ? "critical" : "good"}
        />
      </div>

      <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <Fact
          label={copy.tiles.compile.label}
          value={
            totalPhase > 0
              ? `${formatPercent(summary.compileMs / totalPhase)} · ${formatDuration(summary.compileMs)}`
              : "n/a"
          }
        />
        <Fact
          label={copy.tiles.tests.label}
          value={
            summary.nodeMs > 0
              ? `${formatPercent(testMs / summary.nodeMs)} · ${formatDuration(testMs)}`
              : "n/a"
          }
        />
        <Fact label={copy.tiles.tail.label} value={formatDuration(summary.tailMs)} />
        <Fact label={copy.tiles.stalled.label} value={formatDuration(summary.stalledMs)} />
        <Fact
          label={copy.tiles.nodes.label}
          value={`${formatCount(run.nodes.length)} · peak ${summary.peakConcurrency} at once`}
        />
        {summary.rowsAffected !== null && (
          <Fact label={copy.tiles.rows.label} value={formatCount(summary.rowsAffected)} />
        )}
        {summary.bytesBilled !== null && (
          <Fact label={copy.tiles.bytes.label} value={formatBytes(summary.bytesBilled)} />
        )}
      </dl>
    </div>
  );
}
