"use client";

import { useEffect, useState } from "react";
import { PALETTES, PALETTE_STORAGE_KEY, isPalette, type Palette } from "@/lib/palette";
import { paletteLabels, palettePicker } from "@/content/palettes";

/**
 * The corner switcher for comparing palettes on the real pages. Temporary,
 * like everything keyed on `data-palette`.
 */
export function PalettePicker() {
  const [palette, setPalette] = useState<Palette>("current");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const value = document.documentElement.getAttribute("data-palette");
    // Synchronising with what the head script already applied before hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isPalette(value)) setPalette(value);
    // Folded on a phone, where it would otherwise cover the page.
    if (window.matchMedia("(max-width: 1023px)").matches) setOpen(false);
  }, []);

  const choose = (next: Palette) => {
    setPalette(next);
    const root = document.documentElement;
    if (next === "current") root.removeAttribute("data-palette");
    else root.setAttribute("data-palette", next);
    try {
      sessionStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // The picker still works for this page without storage.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("palette", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="fixed bottom-24 left-4 z-[60] lg:bottom-4 max-w-[calc(100%-2rem)] rounded-xl border border-line bg-surface/95 p-2 shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-1.5 py-0.5 font-mono text-[11px] tracking-wider text-body uppercase"
      >
        {palettePicker.title}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <>
          <div role="group" aria-label={palettePicker.title} className="mt-2 flex flex-wrap gap-1.5">
            {PALETTES.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={palette === id}
                onClick={() => choose(id)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  palette === id
                    ? "border-accent bg-accent text-ink"
                    : "border-line text-bright hover:border-accent hover:text-accent"
                }`}
              >
                {paletteLabels[id]}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1.5 text-[11px] text-body/70">{palettePicker.hint}</p>
        </>
      )}
    </div>
  );
}
