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
function Glyph({ setting }: { setting: Appearance }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {setting === "light" && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
      {setting === "dark" && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />}
      {setting === "system" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

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
 * through, and the floating nav has room for a glyph, not a popover.
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
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm text-body transition-colors hover:bg-bright/5 hover:text-accent"
    >
      <Glyph setting={setting} />
      <span className="hidden text-xs xl:inline">{LABELS[setting]}</span>
    </button>
  );
}
