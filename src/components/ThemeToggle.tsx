"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  APPEARANCES,
  THEME_STORAGE_KEY,
  isAppearance,
  type Appearance,
} from "@/lib/theme";

const LABELS: Record<Appearance, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** Sun, moon, and the half-filled circle that means "whatever the OS says". */
const GLYPHS: Record<Appearance, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

/**
 * The stored setting is an external system, not component state: it outlives
 * the page, another tab can change it, and the script in `<head>` reads it
 * before React exists. So it is read through a store rather than copied into
 * state on mount.
 */
const listeners = new Set<() => void>();
let cached: Appearance | null = null;

function read(): Appearance {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isAppearance(stored)) return stored;
  } catch {
    // Storage can be blocked outright. Following the system is the safe answer.
  }
  return "system";
}

function publish() {
  cached = read();
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // A change in another tab should not leave this one on the old appearance.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      publish();
      apply(read());
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Appearance {
  return (cached ??= read());
}

/** No storage on the server, so the markup React sends is always "system". */
function getServerSnapshot(): Appearance {
  return "system";
}

function systemAppearance(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(setting: Appearance) {
  const resolved = setting === "system" ? systemAppearance() : setting;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

function next(setting: Appearance): Appearance {
  return APPEARANCES[(APPEARANCES.indexOf(setting) + 1) % APPEARANCES.length];
}

/**
 * The appearance control, one button wide.
 *
 * It cycles rather than opening a menu: three settings is short enough to click
 * through, and the chrome rail has room for a glyph and a word, not a popover.
 */
export function ThemeToggle() {
  const setting = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Following the system means following it while the page is open, too.
  useEffect(() => {
    if (setting !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [setting]);

  const advance = () => {
    const chosen = next(setting);
    apply(chosen);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, chosen);
    } catch {
      // The appearance holds for this visit, just not past it.
    }
    publish();
  };

  return (
    <button
      type="button"
      onClick={advance}
      aria-label={`Appearance: ${LABELS[setting]}. Switch to ${LABELS[next(setting)]}.`}
      title={`Appearance: ${LABELS[setting]}`}
      className="inline-flex items-center gap-1.5 rounded border border-line/70 px-2 py-1 font-mono text-[11px] text-body/70 transition-colors hover:border-accent/40 hover:text-accent sm:text-xs"
    >
      <span aria-hidden="true">{GLYPHS[setting]}</span>
      <span className="hidden sm:inline">{LABELS[setting]}</span>
    </button>
  );
}
