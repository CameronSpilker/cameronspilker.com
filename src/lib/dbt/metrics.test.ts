/**
 * Run with `npm test`.
 *
 * The summary is the part of this tool someone would quote in a standup, so
 * every number in it is checked against a run whose shape is obvious by hand.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRunResults } from "./parse.ts";
import { concurrencyTimeline, summarize } from "./metrics.ts";

const BASE = Date.UTC(2026, 8, 3, 6, 0, 0, 0);

/** Each spec is [unique_id, start second, end second, thread]. */
function runOf(specs: [string, number, number, number][], threads = 2) {
  const at = (second: number) => new Date(BASE + second * 1000).toISOString().replace("Z", "");
  return parseRunResults({
    metadata: { generated_at: at(0) },
    args: { threads },
    results: specs.map(([uniqueId, start, end, thread]) => ({
      unique_id: uniqueId,
      status: "success",
      thread_id: `Thread-${thread}`,
      execution_time: end - start,
      timing: [
        { name: "compile", started_at: at(start), completed_at: at(start) },
        { name: "execute", started_at: at(start), completed_at: at(end) },
      ],
    })),
  });
}

test("concurrency is a sweep, and a handoff is not counted as two threads", () => {
  const segments = concurrencyTimeline(
    runOf([
      ["model.p.a", 0, 10, 1],
      ["model.p.b", 10, 20, 2],
    ]).timed,
  );
  assert.deepEqual(
    segments.map((segment) => segment.level),
    [1, 1],
  );
});

test("utilization is summed node time over the whole thread budget", () => {
  // Two threads, ten seconds of wall clock, one of them busy for five.
  const summary = summarize(
    runOf([
      ["model.p.a", 0, 10, 1],
      ["model.p.b", 0, 5, 2],
    ]),
  );
  assert.equal(summary.wallMs, 10_000);
  assert.equal(summary.nodeMs, 15_000);
  assert.equal(summary.utilization, 0.75);
  assert.equal(summary.meanConcurrency, 1.5);
  assert.equal(summary.peakConcurrency, 2);
});

test("the tail is the final stretch spent on one thread", () => {
  const summary = summarize(
    runOf([
      ["model.p.a", 0, 4, 1],
      ["model.p.b", 0, 4, 2],
      ["model.p.slow", 4, 30, 1],
    ]),
  );
  assert.equal(summary.tailMs, 26_000);
});

test("the longest solo stretch is found in the middle of a run, not only at the end", () => {
  const summary = summarize(
    runOf([
      ["model.p.a", 0, 4, 1],
      ["model.p.a2", 0, 4, 2],
      ["model.p.long_pole", 4, 70, 1],
      ["model.p.b", 70, 74, 1],
      ["model.p.c", 70, 74, 2],
    ]),
  );
  assert.equal(summary.longestSoloMs, 66_000);
  assert.equal(summary.tailMs, 0);
});

test("a gap where nothing ran is stalled time, not idle thread time", () => {
  const summary = summarize(
    runOf([
      ["model.p.a", 0, 5, 1],
      ["model.p.b", 12, 20, 1],
    ]),
  );
  assert.equal(summary.stalledMs, 7_000);
});

test("utilization uses the configured thread count, not the threads that got work", () => {
  // Eight configured threads, one used. The point of the number is the seven
  // that were idle, so a denominator of one would hide exactly what matters.
  const summary = summarize(runOf([["model.p.a", 0, 10, 1]], 8));
  assert.equal(summary.threadCount, 8);
  assert.equal(summary.utilization, 0.125);
});

test("groups split models from tests and share out summed node time", () => {
  const summary = summarize(
    runOf([
      ["model.p.a", 0, 30, 1],
      ["test.p.not_null_a.x", 0, 10, 2],
    ]),
  );
  assert.deepEqual(
    summary.groups.map((group) => [group.group, group.nodes, group.totalMs, group.share]),
    [
      ["model", 1, 30_000, 0.75],
      ["test", 1, 10_000, 0.25],
    ],
  );
});

test("the sample run the tool ships still parses and still shows a failure", () => {
  const sample = readFileSync("public/samples/run-results.sample.json", "utf8");
  const run = parseRunResults(sample);
  const summary = summarize(run);

  assert.equal(run.configuredThreads, 8);
  assert.ok(run.nodes.length > 60, "sample should be big enough to be worth charting");
  assert.equal(summary.counts.fail, 2, "one failed model and one failed test");
  assert.equal(summary.counts.warn, 1);
  assert.equal(summary.untimed, 3);
  assert.ok(
    summary.slowest[0].wallMs > summary.wallMs * 0.5,
    "sample should be dominated by one long model, which is the shape worth seeing",
  );
  assert.ok(summary.tailMs > 10_000, "sample should end on a visible single threaded tail");
  assert.ok(summary.utilization < 0.8, "sample should have visible idle capacity");
});
