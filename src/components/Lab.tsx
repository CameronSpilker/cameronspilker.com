"use client";

import { useSyncExternalStore } from "react";
import { elsewhere, intro, nightly, stats } from "@/content/lab";
import type { Project } from "@/content/projects";
import { lab } from "@/content/site";
import { formatCountdown, formatInZone, nextRun } from "@/lib/cron";
import { Tag } from "./Tag";

/**
 * The clock behind the countdown.
 *
 * It is an external system rather than component state: it outlives any render,
 * and the server snapshot is null so the markup React renders on the server
 * matches what it hydrates, with the real time arriving on the first tick.
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

/** The next firing only changes when the last one passes, so resolve it once. */
let upcoming: Date | null = null;

function cachedNextRun(now: Date): Date | null {
  if (upcoming && upcoming.getTime() > now.getTime()) return upcoming;
  upcoming = nextRun(nightly.cron, nightly.timezone, now);
  return upcoming;
}

function useSecondTicker(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    () => clock.stamp,
    () => null,
  );
}

/**
 * The lab's card on the homepage.
 *
 * It gets a card of its own rather than a project tile because it is the one
 * project with something live to show: the countdown is computed in the
 * browser from the cron string Dagster actually runs on, so it cannot drift
 * from the real schedule.
 */
export function Lab({ project }: { project: Project }) {
  const stamp = useSecondTicker();
  const now = stamp === null ? null : new Date(stamp);
  const next = now ? cachedNextRun(now) : null;

  return (
    <article id="stack" className="glass scroll-mt-28 rounded-[28px] p-5 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs font-semibold text-accent">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {intro.label} · {project.kicker}
          </span>
          <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-bright sm:text-4xl">{project.name}</h3>
          <p className="mt-3 text-lg leading-relaxed text-bright/90">{project.summary}</p>
          <p className="mt-3 text-sm leading-relaxed">{intro.primary.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          {lab.dashboard && (
            <a
              href={lab.dashboard}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-full bg-bright px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            >
              {intro.primary.label} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line/70 bg-surface/60 p-4">
              <p className="text-3xl font-extrabold tracking-tight text-bright sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-xs text-body">{stat.label}</p>
            </div>
          ))}

          {/* Live, and provably so: the same cron string Dagster runs on,
              resolved here in the reader's browser. */}
          <div className="col-span-2 rounded-2xl border border-line/70 bg-surface/60 p-4">
            <p className="text-xs text-body">{intro.countdownLabel}</p>
            <p className="mt-1 font-mono text-2xl text-bright tabular-nums" suppressHydrationWarning>
              {next && now ? formatCountdown(next.getTime() - now.getTime()) : "--:--:--"}
            </p>
            <p className="mt-1 text-xs text-body/80" suppressHydrationWarning>
              {nightly.cadence}
              {next ? ` · ${formatInZone(next, nightly.timezone)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap gap-2 border-t border-line/70 pt-5">
        {elsewhere
          .filter((item) => item.href)
          .map((item) => (
            <li key={item.title}>
              <a
                href={item.href ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-sm text-bright transition-colors hover:border-accent hover:text-accent"
              >
                {item.title}
              </a>
            </li>
          ))}
      </ul>
    </article>
  );
}
