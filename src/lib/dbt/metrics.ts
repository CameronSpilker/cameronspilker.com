/**
 * Everything the summary reads, derived from a parsed run.
 *
 * The interesting numbers are not the slowest models. They are the ones that
 * say whether the run was shaped badly: how much of the paid-for parallelism
 * was actually used, how long the run spent trailing off on one thread, and how
 * much of the clock went to compiling rather than to the warehouse. A run can
 * have no slow model and still take twice as long as it should.
 *
 * Pure functions over a `Run`. No React, no DOM.
 */

import type { Outcome, ResourceGroup, Run, RunNode } from "./parse";

/** One stretch of wall clock over which the number of busy threads is constant. */
export type ConcurrencySegment = {
  start: number;
  end: number;
  /** Nodes running during the stretch. Zero means the run stalled. */
  level: number;
};

export type ThreadLoad = {
  thread: string;
  busyMs: number;
  idleMs: number;
  nodes: number;
};

export type GroupLoad = {
  group: ResourceGroup;
  nodes: number;
  totalMs: number;
  /** Share of summed node time, not of wall clock. */
  share: number;
};

export type Summary = {
  wallMs: number;
  /** Summed span of every node. Exceeds wall clock whenever threads overlap. */
  nodeMs: number;
  threadCount: number;
  /** nodeMs / (wallMs * threadCount). 1 means every thread was busy throughout. */
  utilization: number;
  /** Mean number of threads busy across the run. */
  meanConcurrency: number;
  /** Peak observed concurrency, which can exceed the configured thread count. */
  peakConcurrency: number;
  /** Final stretch of the run spent on one thread or none. The classic tail. */
  tailMs: number;
  /** Longest stretch anywhere at one busy thread or none, and when it began.
   *  A long pole in the middle of a run costs exactly what a tail costs. */
  longestSoloMs: number;
  longestSoloStart: number | null;
  /** Wall clock during which nothing at all was running. */
  stalledMs: number;
  compileMs: number;
  executeMs: number;
  counts: Record<Outcome, number>;
  untimed: number;
  groups: GroupLoad[];
  threads: ThreadLoad[];
  concurrency: ConcurrencySegment[];
  slowest: RunNode[];
  failures: RunNode[];
  /** Null unless the adapter reported it. BigQuery does; most do not. */
  bytesBilled: number | null;
  bytesProcessed: number | null;
  rowsAffected: number | null;
};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumDefined(nodes: RunNode[], pick: (node: RunNode) => number | null): number | null {
  const present = nodes.map(pick).filter((value): value is number => value !== null);
  return present.length ? sum(present) : null;
}

/**
 * Sweep the start and end of every node to get the busy-thread count over time.
 * Ends are processed before starts at the same instant, so a node finishing
 * exactly as another begins does not read as an extra thread.
 */
export function concurrencyTimeline(nodes: RunNode[]): ConcurrencySegment[] {
  const events: { at: number; delta: number }[] = [];
  for (const node of nodes) {
    if (node.startedAt === null || node.completedAt === null) continue;
    events.push({ at: node.startedAt, delta: 1 });
    events.push({ at: node.completedAt, delta: -1 });
  }
  if (events.length === 0) return [];

  events.sort((a, b) => a.at - b.at || a.delta - b.delta);

  const segments: ConcurrencySegment[] = [];
  let level = 0;
  let cursor = events[0].at;

  for (const event of events) {
    if (event.at > cursor) {
      segments.push({ start: cursor, end: event.at, level });
      cursor = event.at;
    }
    level += event.delta;
  }

  return segments;
}

/** Length of the final run of segments at one busy thread or none. */
function tailOf(segments: ConcurrencySegment[]): number {
  let tail = 0;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (segments[i].level > 1) break;
    tail += segments[i].end - segments[i].start;
  }
  return tail;
}

/** The longest contiguous stretch at one busy thread or none, anywhere. */
function longestSoloOf(segments: ConcurrencySegment[]): { ms: number; start: number | null } {
  let best = { ms: 0, start: null as number | null };
  let runStart: number | null = null;

  for (const segment of segments) {
    if (segment.level <= 1) {
      if (runStart === null) runStart = segment.start;
      const ms = segment.end - runStart;
      if (ms > best.ms) best = { ms, start: runStart };
    } else {
      runStart = null;
    }
  }

  return best;
}

const GROUP_ORDER: ResourceGroup[] = ["model", "test", "other"];

export function summarize(run: Run): Summary {
  const nodes = run.timed;
  const wallMs =
    run.startedAt !== null && run.completedAt !== null
      ? Math.max(0, run.completedAt - run.startedAt)
      : (run.elapsedMs ?? 0);

  const nodeMs = sum(nodes.map((node) => node.wallMs));
  const segments = concurrencyTimeline(nodes);

  // The configured count is the honest denominator: idle threads are the point.
  // Falling back to observed threads keeps the number defined for older runs.
  const threadCount = run.configuredThreads ?? Math.max(1, run.threads.length);

  const threads: ThreadLoad[] = run.threads.map((thread) => {
    const own = nodes.filter((node) => node.thread === thread);
    const busyMs = sum(own.map((node) => node.wallMs));
    return { thread, busyMs, idleMs: Math.max(0, wallMs - busyMs), nodes: own.length };
  });

  const groups: GroupLoad[] = GROUP_ORDER.map((group) => {
    const own = nodes.filter((node) => node.group === group);
    const totalMs = sum(own.map((node) => node.wallMs));
    return { group, nodes: own.length, totalMs, share: nodeMs > 0 ? totalMs / nodeMs : 0 };
  }).filter((load) => load.nodes > 0);

  const counts: Record<Outcome, number> = { ok: 0, warn: 0, fail: 0, skipped: 0 };
  for (const node of run.nodes) counts[node.outcome] += 1;

  return {
    wallMs,
    nodeMs,
    threadCount,
    utilization: wallMs > 0 && threadCount > 0 ? nodeMs / (wallMs * threadCount) : 0,
    meanConcurrency: wallMs > 0 ? nodeMs / wallMs : 0,
    peakConcurrency: segments.reduce((peak, segment) => Math.max(peak, segment.level), 0),
    tailMs: tailOf(segments),
    longestSoloMs: longestSoloOf(segments).ms,
    longestSoloStart: longestSoloOf(segments).start,
    stalledMs: sum(
      segments.filter((segment) => segment.level === 0).map((segment) => segment.end - segment.start),
    ),
    compileMs: sum(nodes.map((node) => node.compileMs ?? 0)),
    executeMs: sum(nodes.map((node) => node.executeMs ?? 0)),
    counts,
    untimed: run.untimed.length,
    groups,
    threads,
    concurrency: segments,
    slowest: [...nodes].sort((a, b) => b.wallMs - a.wallMs).slice(0, 12),
    failures: run.nodes.filter((node) => node.outcome === "fail" || node.outcome === "warn"),
    bytesBilled: sumDefined(run.nodes, (node) => node.bytesBilled),
    bytesProcessed: sumDefined(run.nodes, (node) => node.bytesProcessed),
    rowsAffected: sumDefined(run.nodes, (node) => node.rowsAffected),
  };
}
