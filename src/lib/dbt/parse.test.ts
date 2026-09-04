/**
 * Run with `npm test`.
 *
 * These cases are the ones a positional parser gets wrong. A dbt artifact is
 * written by a machine, but it is written by whichever dbt the person happened
 * to run, and this tool's whole claim is that it reads the file correctly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRunResults, RunResultsError } from "./parse.ts";

function artifact(results: unknown[], extra: Record<string, unknown> = {}) {
  return {
    metadata: {
      dbt_version: "1.10.4",
      generated_at: "2026-09-03T06:02:24.813000",
      invocation_id: "abc",
    },
    results,
    elapsed_time: 140.7,
    args: { threads: 8, target: "prod", which: "build" },
    ...extra,
  };
}

function node(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    timing: [
      { name: "compile", started_at: "2026-09-03T06:00:04.118000", completed_at: "2026-09-03T06:00:04.318000" },
      { name: "execute", started_at: "2026-09-03T06:00:04.318000", completed_at: "2026-09-03T06:00:06.318000" },
    ],
    thread_id: "Thread-1",
    execution_time: 2.2,
    unique_id: "model.proj.stg_games",
    ...overrides,
  };
}

test("reads the phases by name, not by position", () => {
  const reversed = node({
    timing: [
      { name: "execute", started_at: "2026-09-03T06:00:04.318000", completed_at: "2026-09-03T06:00:06.318000" },
      { name: "compile", started_at: "2026-09-03T06:00:04.118000", completed_at: "2026-09-03T06:00:04.318000" },
    ],
  });
  const run = parseRunResults(artifact([reversed]));
  assert.equal(run.timed[0].compileMs, 200);
  assert.equal(run.timed[0].executeMs, 2000);
  assert.equal(run.timed[0].wallMs, 2200);
});

test("keeps a node that only compiled", () => {
  const compileOnly = node({
    status: "error",
    timing: [
      { name: "compile", started_at: "2026-09-03T06:00:04.118000", completed_at: "2026-09-03T06:00:04.618000" },
    ],
  });
  const run = parseRunResults(artifact([compileOnly]));
  assert.equal(run.timed.length, 1);
  assert.equal(run.timed[0].wallMs, 500);
  assert.equal(run.timed[0].executeMs, null);
});

test("keeps a skipped node out of the chart but not out of the run", () => {
  const run = parseRunResults(artifact([node(), node({ status: "skipped", timing: [], unique_id: "model.proj.marts" })]));
  assert.equal(run.nodes.length, 2);
  assert.equal(run.timed.length, 1);
  assert.equal(run.untimed.length, 1);
  assert.equal(run.untimed[0].outcome, "skipped");
});

test("treats a naive timestamp as UTC rather than as local time", () => {
  const run = parseRunResults(artifact([node()]));
  assert.equal(run.timed[0].startedAt, Date.UTC(2026, 8, 3, 6, 0, 4, 118));
});

test("accepts a timestamp that already carries a zone", () => {
  const zoned = node({
    timing: [
      { name: "compile", started_at: "2026-09-03T06:00:04.118000Z", completed_at: "2026-09-03T06:00:04.318000Z" },
      { name: "execute", started_at: "2026-09-03T06:00:04.318000Z", completed_at: "2026-09-03T06:00:06.318000Z" },
    ],
  });
  const run = parseRunResults(artifact([zoned]));
  assert.equal(run.timed[0].startedAt, Date.UTC(2026, 8, 3, 6, 0, 4, 118));
});

test("orders threads numerically", () => {
  const run = parseRunResults(
    artifact([
      node({ thread_id: "Thread-10", unique_id: "model.proj.a" }),
      node({ thread_id: "Thread-2", unique_id: "model.proj.b" }),
      node({ thread_id: "Thread-1", unique_id: "model.proj.c" }),
    ]),
  );
  assert.deepEqual(run.threads, ["Thread-1", "Thread-2", "Thread-10"]);
});

test("classifies the vocabularies dbt uses per resource type", () => {
  const run = parseRunResults(
    artifact([
      node({ status: "pass", unique_id: "test.proj.not_null_x.abc" }),
      node({ status: "warn", unique_id: "test.proj.warn_y.abc" }),
      node({ status: "runtime error", unique_id: "model.proj.z" }),
      node({ status: "partial success", unique_id: "model.proj.micro" }),
      node({ status: "success", unique_id: "snapshot.proj.snap" }),
    ]),
  );
  assert.deepEqual(
    run.nodes.map((item) => [item.group, item.outcome]),
    [
      ["test", "ok"],
      ["test", "warn"],
      ["model", "fail"],
      ["model", "ok"],
      ["other", "ok"],
    ],
  );
});

test("reads the adapter response only when it is an object", () => {
  const run = parseRunResults(
    artifact([
      node({ adapter_response: { rows_affected: 1200, bytes_billed: 10485760 } }),
      node({ adapter_response: "SELECT 1", unique_id: "model.proj.other" }),
    ]),
  );
  assert.equal(run.nodes[0].rowsAffected, 1200);
  assert.equal(run.nodes[0].bytesBilled, 10485760);
  assert.equal(run.nodes[1].rowsAffected, null);
});

test("names the likeliest wrong file rather than failing generically", () => {
  assert.throws(
    () => parseRunResults({ nodes: {}, parent_map: {}, child_map: {} }),
    (error: unknown) => error instanceof RunResultsError && /manifest\.json/.test((error as Error).message),
  );
});

test("rejects what is not a run results file", () => {
  assert.throws(() => parseRunResults("not json at all"), RunResultsError);
  assert.throws(() => parseRunResults({ metadata: {} }), RunResultsError);
  assert.throws(() => parseRunResults(artifact([])), RunResultsError);
});
