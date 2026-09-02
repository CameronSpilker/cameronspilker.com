/**
 * Just enough cron to count down to the next run of a known schedule.
 *
 * The Lab section shows when the pipeline fires next, and the only honest way
 * to do that is to evaluate the same expressions the orchestrator holds. This
 * supports the fields those expressions use: `*`, single values, comma lists,
 * ranges, and `*` with a step. It deliberately does not support `L`, `W`, `#`,
 * or named months and days, and it throws rather than guessing when it meets
 * one, so a schedule this cannot read fails loudly at the call site instead of
 * rendering a plausible wrong time.
 */

type Fields = {
  minute: number[];
  hour: number[];
  dayOfMonth: number[] | null;
  month: number[];
  dayOfWeek: number[] | null;
};

const RANGES = {
  minute: [0, 59],
  hour: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  dayOfWeek: [0, 6],
} as const;

function parseField(field: string, key: keyof typeof RANGES): number[] {
  const [min, max] = RANGES[key];
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const [spec, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Bad step in "${part}"`);

    let from: number;
    let to: number;
    if (spec === "*") {
      [from, to] = [min, max];
    } else if (spec.includes("-")) {
      const [a, b] = spec.split("-").map(Number);
      [from, to] = [a, b];
    } else {
      from = to = Number(spec);
    }

    if (!Number.isInteger(from) || !Number.isInteger(to) || from < min || to > max || from > to) {
      throw new Error(`Unsupported cron field "${part}" for ${key}`);
    }
    for (let v = from; v <= to; v += step) values.add(v);
  }

  return [...values].sort((a, b) => a - b);
}

function parse(expression: string): Fields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expected 5 cron fields, got ${parts.length}`);

  const [minute, hour, dom, month, dow] = parts;
  return {
    minute: parseField(minute, "minute"),
    hour: parseField(hour, "hour"),
    // A restricted day-of-month and day-of-week are ORed together by cron, so
    // `*` has to stay distinguishable from "every day listed out".
    dayOfMonth: dom === "*" ? null : parseField(dom, "dayOfMonth"),
    month: parseField(month, "month"),
    dayOfWeek: dow === "*" ? null : parseField(dow, "dayOfWeek"),
  };
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Constructing an Intl.DateTimeFormat is the expensive part of all of this,
// and resolving one schedule builds several. There are two zones on the whole
// site, so cache them.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, build: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let cached = formatters.get(key);
  if (!cached) {
    cached = build();
    formatters.set(key, cached);
  }
  return cached;
}

/** The wall-clock reading of an instant in a given zone. */
function wallClock(instant: Date, timeZone: string): Wall {
  const parts = formatter(
    `wall:${timeZone}`,
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
      }),
  ).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Midnight formats as hour 24 in some engines; normalise it.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/**
 * The instant at which a zone's clock reads the given wall time.
 *
 * Two passes: guess that the wall time is UTC, measure how far off the zone
 * actually is at that guess, correct, then measure again in case the correction
 * crossed a DST boundary. A skipped hour resolves to the instant just after the
 * jump, which is also when a cron daemon would fire it.
 */
function fromWallClock(wall: Omit<Wall, "weekday">, timeZone: string): Date {
  const target = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);

  let instant = new Date(target);
  for (let pass = 0; pass < 2; pass++) {
    const seen = wallClock(instant, timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    const drift = target - seenAsUtc;
    if (drift === 0) return instant;
    instant = new Date(instant.getTime() + drift);
  }

  // Still short of the requested wall time after both passes means the clock
  // never reads it: a spring-forward jumped over it. Walk to the first minute
  // on the far side of the jump, which is when a cron daemon would fire it.
  for (let minute = 0; minute < 180; minute++) {
    if (stamp(wallClock(instant, timeZone)) >= target) break;
    instant = new Date(instant.getTime() + 60_000);
  }

  return instant;
}

/** A wall-clock reading as a comparable instant, ignoring its zone. */
function stamp(wall: Wall): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
}

/**
 * The first firing of `expression` strictly after `from`, or null if there is
 * none within a year (which for a valid expression means the calendar fields
 * can never be satisfied, e.g. February 30th).
 */
export function nextRun(expression: string, timeZone: string, from: Date = new Date()): Date | null {
  const fields = parse(expression);
  const start = wallClock(from, timeZone);

  // Walk day by day rather than minute by minute: 366 iterations covers any
  // expression this parser accepts, where minutes would be over half a million.
  for (let offset = 0; offset <= 366; offset++) {
    const day = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const date = day.getUTCDate();

    if (!fields.month.includes(month)) continue;
    if (!matchesDay(fields, date, day.getUTCDay())) continue;

    for (const hour of fields.hour) {
      for (const minute of fields.minute) {
        const candidate = fromWallClock({ year, month, day: date, hour, minute }, timeZone);
        if (candidate.getTime() > from.getTime()) return candidate;
      }
    }
  }

  return null;
}

/** Cron ORs a restricted day-of-month with a restricted day-of-week. */
function matchesDay(fields: Fields, dayOfMonth: number, dayOfWeek: number): boolean {
  const { dayOfMonth: dom, dayOfWeek: dow } = fields;
  if (dom === null && dow === null) return true;
  if (dom !== null && dow !== null) return dom.includes(dayOfMonth) || dow.includes(dayOfWeek);
  if (dom !== null) return dom.includes(dayOfMonth);
  return dow!.includes(dayOfWeek);
}

/**
 * "4d 02:11:35" style countdown. Rendered client-side only, since the answer
 * depends on the moment it is asked.
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${days > 0 ? `${days}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** "Mon 6 Jan, 06:00 MST" for a firing, in the schedule's own zone. */
export function formatInZone(instant: Date, timeZone: string): string {
  return formatter(
    `label:${timeZone}`,
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
        hour12: false,
      }),
  ).format(instant);
}
