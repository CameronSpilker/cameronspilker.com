"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseRunResults, RunResultsError, type Run, type RunNode } from "@/lib/dbt/parse";
import { summarize } from "@/lib/dbt/metrics";
import { formatBytes, formatCount, formatDuration, formatTimestamp } from "@/lib/dbt/format";
import { legendFor, type ColorMode } from "@/lib/dbt/viz";
import { runResultsTool as copy } from "@/content/tools";
import { SummaryTiles } from "./SummaryTiles";
import { NodeTable } from "./NodeTable";
import { Timeline } from "./Timeline";

const MODES: ColorMode[] = ["type", "status", "duration"];

export function RunResultsVisualizer() {
  const [run, setRun] = useState<Run | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  /** True while what is on screen is the sample rather than the reader's run. */
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [query, setQuery] = useState("");
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [selected, setSelected] = useState<RunNode | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (text: string, name: string, sample = false) => {
    setReading(true);
    setError(null);
    try {
      const parsed = parseRunResults(text);
      setRun(parsed);
      setFileName(name);
      setIsSample(sample);
      setSelected(null);
      setResetKey((key) => key + 1);
    } catch (thrown) {
      setRun(null);
      setFileName(null);
      setIsSample(false);
      setError(
        thrown instanceof RunResultsError ? thrown.message : "Something in that file could not be read.",
      );
    } finally {
      setReading(false);
    }
  }, []);

  const openFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      await load(await file.text(), file.name);
    },
    [load],
  );

  const loadSample = useCallback(
    async (quiet = false) => {
      setReading(true);
      try {
        const response = await fetch(copy.sample.path);
        await load(await response.text(), "run-results.sample.json", true);
      } catch {
        // The automatic load on arrival is a convenience. If it fails, the
        // reader is left with the dropzone they came for, not an error about
        // a file they never asked for.
        if (!quiet) setError("The sample could not be fetched.");
        setReading(false);
      }
    },
    [load],
  );

  /**
   * Show the sample on arrival.
   *
   * A file-drop tool that opens on an empty box asks the reader to decide
   * whether it is worth trying before it has shown them anything. Loading the
   * sample costs one request and answers the question instead, and the banner
   * over the results makes sure nobody mistakes it for their own run.
   */
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    void loadSample(true);
  }, [loadSample]);

  const summary = useMemo(() => (run ? summarize(run) : null), [run]);
  const legend = useMemo(() => legendFor(colorMode), [colorMode]);

  const filtered = useMemo(() => {
    if (!run) return [];
    const needle = query.trim().toLowerCase();
    return run.nodes.filter((node) => {
      if (onlyFailures && node.outcome !== "fail" && node.outcome !== "warn") return false;
      return !needle || node.uniqueId.toLowerCase().includes(needle);
    });
  }, [run, query, onlyFailures]);

  return (
    <div className="space-y-10">
      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void openFile(event.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-accent bg-raised/60" : "border-line bg-raised/20"
        }`}
      >
        <p className="text-base text-bright">
          {reading
            ? copy.dropzone.reading
            : dragging
              ? copy.dropzone.active
              : isSample
                ? copy.dropzone.replace
                : copy.dropzone.idle}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            {copy.dropzone.hint}
          </button>
          {!isSample && (
            <button
              type="button"
              onClick={() => void loadSample()}
              className="rounded-md border border-line px-4 py-2 text-sm text-bright transition-colors hover:border-accent hover:text-accent"
            >
              {copy.sample.label}
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void openFile(event.target.files?.[0])}
          />
        </div>
        <p className="mx-auto mt-4 max-w-xl text-xs leading-relaxed text-body/70">{copy.privacy}</p>
      </section>

      {error && (
        <section className="rounded-lg border border-[color:var(--viz-critical)] bg-raised/40 p-4">
          <p className="font-mono text-xs tracking-widest text-[color:var(--viz-critical)] uppercase">
            {copy.errors.heading}
          </p>
          <p className="mt-2 text-sm text-bright">{error}</p>
        </section>
      )}

      {run && summary && (
        <>
          {isSample && (
            <section className="rounded-lg border border-[color:var(--viz-warning)]/50 bg-raised/40 p-4">
              <p className="font-mono text-xs tracking-widest text-[color:var(--viz-warning)] uppercase">
                {copy.sample.banner}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-body">
                {copy.sample.bannerDetail}
              </p>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
              <p className="font-mono text-xs text-bright">
                {fileName}
                {isSample && (
                  <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-body/70">
                    sample
                  </span>
                )}
              </p>
              <p className="font-mono text-[11px] text-body/70">
                {[
                  run.command ? `dbt ${run.command}` : null,
                  run.dbtVersion ? `dbt ${run.dbtVersion}` : null,
                  run.target ? `target ${run.target}` : null,
                  run.configuredThreads ? `${run.configuredThreads} threads` : null,
                  run.generatedAt ? formatTimestamp(run.generatedAt) : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
            <SummaryTiles run={run} summary={summary} />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-bright">{copy.chart.title}</h2>
                <p className="mt-1 text-sm text-body/80">{copy.chart.lede}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-md border border-line p-0.5">
                  {MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setColorMode(mode)}
                      aria-pressed={colorMode === mode}
                      className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        colorMode === mode ? "bg-accent text-ink" : "text-body hover:text-accent"
                      }`}
                    >
                      {copy.chart.modes[mode]}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 font-mono text-[11px] text-body">
                  <input
                    type="checkbox"
                    checked={onlyFailures}
                    onChange={(event) => setOnlyFailures(event.target.checked)}
                    className="accent-[color:var(--viz-critical)]"
                  />
                  {copy.chart.onlyFailures}
                </label>

                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.chart.search}
                  className="w-44 rounded-md border border-line bg-raised/40 px-2.5 py-1 font-mono text-[11px] text-bright placeholder:text-body/50 focus:border-accent focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setResetKey((key) => key + 1)}
                  className="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-body transition-colors hover:border-accent hover:text-accent"
                >
                  {copy.chart.reset}
                </button>
              </div>
            </div>

            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {legend.map((entry) => (
                <li key={entry.label} className="flex items-center gap-2 text-xs text-body">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.label}
                  {entry.hint && <span className="text-body/50">({entry.hint})</span>}
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-line bg-raised/40 p-3">
              {run.timed.length === 0 ? (
                <p className="p-8 text-center text-sm text-body">{copy.chart.empty}</p>
              ) : (
                <Timeline
                  key={resetKey}
                  run={run}
                  summary={summary}
                  colorMode={colorMode}
                  query={query}
                  onlyFailures={onlyFailures}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}
            </div>
            <p className="font-mono text-[11px] text-body/60">{copy.chart.zoomHint}</p>

            {selected && <Detail node={selected} onClose={() => setSelected(null)} />}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-bright">{copy.table.title}</h2>
              <p className="mt-1 text-sm text-body/80">{copy.table.lede}</p>
            </div>
            <NodeTable
              nodes={filtered}
              runStart={run.startedAt ?? 0}
              untimed={filtered.filter((node) => node.startedAt === null).length}
              selected={selected}
              onSelect={setSelected}
            />
          </section>
        </>
      )}
    </div>
  );
}

