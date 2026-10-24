"use client";

import { useEffect, useState } from "react";
import { nav } from "@/content/home";
import { site } from "@/content/site";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The floating nav: a frosted pill that stays put while the page scrolls.
 *
 * On a phone the section links fold into a menu, so the pill only ever holds
 * the name, the appearance toggle and two buttons.
 */
export function Chrome() {
  const [open, setOpen] = useState(false);

  // Escape closes the menu, the way it closes anything else that opened.
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="glass mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-full py-2 pr-2 pl-5">
        <a href="#top" className="text-sm font-bold whitespace-nowrap text-bright sm:text-base">
          {site.name}
        </a>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Sections" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {nav.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="rounded-full px-3 py-2 text-sm text-body transition-colors hover:bg-bright/5 hover:text-bright"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="rounded-full px-3 py-2 text-sm font-medium text-bright transition-colors hover:bg-bright/5 md:hidden"
          >
            {open ? nav.close : nav.menu}
          </button>

          <a
            href="#contact"
            className="hidden rounded-full bg-bright px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90 sm:inline-block"
          >
            {nav.contact}
          </a>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Sections"
          className="glass mx-auto mt-2 w-full max-w-6xl rounded-3xl p-2 md:hidden"
        >
          <ul>
            {[...nav.sections, { id: "contact", label: nav.contact }].map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-base font-medium text-bright transition-colors hover:bg-bright/5"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
