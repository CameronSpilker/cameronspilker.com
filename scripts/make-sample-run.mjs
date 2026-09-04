/**
 * Build the sample run_results.json the visualizer offers as a demo.
 *
 *   node scripts/make-sample-run.mjs
 *
 * The file it writes is synthetic and the tool says so where it offers it. It
 * exists because the visualizer is worth trying before you go and find a real
 * artifact, and because a demo run should show the shapes worth learning to
 * recognise: a long pole holding a thread while the others drain, a failed
 * model taking its downstream with it, and a test suite that costs more than
 * the models it checks.
 *
 * The node names are the real ones from the full-data-stack-lab repo. The
 * timings are made up and deterministic: same seed, same file, so the committed
 * artifact only changes when this script does.
 */
import { writeFileSync, mkdirSync } from "node:fs";

// Deterministic PRNG. A committed artifact that changes on every run is noise
// in every diff that touches this directory.
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260904);
const between = (low, high) => low + rand() * (high - low);

const STAGING = [
  "stg_ncaa__games",
  "stg_ncaa__teams",
  "stg_ncaa__team_box",
  "stg_ncaa__ratings",
  "stg_ncaa__betting_lines",
];
const INTERMEDIATE = [
  "int_team_games",
  "int_team_ratings",
  "int_team_season_form",
  "int_team_prediction_inputs",
  "int_game_market",
  "int_game_predictions",
];
const MARTS = [
  "mart_game_results",
  "mart_team_season",
  "mart_elo_timeline",
  "mart_conference_strength",
  "mart_matchup_odds",
  "mart_model_accuracy",
  "mart_model_calibration",
  "mart_bracket",
];

/** Waves run in order. Within a wave, work is handed to whichever thread frees up. */
const waves = [];

waves.push([
  { id: "seed.ncaa_lab.conference_map", duration: 0.4 },
  { id: "seed.ncaa_lab.tournament_seeds", duration: 0.5 },
]);

waves.push(STAGING.map((name) => ({ id: `model.ncaa_lab.${name}`, duration: between(1.2, 4.5) })));

waves.push([
  ...STAGING.flatMap((name) =>
    ["not_null", "unique", "accepted_values", "relationships", "not_null_key"].map((kind) => ({
      id: `test.ncaa_lab.${kind}_${name}_id.${Math.floor(between(1e5, 9e5))}`,
      duration: between(0.25, 1.4),
    })),
  ),
  { id: "snapshot.ncaa_lab.snap_team_ratings", duration: between(2, 4) },
]);

waves.push(
  INTERMEDIATE.map((name) => ({
    id: `model.ncaa_lab.${name}`,
    // The long pole. One model that holds a thread while everything else drains
    // is the single most common reason a dbt run is slower than it looks.
    duration: name === "int_game_predictions" ? 62 : between(3, 12),
  })),
);

waves.push(
  INTERMEDIATE.flatMap((name, index) =>
    Array.from({ length: index % 2 === 0 ? 4 : 6 }, (_, k) => ({
      id: `test.ncaa_lab.not_null_${name}_col${k}.${Math.floor(between(1e5, 9e5))}`,
      duration: between(0.3, 2.2),
    })),
  ),
);

waves.push(
  // mart_bracket is downstream of the model that fails, so it never runs. It
  // shows up further down as a skipped node with no timing.
  MARTS.filter((name) => name !== "mart_bracket").map((name) => ({
    id: `model.ncaa_lab.${name}`,
    duration: name === "mart_matchup_odds" ? between(28, 34) : between(2, 9),
    // A real failure, so the demo shows what a broken run looks like.
    status: name === "mart_model_calibration" ? "error" : "success",
    message:
      name === "mart_model_calibration"
        ? "Binder Error: Referenced column \"predicted_prob\" not found in FROM clause"
        : null,
  })),
);

// Downstream of the failure. dbt does not run these, so they carry no timing.
const skipped = [
  { id: "model.ncaa_lab.mart_bracket", status: "skipped" },
  { id: "test.ncaa_lab.not_null_mart_model_calibration_bucket.4a91c2", status: "skipped" },
  { id: "test.ncaa_lab.accepted_range_mart_bracket_seed.77b013", status: "skipped" },
];

