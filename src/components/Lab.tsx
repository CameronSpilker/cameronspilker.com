"use client";

import { useSyncExternalStore } from "react";
import { elsewhere, intro, nightly, stats } from "@/content/lab";
import { lab } from "@/content/site";
import { formatCountdown, formatInZone, nextRun } from "@/lib/cron";

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
 * The project that gets more than a showcase panel.
 *
 * It used to get three tabs of explanation sitting on a portfolio. That was the
 * wrong place for it twice over: a visitor who wants the story is better served
 * on the dashboard's own site, and the copy went stale the moment the lab repo
 * changed, because it lived a repository away from the thing it described.
 *
 * So this section makes one argument and offers one destination. The countdown
 * is here because it is the one claim on the page that cannot be faked: it is
 * computed in the browser from the cron string Dagster actually runs on.
 */
export function Lab() {
  const stamp = useSecondTicker();
  const now = stamp === null ? null : new Date(stamp);
  const next = now ? cachedNextRun(now) : null;

  return (
    <section
      id="stack"
      className="relative flex min-h-[100svh] flex-col justify-center border-t border-line/60 py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{intro.label}</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-balance text-bright sm:text-4xl">
          {intro.title}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{intro.lede}</p>

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

        <div className="mt-10 grid gap-6 rounded-lg border border-line bg-surface p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-base leading-relaxed text-bright">{intro.primary.detail}</p>
            {lab.dashboard && (
              <a
                href={lab.dashboard}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-5 py-2.5 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
              >
                {intro.primary.label}
                <span aria-hidden="true">&rarr;</span>
              </a>
            )}
          </div>

          {/* Live, and provably so: the same cron string Dagster runs on,
              resolved here in the reader's browser. */}
          <div className="rounded border border-line/70 bg-ink px-5 py-4">
            <p className="font-mono text-[11px] tracking-wider text-body/50 uppercase">
              {intro.countdownLabel}
            </p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-bright" suppressHydrationWarning>
              {next && now ? formatCountdown(next.getTime() - now.getTime()) : "--:--:--"}
            </p>
            <p className="mt-2 font-mono text-[11px] text-body/60" suppressHydrationWarning>
              {next ? formatInZone(next, nightly.timezone) : " "}
            </p>
            <p className="mt-3 font-mono text-[11px] text-body/50">
              {nightly.cadence} · {nightly.cron}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-body/70">{nightly.what}</p>
          </div>
        </div>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {elsewhere.map((item) => {
            const body = (
              <>
                <p className="font-medium text-bright">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed">{item.detail}</p>
                {item.href && (
                  <p className="mt-3 font-mono text-xs text-accent">
                    Open <span aria-hidden="true">&rarr;</span>
                  </p>
                )}
              </>
            );

            return (
              <li key={item.title} className="bg-surface">
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-full p-5 transition-colors hover:bg-raised"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="p-5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
