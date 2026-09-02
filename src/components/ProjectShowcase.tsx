"use client";

import { useEffect, useRef } from "react";
import type { Project } from "@/content/projects";
import { SitePreview } from "./SitePreview";
import { Tag } from "./Tag";

export type ShowcaseItem = Project & { image?: string };

/**
 * The takeover: each project pins to the viewport and the page becomes that
 * site, then hands off to the next one.
 *
 * Scroll position drives two custom properties per panel — `--enter` (0 as the
 * panel approaches, 1 once pinned) and `--exit` (0 while pinned, 1 once it has
 * scrolled away). All the motion lives in CSS reading those two numbers, so
 * this effect costs one passive listener and one rAF per frame. Both default to
 * a fully visible resting state, which is what renders before hydration and
 * what stays if JavaScript never arrives.
 */
export function ProjectShowcase({ items }: { items: ShowcaseItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const tracks = Array.from(root.querySelectorAll<HTMLElement>("[data-track]"));
    let frame = 0;

    const paint = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      for (const track of tracks) {
        const { top, bottom } = track.getBoundingClientRect();
        const enter = clamp((vh - top) / vh);
        const exit = clamp((vh - bottom) / vh);
        track.style.setProperty("--enter", enter.toFixed(3));
        track.style.setProperty("--exit", exit.toFixed(3));
      }
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
    <div ref={rootRef}>
      {items.map((project, i) => (
        <div
          key={project.slug}
          data-track
          className="showcase-track relative h-[180vh]"
          style={{ zIndex: i + 1 }}
        >
          <div className="sticky top-0 h-[100svh] overflow-hidden">
            <div className="showcase-layer absolute inset-0">
              <SitePreview
                preview={project.preview!}
                image={project.image}
                alt={`${project.name} homepage`}
              />
            </div>

            <div className="showcase-copy relative mx-auto flex h-full w-full max-w-5xl flex-col justify-center px-6">
              <p
                className="font-mono text-xs tracking-[0.2em] uppercase"
                style={{ color: project.preview!.accent }}
              >
                {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                <span className="text-body/60"> · {project.kicker}</span>
              </p>

              <h3 className="mt-4 text-4xl font-semibold tracking-tight text-bright sm:text-6xl">
                {project.name}
              </h3>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-body sm:text-lg">
                {project.blurb}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-sm">
                {project.href && (
                  <a
                    href={project.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded border px-5 py-2.5 transition-colors"
                    style={{
                      color: project.preview!.accent,
                      borderColor: `${project.preview!.accent}66`,
                      backgroundColor: `${project.preview!.accent}1a`,
                    }}
                  >
                    Visit {project.name}
                    <span aria-hidden="true">→</span>
                  </a>
                )}
                {project.repo && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-bright underline decoration-line underline-offset-4 transition-colors hover:decoration-current"
                  >
                    View the repo →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function clamp(n: number) {
  return Math.min(1, Math.max(0, n));
}
