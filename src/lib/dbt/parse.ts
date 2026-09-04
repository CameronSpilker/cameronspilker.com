/**
 * Turn a raw `run_results.json` into something a chart can be drawn from.
 *
 * Two decisions here are the whole difference between this and the naive
 * version of the same parser:
 *
 * 1. Timing entries are matched by `name`, not by position. `timing[0]` is not
 *    guaranteed to be the compile phase, and a node that never executed has
 *    only one entry, or none. Reading positionally silently drops those nodes.
 * 2. A node without timing is kept. Skipped nodes are the evidence for why a
 *    run was short or why a model is missing, so they are counted and listed
 *    rather than filtered out before anyone sees them.
 *
 * Nothing in this file touches the DOM or React. It runs in a worker, a test,
 * or the browser unchanged.
 */

import type { RawAdapterResponse, RawResult, RawRunResults, RawTiming } from "./schema";

/** How a node ended, collapsed across the vocabularies dbt uses per resource. */
export type Outcome = "ok" | "warn" | "fail" | "skipped";

export type ResourceType =
  | "model"
  | "test"
  | "unit_test"
  | "seed"
  | "snapshot"
  | "operation"
  | "analysis"
  | "other";

/** The three buckets the chart colours by. Capped at three on purpose: the
 *  palette is only validated for all-pairs separation at three slots. */
export type ResourceGroup = "model" | "test" | "other";

export type RunNode = {
  /** Stable key. `unique_id` is normally unique but nothing guarantees it. */
  key: string;
  uniqueId: string;
  /** Last segment of the unique id, which is what people call the model. */
  name: string;
  resourceType: ResourceType;
  group: ResourceGroup;
  status: string;
  outcome: Outcome;
  thread: string;
  /** Numeric sort key, so Thread-10 lands after Thread-2. */
  threadOrder: number;
  /** Epoch ms. Null when dbt wrote no usable timing, which means skipped. */
  startedAt: number | null;
  completedAt: number | null;
  compileMs: number | null;
  executeMs: number | null;
  /** Start of compile to end of execute. What the Gantt bar measures. */
  wallMs: number;
  /** `execution_time`, which dbt reports separately and rounds differently. */
  executionMs: number;
  rowsAffected: number | null;
  bytesProcessed: number | null;
  bytesBilled: number | null;
  failures: number | null;
  message: string | null;
};

export type Run = {
  generatedAt: number | null;
  invocationId: string | null;
  dbtVersion: string | null;
  target: string | null;
  command: string | null;
  /** Configured thread count, when dbt recorded it. */
  configuredThreads: number | null;
  /** `elapsed_time`, dbt's own measure of the whole invocation. */
  elapsedMs: number | null;
  nodes: RunNode[];
  /** Nodes with real timing, sorted by start. Everything the chart draws. */
  timed: RunNode[];
  /** Nodes dbt never ran. Counted and listed, never charted. */
  untimed: RunNode[];
  /** Distinct threads that did work, in numeric order. */
  threads: string[];
  startedAt: number | null;
  completedAt: number | null;
};

export class RunResultsError extends Error {}

const OK_STATUSES = new Set(["success", "pass", "partial success"]);
const WARN_STATUSES = new Set(["warn"]);
const SKIP_STATUSES = new Set(["skipped", "no-op"]);

function outcomeOf(status: string): Outcome {
  const normalized = status.trim().toLowerCase();
  if (OK_STATUSES.has(normalized)) return "ok";
  if (WARN_STATUSES.has(normalized)) return "warn";
  if (SKIP_STATUSES.has(normalized)) return "skipped";
  // error, fail, runtime error, and anything a future dbt invents.
  return "fail";
}

const RESOURCE_TYPES: ResourceType[] = [
  "model",
  "test",
  "unit_test",
  "seed",
  "snapshot",
  "operation",
  "analysis",
];

function resourceTypeOf(uniqueId: string): ResourceType {
  const prefix = uniqueId.split(".")[0];
  const match = RESOURCE_TYPES.find((type) => type === prefix);
  return match ?? "other";
}

function groupOf(type: ResourceType): ResourceGroup {
  if (type === "model") return "model";
  if (type === "test" || type === "unit_test") return "test";
  return "other";
}

/** "Thread-12" sorts after "Thread-2"; "MainThread" leads. */
function threadOrderOf(thread: string): number {
  const digits = thread.match(/(\d+)\s*$/);
  if (digits) return Number(digits[1]);
  return thread.toLowerCase().includes("main") ? -1 : Number.MAX_SAFE_INTEGER;
}

function epoch(value: string | null | undefined): number | null {
  if (!value) return null;
  // dbt writes naive UTC timestamps ("2024-12-28T18:43:42.191339"). Date treats
  // those as local time, which shifts a whole run by the reader's offset.
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(withZone);
  return Number.isNaN(ms) ? null : ms;
}

