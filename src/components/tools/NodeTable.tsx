"use client";

import { useMemo, useState } from "react";
import type { Outcome, RunNode } from "@/lib/dbt/parse";
import { formatCount, formatDuration, formatOffset } from "@/lib/dbt/format";
import { runResultsTool as copy } from "@/content/tools";

/**
 * The table is not a fallback for the chart, it is the other half of it. A
 * timeline answers "when", a sorted list answers "which", and two of the three
 * light-mode chart colours sit under 3:1 contrast, so the reading of every bar
 * has to be available as text somewhere on the page.
 */

const OUTCOME_STYLE: Record<Outcome, { label: string; className: string }> = {
  ok: { label: "pass", className: "text-[color:var(--viz-good)]" },
  warn: { label: "warn", className: "text-[color:var(--viz-warning)]" },
  fail: { label: "fail", className: "text-[color:var(--viz-critical)]" },
  skipped: { label: "skip", className: "text-body/60" },
};

function Status({ node }: { node: RunNode }) {
  const style = OUTCOME_STYLE[node.outcome];
  return (
    <span className={`font-mono text-[11px] ${style.className}`} title={node.status}>
      {style.label}
    </span>
  );
}

type SortKey = "node" | "type" | "status" | "thread" | "start" | "compile" | "execute" | "total" | "rows";

const NUMERIC: SortKey[] = ["start", "compile", "execute", "total", "rows"];

function valueOf(node: RunNode, key: SortKey, runStart: number): string | number {
  switch (key) {
    case "node":
      return node.uniqueId;
    case "type":
      return node.resourceType;
    case "status":
      return node.outcome;
    case "thread":
      return node.threadOrder;
    case "start":
      return node.startedAt === null ? Number.MAX_SAFE_INTEGER : node.startedAt - runStart;
    case "compile":
      return node.compileMs ?? -1;
    case "execute":
      return node.executeMs ?? -1;
    case "rows":
      return node.rowsAffected ?? -1;
    default:
      return node.wallMs;
  }
}

export function NodeTable({
  nodes,
  runStart,
  untimed,
  selected,
  onSelect,
}: {
  nodes: RunNode[];
  runStart: number;
  untimed: number;
  selected: RunNode | null;
  onSelect: (node: RunNode | null) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: "total",
    descending: true,
  });

  const sorted = useMemo(() => {
    const direction = sort.descending ? -1 : 1;
    return [...nodes].sort((a, b) => {
      const left = valueOf(a, sort.key, runStart);
      const right = valueOf(b, sort.key, runStart);
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [nodes, sort, runStart]);

  const header = (key: SortKey, label: string) => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"}
      className={`sticky top-0 z-10 bg-raised px-3 py-2 font-mono text-[11px] font-normal tracking-wide text-body/70 ${
        NUMERIC.includes(key) ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() =>
          setSort((previous) =>
            previous.key === key
              ? { key, descending: !previous.descending }
              : { key, descending: NUMERIC.includes(key) },
          )
        }
        className="transition-colors hover:text-accent"
      >
        {label}
        {sort.key === key ? (sort.descending ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="max-h-[30rem] overflow-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {header("node", copy.table.columns.node)}
              {header("type", copy.table.columns.type)}
              {header("status", copy.table.columns.status)}
              {header("thread", copy.table.columns.thread)}
              {header("start", copy.table.columns.start)}
              {header("compile", copy.table.columns.compile)}
              {header("execute", copy.table.columns.execute)}
              {header("total", copy.table.columns.total)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((node) => (
              <tr
                key={node.key}
                onClick={() => onSelect(selected?.key === node.key ? null : node)}
                className={`cursor-pointer border-b border-line/40 transition-colors hover:bg-surface ${
                  selected?.key === node.key ? "bg-surface" : ""
                }`}
              >
                <td className="max-w-[22rem] truncate px-3 py-1.5 font-mono text-[11px] text-bright" title={node.uniqueId}>
                  {node.uniqueId}
                </td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-body/80">{node.resourceType}</td>
                <td className="px-3 py-1.5">
                  <Status node={node} />
                </td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-body/80">{node.thread}</td>
                <td className="px-3 py-1.5 text-right font-mono text-[11px] tabular-nums text-body/80">
                  {node.startedAt === null ? "n/a" : formatOffset(node.startedAt - runStart)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[11px] tabular-nums text-body/80">
                  {node.compileMs === null ? "n/a" : formatDuration(node.compileMs)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[11px] tabular-nums text-body/80">
                  {node.executeMs === null ? "n/a" : formatDuration(node.executeMs)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[11px] tabular-nums text-bright">
                  {node.startedAt === null ? "n/a" : formatDuration(node.wallMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {untimed > 0 && (
        <p className="mt-3 text-xs text-body/70">
          {formatCount(untimed)} of these never ran. {copy.table.untimed}
        </p>
      )}
    </div>
  );
}
