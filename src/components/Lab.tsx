"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { dashboardPages, layers, schedules, stats } from "@/content/lab";
import { lab } from "@/content/site";
import { formatCountdown, formatInZone, nextRun } from "@/lib/cron";

/**
 * One second-hand shared by every countdown on the page.
 *
 * The clock is an external system rather than component state: one interval
 * serves all three schedules, and the server snapshot is null so the markup
 * React renders on the server matches what it hydrates, with the real time
 * arriving on the first tick after hydration.
 */
const clock = {
  stamp: Date.now(),
  listeners: new Set<() => void>(),
  timer: undefined as number | undefined,
};

function subscribeToClock(onChange: () => void) {
  clock.listeners.add(onChange);
  clock.timer ??= window.setInterval(() => {
    clock.stamp = Date.now();
    for (const listener of clock.listeners) listener();
  }, 1000);

  return () => {
    clock.listeners.delete(onChange);
    if (clock.listeners.size === 0) {
      window.clearInterval(clock.timer);
      clock.timer = undefined;
    }
  };
}

/**
 * A schedule's next firing only changes when the last one passes, so resolve
 * each cron once and keep it until then rather than re-walking the calendar
 * every second.
 */
const upcoming = new Map<string, Date>();

function cachedNextRun(cron: string, timeZone: string, now: Date): Date | null {
  const key = `${cron}|${timeZone}`;
  const cached = upcoming.get(key);
  if (cached && cached.getTime() > now.getTime()) return cached;

  const next = nextRun(cron, timeZone, now);
  if (next) upcoming.set(key, next);
  else upcoming.delete(key);
  return next;
}

/** Milliseconds since the epoch, ticking once a second, null until hydrated. */
function useSecondTicker(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    () => clock.stamp,
    () => null,
  );
}

