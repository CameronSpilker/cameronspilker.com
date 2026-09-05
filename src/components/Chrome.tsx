"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";
import { ThemeToggle } from "./ThemeToggle";

// Same order as the page. The active-section logic below walks this list and
// takes the last match, so it has to stay in document order.
const sections = [
  { id: "projects", label: "Projects" },
  { id: "stack", label: "Lab" },
  { id: "tools", label: "Tools" },
  { id: "work", label: "Experience" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

/**
 * The one piece of the page that never leaves: a name, the section you are in,
 * and how far through you are. It is what keeps the full-screen project
 * takeovers feeling like this site rather than a redirect.
 */
export function Chrome() {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    let frame = 0;

    const paint = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? window.scrollY / scrollable : 0);
      setLifted(window.scrollY > 24);

      // The section whose top has most recently crossed a third of the screen.
      const line = window.innerHeight / 3;
      let current: string | null = null;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-colors duration-300 ${
          lifted ? "border-b border-line/60 bg-ink/80 backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-3.5">
          <a
            href="#top"
            className="font-mono text-xs whitespace-nowrap text-bright transition-colors hover:text-accent sm:text-sm"
          >
            {site.name}
          </a>

          <div className="flex items-center gap-3 sm:gap-6">
            <nav aria-label="Sections">
              <ul className="flex items-center gap-3 font-mono text-[11px] sm:gap-6 sm:text-xs">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={active === section.id ? "true" : undefined}
                      className={`transition-colors hover:text-accent ${
                        active === section.id ? "text-accent" : "text-body/70"
                      }`}
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <ThemeToggle />
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="h-px origin-left bg-accent transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </header>
  );
}