waves.push([
  ...MARTS.filter((name) => name !== "mart_model_calibration" && name !== "mart_bracket").flatMap(
    (name, index) =>
      Array.from({ length: index % 3 === 0 ? 8 : 5 }, (_, k) => ({
        id: `test.ncaa_lab.dbt_utils_expression_is_true_${name}_${k}.${Math.floor(between(1e5, 9e5))}`,
        duration: between(0.3, 2.6),
      })),
  ),
  {
    id: "test.ncaa_lab.assert_point_in_time_models_beat_a_coin_flip",
    duration: between(3, 5),
    status: "fail",
    failures: 1,
    message: "Got 1 result, configured to fail if != 0",
  },
  {
    id: "test.ncaa_lab.warn_games_held_out_of_the_models",
    duration: between(1, 2),
    status: "warn",
    failures: 12,
    message: "Got 12 results, configured to warn if != 0",
  },
]);

const THREADS = 8;
const started = Date.UTC(2026, 8, 3, 6, 0, 4, 118);
const iso = (ms) => new Date(ms).toISOString().replace("Z", "");

// Greedy scheduler: a task goes to the thread that frees up first, and no wave
// starts before the one above it finishes. That is close enough to how dbt
// drains a level of the graph to make the chart shapes honest.
const free = Array.from({ length: THREADS }, () => started);
const results = [];

for (const wave of waves) {
  // dbt drains a dependency graph, not a set of barriers: work from the next
  // level starts as soon as its own parents are done. Releasing each wave once
  // most of the previous one has finished gets the same overlap without
  // carrying a real DAG around in a sample generator.
  const drained = [...free].sort((a, b) => a - b)[Math.floor(THREADS / 2)];
  for (let i = 0; i < THREADS; i += 1) free[i] = Math.max(free[i], drained);

  // Longest first, so one long task does not start last and strand the run.
  for (const task of [...wave].sort((a, b) => b.duration - a.duration)) {
    let thread = 0;
    for (let i = 1; i < THREADS; i += 1) if (free[i] < free[thread]) thread = i;

    const begin = free[thread];
    const compileMs = Math.round(between(18, 320));
    const executeMs = Math.round(task.duration * 1000);
    const compileEnd = begin + compileMs;
    const end = compileEnd + executeMs;
    free[thread] = end;

    const isModel = task.id.startsWith("model.") || task.id.startsWith("seed.");

    results.push({
      status: task.status ?? (task.id.startsWith("test.") ? "pass" : "success"),
      timing: [
        { name: "compile", started_at: iso(begin), completed_at: iso(compileEnd) },
        { name: "execute", started_at: iso(compileEnd), completed_at: iso(end) },
      ],
      thread_id: `Thread-${thread + 1}`,
      execution_time: (end - begin) / 1000,
      adapter_response: {
        _message: isModel ? "OK" : "SELECT 1",
        rows_affected: isModel ? Math.round(between(400, 240000)) : 0,
      },
      message: task.message ?? null,
      failures: task.failures ?? (task.id.startsWith("test.") ? 0 : null),
      unique_id: task.id,
      compiled: true,
    });
  }
}

for (const node of skipped) {
  results.push({
    status: node.status,
    timing: [],
    thread_id: "Thread-1",
    execution_time: 0,
    adapter_response: {},
    message: null,
    failures: null,
    unique_id: node.id,
    compiled: false,
  });
}

const finished = Math.max(...free);

const artifact = {
  metadata: {
    dbt_schema_version: "https://schemas.getdbt.com/dbt/run-results/v6.json",
    dbt_version: "1.10.4",
    generated_at: iso(finished),
    invocation_id: "0f4c5a2e-6b13-4d92-9b7f-1a8ce2d0f331",
    env: {},
  },
  results,
  elapsed_time: (finished - started) / 1000,
  args: {
    which: "build",
    threads: THREADS,
    target: "prod",
    full_refresh: false,
  },
};

mkdirSync("public/samples", { recursive: true });
writeFileSync("public/samples/run-results.sample.json", `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  `wrote public/samples/run-results.sample.json: ${results.length} nodes, ${artifact.elapsed_time.toFixed(1)}s`,
);