const TABS = [
  { id: "methodology", label: "Methodology", blurb: "How the thing is built, and why each layer is the layer it is." },
  { id: "pipeline", label: "Pipeline", blurb: "The real orchestration schedule, counting down to its next run." },
  { id: "dashboard", label: "Dashboard", blurb: "The five pages the marts exist to serve." },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * The project that gets more than a panel.
 *
 * The showcase sells it in one screen; this is where someone who wants to know
 * whether the work is real can open each layer. Three tabs rather than one long
 * scroll, because the three audiences differ: a hiring manager reads
 * Methodology, a data engineer reads Pipeline, and everyone else wants to see
 * the dashboard.
 */
export function Lab() {
  const [tab, setTab] = useState<TabId>("methodology");
  const base = useId();
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <section
      id="stack"
      className="relative flex min-h-[100svh] flex-col justify-center border-t border-line/60 py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
          Analytics engineering
        </p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-balance text-bright sm:text-4xl">
          Full Data Stack Lab, layer by layer
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          One repository holding every stage of an analytics stack: the
          extractors, the warehouse, the models and their tests, the
          orchestrator, and the dashboard. Open whichever layer you would ask
          about in an interview.
        </p>

        <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-line/70 py-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="font-mono text-2xl text-bright">{stat.value}</span>
                <span className="mt-1 block font-mono text-xs tracking-wider text-body/60 uppercase">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <div role="tablist" aria-label="Full Data Stack Lab" className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const selected = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`${base}-panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`rounded-t border-b-2 px-4 py-2.5 font-mono text-sm transition-colors ${
                    selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-transparent text-body/70 hover:border-line hover:text-bright"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-line/70">
            <p className="pt-4 font-mono text-xs text-body/60">{active.blurb}</p>

            <div
              role="tabpanel"
              id={`${base}-panel-${tab}`}
              aria-labelledby={`${base}-tab-${tab}`}
              className="pt-8"
            >
              {tab === "methodology" && <Methodology />}
              {tab === "pipeline" && <Pipeline />}
              {tab === "dashboard" && <Dashboard />}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 font-mono text-sm">
          <a
            href={lab.repo}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          >
            Read every line of it on GitHub
          </a>
          {lab.docs && (
            <a
              href={lab.docs}
              target="_blank"
              rel="noreferrer"
              className="text-body underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent"
            >
              Browse the dbt docs and lineage
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    // The pipeline is a genuine sequence, so it gets numbered steps and a
    // connecting rail. Nothing else on the page is numbered.
    <ol className="relative grid gap-3 sm:grid-cols-5">
      <span
        aria-hidden="true"
        className="absolute top-9 right-4 left-4 hidden h-px bg-gradient-to-r from-accent/50 via-line to-line sm:block"
      />
      {layers.map((layer, i) => (
        <li
          key={layer.name}
          className="relative rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent/40"
        >
          <p className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
          <p className="mt-2 font-medium text-bright">{layer.name}</p>
          <p className="mt-1 font-mono text-xs text-body/70">{layer.tool}</p>
          <p className="mt-3 text-xs leading-relaxed text-body/80">{layer.detail}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * The orchestration tab.
 *
 * The countdowns are computed in the browser from the same cron strings the
 * Dagster schedules hold, so what is on screen is the real cadence rather than
 * an animation standing in for one. They render as a dash until the first
 * client tick, which keeps the server and client markup identical.
 */
function Pipeline() {
  const stamp = useSecondTicker();
  const now = stamp === null ? null : new Date(stamp);

  return (
    <>
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <p className="font-mono text-xs tracking-wider text-body/60 uppercase">
          Asset graph
        </p>
        <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
          {layers.map((layer, i) => (
            <li key={layer.name} className="flex items-center gap-2">
              <span className="rounded border border-line bg-raised px-3 py-1.5 font-mono text-xs text-bright">
                {layer.name.toLowerCase()}
              </span>
              {i < layers.length - 1 && (
                <span aria-hidden="true" className="flow-rail" />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm leading-relaxed">
          Dagster models this as assets rather than tasks, so ingestion and the
          dbt DAG share one lineage graph. A sensor watching the games asset
          rebuilds the models the moment fresh scores land, which means the
          dashboard is never more than one run behind the warehouse.
        </p>
      </div>

      <ul className="mt-8 grid gap-4 lg:grid-cols-3">
        {schedules.map((schedule) => {
          const next = now ? cachedNextRun(schedule.cron, schedule.timezone, now) : null;

          return (
            <li
              key={schedule.name}
              className="flex flex-col rounded-lg border border-line bg-surface p-5"
            >
              <p className="font-mono text-xs break-all text-accent">{schedule.name}</p>
              <p className="mt-3 text-sm text-bright">{schedule.cadence}</p>
              <p className="mt-0.5 font-mono text-xs text-body/50">
                {schedule.cron} · {schedule.timezone}
              </p>

              <div className="mt-4 rounded border border-line/70 bg-ink px-3 py-2.5">
                <p className="font-mono text-[11px] tracking-wider text-body/50 uppercase">
                  Next run in
                </p>
                <p
                  className="mt-1 font-mono text-lg tabular-nums text-bright"
                  suppressHydrationWarning
                >
                  {next && now ? formatCountdown(next.getTime() - now.getTime()) : "--:--:--"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-body/50" suppressHydrationWarning>
                  {next ? formatInZone(next, schedule.timezone) : " "}
                </p>
              </div>

              <p className="mt-4 text-sm leading-relaxed">{schedule.what}</p>
              <p className="mt-2 text-xs leading-relaxed text-body/70">{schedule.why}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-body/60">
        These are the literal cron expressions from the repo&rsquo;s Dagster
        definitions, evaluated here in your browser. GitHub Actions runs the same
        pipeline daily and publishes the rebuilt warehouse as a release asset, so
        the dashboard builds from a clean checkout without a local run.
      </p>
    </>
  );
}

function Dashboard() {
  return (
    <>
      <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {dashboardPages.map((page, i) => (
          <li
            key={page.path}
            // Five pages in two columns leaves a hole. The last one, which is
            // the page worth reading first, fills the row instead.
            className={`bg-surface p-5 ${
              i === dashboardPages.length - 1 ? "sm:col-span-2" : ""
            }`}
          >
            <p className="font-mono text-xs text-body/50">{page.path}</p>
            <h3 className="mt-2 font-medium text-bright">{page.title}</h3>
            <p className="mt-2 text-sm text-accent">{page.question}</p>
            <p className="mt-2 text-sm leading-relaxed">{page.detail}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-lg border border-line bg-surface p-5 sm:p-6">
        {lab.dashboard ? (
          <>
            <p className="text-sm leading-relaxed">
              The dashboard is built from the same DuckDB file dbt writes, so
              every number on it comes from a tested model rather than a query
              typed into a BI tool.
            </p>
            <a
              href={lab.dashboard}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-5 py-2.5 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
            >
              Open the live dashboard
              <span aria-hidden="true">→</span>
            </a>
          </>
        ) : (
          <>
            <p className="font-mono text-xs tracking-wider text-body/60 uppercase">
              Not deployed yet
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              The Evidence project runs locally today and deploys once the
              pipeline has committed a warehouse built from the live APIs.
              Publishing fabricated tournament odds under real school names is
              the kind of thing that gets screenshotted and believed, so this
              link stays dark until the numbers are real.
            </p>
            <a
              href={`${lab.repo}/tree/main/dashboard/pages`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-block font-mono text-sm text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            >
              Read the page sources meanwhile →
            </a>
          </>
        )}
      </div>
    </>
  );
}