function phase(timing: RawTiming[] | undefined, name: string): RawTiming | undefined {
  return timing?.find((entry) => entry?.name?.toLowerCase() === name);
}

function span(entry: RawTiming | undefined): number | null {
  const start = epoch(entry?.started_at);
  const end = epoch(entry?.completed_at);
  if (start === null || end === null) return null;
  return Math.max(0, end - start);
}

function adapterNumber(response: RawAdapterResponse | undefined, key: string): number | null {
  if (!response || typeof response === "string") return null;
  const value = (response as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNode(result: RawResult, index: number): RunNode {
  const uniqueId = result.unique_id ?? `node.${index}`;
  const parts = uniqueId.split(".");
  const resourceType = resourceTypeOf(uniqueId);
  const status = result.status ?? "unknown";

  const compile = phase(result.timing, "compile");
  const execute = phase(result.timing, "execute");

  // Bound the bar by every timing entry present, so a node that only compiled
  // still has a real span and a future phase name is not silently ignored.
  const starts = (result.timing ?? [])
    .map((entry) => epoch(entry?.started_at))
    .filter((value): value is number => value !== null);
  const ends = (result.timing ?? [])
    .map((entry) => epoch(entry?.completed_at))
    .filter((value): value is number => value !== null);

  const startedAt = starts.length ? Math.min(...starts) : null;
  const completedAt = ends.length ? Math.max(...ends) : null;
  const executionMs = Math.max(0, (result.execution_time ?? 0) * 1000);

  const thread = result.thread_id ?? "unassigned";

  return {
    key: `${uniqueId}#${index}`,
    uniqueId,
    name: parts[parts.length - 1] || uniqueId,
    resourceType,
    group: groupOf(resourceType),
    status,
    outcome: outcomeOf(status),
    thread,
    threadOrder: threadOrderOf(thread),
    startedAt,
    completedAt,
    compileMs: span(compile),
    executeMs: span(execute),
    wallMs:
      startedAt !== null && completedAt !== null
        ? Math.max(0, completedAt - startedAt)
        : executionMs,
    executionMs,
    rowsAffected: adapterNumber(result.adapter_response, "rows_affected"),
    bytesProcessed: adapterNumber(result.adapter_response, "bytes_processed"),
    bytesBilled: adapterNumber(result.adapter_response, "bytes_billed"),
    failures: typeof result.failures === "number" ? result.failures : null,
    message: result.message ?? null,
  };
}

/** Recognise the neighbouring artifact, since it is the likeliest wrong file. */
function looksLikeManifest(value: Record<string, unknown>): boolean {
  return "parent_map" in value || ("nodes" in value && "child_map" in value);
}

export function parseRunResults(input: unknown): Run {
  let raw: unknown = input;

  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new RunResultsError("That file is not valid JSON.");
    }
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RunResultsError("That file is not a dbt artifact.");
  }

  const record = raw as Record<string, unknown>;

  if (looksLikeManifest(record)) {
    throw new RunResultsError(
      "That looks like manifest.json. Load run_results.json from the same target directory.",
    );
  }

  const data = raw as RawRunResults;

  if (!Array.isArray(data.results)) {
    throw new RunResultsError(
      "No results array in that file. Load run_results.json from your target directory.",
    );
  }

  if (data.results.length === 0) {
    throw new RunResultsError("That run has no results in it. Nothing was executed.");
  }

  const nodes = data.results.map(toNode);
  const timed = nodes
    .filter((node): node is RunNode & { startedAt: number; completedAt: number } => {
      return node.startedAt !== null && node.completedAt !== null;
    })
    .sort((a, b) => a.startedAt - b.startedAt || a.threadOrder - b.threadOrder);
  const untimed = nodes.filter((node) => node.startedAt === null || node.completedAt === null);

  const threads = [...new Set(timed.map((node) => node.thread))].sort(
    (a, b) => threadOrderOf(a) - threadOrderOf(b) || a.localeCompare(b),
  );

  return {
    generatedAt: epoch(data.metadata?.generated_at),
    invocationId: data.metadata?.invocation_id ?? null,
    dbtVersion: data.metadata?.dbt_version ?? null,
    target: data.args?.target ?? null,
    command: data.args?.which ?? null,
    configuredThreads:
      typeof data.args?.threads === "number" && data.args.threads > 0 ? data.args.threads : null,
    elapsedMs:
      typeof data.elapsed_time === "number" && Number.isFinite(data.elapsed_time)
        ? data.elapsed_time * 1000
        : null,
    nodes,
    timed,
    untimed,
    threads,
    startedAt: timed.length ? timed[0].startedAt : null,
    completedAt: timed.length ? Math.max(...timed.map((node) => node.completedAt as number)) : null,
  };
}
