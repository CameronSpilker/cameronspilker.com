import fs from "node:fs";
import path from "node:path";
import { showcased } from "@/content/projects";
import { ProjectShowcase, type ShowcaseItem } from "./ProjectShowcase";

const SHOT_DIR = path.join(process.cwd(), "public", "shots");
const EXTENSIONS = [".webp", ".png", ".jpg"];

/**
 * Resolve a capture for each project at build time, so a project without a
 * screenshot falls back to its wireframe instead of rendering a broken image.
 * Run `npm run shots` to populate `public/shots/`.
 */
function findShot(slug: string): string | undefined {
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(path.join(SHOT_DIR, slug + ext))) return `/shots/${slug}${ext}`;
  }
  return undefined;
}

export function Projects() {
  const items: ShowcaseItem[] = showcased.map((project) => ({
    ...project,
    image: findShot(project.slug),
  }));

  return (
    <section id="projects" className="relative">
      <div className="mx-auto w-full max-w-5xl px-6 pt-24 pb-16 sm:pt-32">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
          Things I built and still run
        </p>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-bright sm:text-4xl">
          Four live projects. Every one of them is something you can use in the
          next five minutes.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          A data pipeline that grades its own forecasts, a newsletter written by
          AI agents, a card you can send someone today, and a health check for
          your HOA&rsquo;s books. Keep scrolling.
        </p>
      </div>

      <ProjectShowcase items={items} />
    </section>
  );
}
