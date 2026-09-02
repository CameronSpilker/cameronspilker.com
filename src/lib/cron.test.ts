/**
 * Run with `npm test` (Node's built-in runner, stripping the types).
 *
 * The Lab section tells a visitor when the pipeline next runs, so this is the
 * one piece of the site that can be quietly, confidently wrong. Every case
 * below is a schedule that actually exists in the lab repo, plus the two
 * daylight saving transitions that break naive arithmetic.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCountdown, nextRun } from "./cron.ts";

const DENVER = "America/Denver";

function fires(cron: string, from: string, expected: string, timeZone = DENVER) {
  const got = nextRun(cron, timeZone, new Date(from));
  assert.equal(got?.toISOString(), new Date(expected).toISOString());
}

test("nightly schedule, mountain daylight time", () => {
  // 06:00 MDT is 12:00 UTC.
  fires("0 6 * * *", "2026-09-02T05:00:00Z", "2026-09-02T12:00:00Z");
});

test("nightly schedule rolls to tomorrow once today has fired", () => {
  fires("0 6 * * *", "2026-09-02T13:00:00Z", "2026-09-03T12:00:00Z");
});

test("nightly schedule, mountain standard time", () => {
  // 06:00 MST is 13:00 UTC. The same expression, an hour later in UTC.
  fires("0 6 * * *", "2026-01-15T05:00:00Z", "2026-01-15T13:00:00Z");
});

test("march schedule skips the other eleven months", () => {
  fires("0 7,19 * 3 *", "2026-09-02T00:00:00Z", "2027-03-01T14:00:00Z");
});

test("march schedule takes the second firing of the day", () => {
  fires("0 7,19 * 3 *", "2026-03-15T18:00:00Z", "2026-03-16T01:00:00Z");
});

test("monthly schedule lands on the first", () => {
  fires("0 5 1 * *", "2026-09-02T00:00:00Z", "2026-10-01T11:00:00Z");
});

test("a wall clock time that daylight saving skips fires after the jump", () => {
  // 02:30 never happens on 8 March 2026 in Denver; the clock goes 01:59 to
  // 03:00. Cron fires it at 03:00, which is 09:00 UTC.
  fires("30 2 8 3 *", "2026-03-01T00:00:00Z", "2026-03-08T09:00:00Z");
});

test("a wall clock time that daylight saving repeats fires once", () => {
  // 01:30 happens twice on 1 November 2026. The first one wins.
  fires("30 1 1 11 *", "2026-10-31T00:00:00Z", "2026-11-01T07:30:00Z");
});

test("an impossible date has no next run", () => {
  assert.equal(nextRun("0 0 30 2 *", DENVER, new Date("2026-01-01T00:00:00Z")), null);
});

test("unsupported cron syntax throws rather than guessing", () => {
  assert.throws(() => nextRun("0 0 L * *", DENVER));
  assert.throws(() => nextRun("0 0 * *", DENVER));
});

test("countdown formatting", () => {
  assert.equal(formatCountdown(0), "00:00:00");
  assert.equal(formatCountdown(-5000), "00:00:00");
  assert.equal(formatCountdown(1000 * 3661), "01:01:01");
  assert.equal(formatCountdown(1000 * (86400 * 2 + 3661)), "2d 01:01:01");
});
