/**
 * How a bar gets its colour.
 *
 * Three encodings, one at a time, because a mark can only carry one identity.
 * Resource type is the default: bar length already answers "how long", so the
 * fill is spent on "what kind of work" instead of repeating the axis.
 *
 * The hexes live in `globals.css` as `--viz-*` custom properties so the dark
 * steps are chosen for the dark surface rather than flipped into it. The
 * categorical trio is the validated all-pairs set: three slots, no more. A
 * fourth category would have to fold into "other" rather than take a new hue.
 */

import type { RunNode } from "./parse";

export type ColorMode = "type" | "status" | "duration";

export type LegendEntry = {
  label: string;
  /** A CSS custom property reference, resolved by the browser per theme. */
  color: string;
  /** Shown beside the swatch so identity is never colour alone. */
  hint?: string;
};

const DURATION_STEPS = [
  { limit: 10_000, label: "under 10s", color: "var(--viz-seq-1)" },
  { limit: 60_000, label: "10s to 1m", color: "var(--viz-seq-2)" },
  { limit: 180_000, label: "1m to 3m", color: "var(--viz-seq-3)" },
  { limit: 600_000, label: "3m to 10m", color: "var(--viz-seq-4)" },
  { limit: Infinity, label: "over 10m", color: "var(--viz-seq-5)" },
];

export function nodeColor(node: RunNode, mode: ColorMode): string {
  // A failure is never drawn as a healthy bar, whatever the reader is colouring
  // by. Losing the run's one broken model in a sea of blue is the failure mode.
  if (node.outcome === "fail") return "var(--viz-critical)";
  if (mode === "status") {
    if (node.outcome === "warn") return "var(--viz-warning)";
    if (node.outcome === "skipped") return "var(--viz-muted)";
    return "var(--viz-good)";
  }
  if (mode === "duration") {
    return (DURATION_STEPS.find((step) => node.wallMs < step.limit) ?? DURATION_STEPS[4]).color;
  }
  if (node.group === "model") return "var(--viz-model)";
  if (node.group === "test") return "var(--viz-test)";
  return "var(--viz-other)";
}

export function legendFor(mode: ColorMode): LegendEntry[] {
  if (mode === "status") {
    return [
      { label: "Passed", color: "var(--viz-good)" },
      { label: "Warned", color: "var(--viz-warning)" },
      { label: "Failed", color: "var(--viz-critical)" },
      { label: "Skipped", color: "var(--viz-muted)", hint: "not charted" },
    ];
  }
  if (mode === "duration") {
    return DURATION_STEPS.map((step) => ({ label: step.label, color: step.color }));
  }
  return [
    { label: "Models", color: "var(--viz-model)" },
    { label: "Tests", color: "var(--viz-test)" },
    { label: "Seeds, snapshots, operations", color: "var(--viz-other)" },
    { label: "Failed", color: "var(--viz-critical)", hint: "any type" },
  ];
}