function Detail({ node, onClose }: { node: RunNode; onClose: () => void }) {
  const facts: [string, string][] = [
    ["status", node.status],
    ["thread", node.thread],
    ["total", formatDuration(node.wallMs)],
    ["compile", node.compileMs === null ? "n/a" : formatDuration(node.compileMs)],
    ["execute", node.executeMs === null ? "n/a" : formatDuration(node.executeMs)],
    ["execution_time", formatDuration(node.executionMs)],
  ];
  if (node.rowsAffected !== null) facts.push(["rows", formatCount(node.rowsAffected)]);
  if (node.bytesBilled !== null) facts.push(["bytes billed", formatBytes(node.bytesBilled)]);
  if (node.bytesProcessed !== null) facts.push(["bytes processed", formatBytes(node.bytesProcessed)]);
  if (node.failures !== null) facts.push(["failures", formatCount(node.failures)]);

  return (
    <div className="rounded-lg border border-line bg-raised/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs break-all text-bright">{node.uniqueId}</p>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] text-body transition-colors hover:text-accent"
        >
          close
        </button>
      </div>
      <dl className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line/50 py-1.5">
            <dt className="font-mono text-[11px] text-body/70">{label}</dt>
            <dd className="font-mono text-[11px] text-bright tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {node.message && (
        <pre className="mt-3 overflow-x-auto rounded border border-line bg-ink/60 p-3 font-mono text-[11px] whitespace-pre-wrap text-body">
          {node.message}
        </pre>
      )}
    </div>
  );
}
