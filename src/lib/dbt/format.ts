/** Number and duration formatting shared by the chart, the tiles and the table. */

/** "840ms", "9.4s", "2m 30s", "1h 04m". Readable at every scale a run spans. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "n/a";
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Elapsed position within a run, for axis ticks: "0:00", "1:45", "1:02:30". */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const tail = `${minutes}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : tail;
}

export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return "n/a";
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const power = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log10(bytes) / 3));
  const value = bytes / 1000 ** power;
  return `${value >= 100 || power === 0 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[power]}`;
}

/** UTC, because a run_results file is UTC and the reader may not be. */
export function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}
