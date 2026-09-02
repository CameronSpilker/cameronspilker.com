"use client";

import { useEffect, useRef } from "react";
import type { Project } from "@/content/projects";
import { SiteBackdrop, SiteFrame } from "./SitePreview";
import { Tag } from "./Tag";

export type ShowcaseItem = Project & { image?: string };

/**
 * The takeover: each project pins to the viewport and the page becomes that
 * site, then hands off to the next one.
 *
 * Scroll position drives two custom properties per panel: `--enter` (0 as the
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
              <SiteBackdrop preview={project.preview!} image={project.image} />
            </div>

            <div className="showcase-copy relative mx-auto grid h-full w-full max-w-7xl items-center gap-8 px-6 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
              <div className="flex flex-col justify-center">
              <p
                className="font-mono text-xs tracking-[0.2em] uppercase"
                style={{ color: project.preview!.accent }}
              >
                {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                <span className="text-body/60"> · {project.kicker}</span>
              </p>

              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-bright sm:text-5xl">
                {project.name}
              </h3>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-bright sm:text-lg">
                {project.summary}
              </p>

              {/* The panel is pinned to one viewport, and on a phone the
                  summary plus the frame already fill it. The detail paragraph
                  is the first thing to give up when there is no room. */}
              <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-body sm:block">
                {project.blurb}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>

              {/* The button says what the visitor leaves with, and the line
                  under it says what it costs them. "Visit site" says neither. */}
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-sm">
                <a
                  href={project.cta.href}
                  {...(isExternal(project.cta.href)
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className="inline-flex items-center gap-2 rounded border px-5 py-2.5 transition-colors"
                  style={{
                    color: project.preview!.accent,
                    borderColor: `${project.preview!.accent}66`,
                    backgroundColor: `${project.preview!.accent}1a`,
                  }}
                >
                  {project.cta.label}
                  <span aria-hidden="true">{isExternal(project.cta.href) ? "→" : "↓"}</span>
                </a>
                {project.repo && project.repo !== project.cta.href && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-bright underline decoration-line underline-offset-4 transition-colors hover:decoration-current"
                  >
                    Read the source →
                  </a>
                )}
              </div>

              {project.cta.note && (
                <p className="mt-3 max-w-md font-mono text-xs leading-relaxed text-body/60">
                  {project.cta.note}
                </p>
              )}
              </div>

              {/* Bleeds past the right edge on wide screens: the site should
                  feel like it is taking the page over, not sitting in a slot. */}
              <div className="lg:-mr-[5vw]">
                <SiteFrame
                  preview={project.preview!}
                  image={project.image}
                  alt={`${project.name} homepage`}
                  href={project.href}
                />
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

/** In-page anchors must not open a new tab, and must not be rel=noreferrer. */
function isExternal(href: string) {
  return !href.startsWith("#");
}
