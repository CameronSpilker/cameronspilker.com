"use client";

import { useSyncExternalStore } from "react";
import { elsewhere, intro, nightly, stats } from "@/content/lab";
import type { Project } from "@/content/projects";
import { formatCountdown, nextRun } from "@/lib/cron";

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
 * project with numbers and something live to show: a capture of the dashboard,
 * the headline counts, and a countdown computed in the browser from the cron
 * string Dagster actually runs on, so it cannot drift from the real schedule.
 */
export function Lab({ project, image }: { project: Project; image?: string }) {
  const stamp = useSecondTicker();
  const now = stamp === null ? null : new Date(stamp);
  const next = now ? cachedNextRun(now) : null;

  return (
    <article id="stack" className="glass scroll-mt-28 rounded-[28px] p-4 sm:p-6 lg:p-8">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10">
        <div className="order-2 px-2 lg:order-1 lg:px-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs font-semibold text-accent">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {intro.label} · {project.kicker}
          </span>
          <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-bright sm:text-4xl">{project.name}</h3>
          <p className="mt-3 text-lg leading-relaxed text-bright/90">{project.summary}</p>
          <a
            href={project.cta.href}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block rounded-full bg-bright px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            {project.cta.label} <span aria-hidden="true">→</span>
          </a>
        </div>

        {image && (
          <a
            href={project.cta.href}
            target="_blank"
            rel="noreferrer"
            tabIndex={-1}
            aria-hidden="true"
            className="order-1 block overflow-hidden rounded-2xl border border-line/70 bg-surface lg:order-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a static capture in public/ */}
            <img
              src={image}
              alt=""
              loading="lazy"
              className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 hover:scale-[1.02]"
            />
          </a>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line/70 bg-surface/60 p-4">
            <p className="text-2xl font-extrabold tracking-tight text-bright sm:text-3xl">{stat.value}</p>
            <p className="mt-1 text-xs text-body">{stat.label}</p>
          </div>
        ))}

        {/* Live, and provably so: the same cron string Dagster runs on,
            resolved here in the reader's browser. */}
        <div className="col-span-2 rounded-2xl border border-line/70 bg-surface/60 p-4 lg:col-span-1">
          <p className="text-xs text-body">{intro.countdownLabel}</p>
          <p className="mt-1 font-mono text-2xl text-bright tabular-nums" suppressHydrationWarning>
            {next && now ? formatCountdown(next.getTime() - now.getTime()) : "--:--:--"}
          </p>
          <p className="mt-1 text-xs text-body/80">{nightly.cadence}</p>
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2 border-t border-line/70 pt-5">
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
