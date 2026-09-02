import fs from "node:fs";
import path from "node:path";
import { archived, showcased } from "@/content/projects";
import { ProjectShowcase, type ShowcaseItem } from "./ProjectShowcase";
import { Tag } from "./Tag";

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
          Selected work
        </p>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-bright sm:text-4xl">
          Four products, four homepages. Keep scrolling.
        </h2>
      </div>

      <ProjectShowcase items={items} />

      <div className="mx-auto w-full max-w-5xl px-6 pt-20 pb-24 sm:pt-28">
        <p className="font-mono text-xs tracking-[0.2em] text-body/60 uppercase">
          Earlier work
        </p>
        <ul className="mt-8 divide-y divide-line/70 border-t border-line/70">
          {archived.map((project) => (
            <li
              key={project.slug}
              className="grid gap-2 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8"
            >
              <div>
                <h3 className="font-medium text-bright">{project.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-body/60">{project.kicker}</p>
              </div>
              <div>
                <p className="text-sm leading-relaxed">{project.blurb}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {project.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
                {(project.href ?? project.repo) && (
                  <a
                    href={project.href ?? project.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block font-mono text-xs text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                  >
                    {project.href ? "Visit site →" : "View the repo →"}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
