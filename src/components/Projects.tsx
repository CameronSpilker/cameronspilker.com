import fs from "node:fs";
import path from "node:path";
import { projectsIntro } from "@/content/home";
import { projects, type Project } from "@/content/projects";
import { Lab } from "./Lab";
import { Section } from "./Section";
import { Tag } from "./Tag";

const SHOT_DIR = path.join(process.cwd(), "public", "shots");
const EXTENSIONS = [".webp", ".png", ".jpg"];
const LAB = "full-data-stack-lab";

/**
 * Resolve a capture for each project at build time, so a project without a
 * screenshot shows its card without one instead of a broken image. Run
 * `npm run shots` to populate `public/shots/`.
 */
function findShot(slug: string): string | undefined {
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(path.join(SHOT_DIR, slug + ext))) return `/shots/${slug}${ext}`;
  }
  return undefined;
}

/**
 * The first project gets the big card. The rest share a row, and the lab sits
 * underneath in a card of its own, because it carries a live countdown.
 */
export function Projects() {
  const [featured, ...rest] = projects.filter((project) => project.slug !== LAB);
  const lab = projects.find((project) => project.slug === LAB);

  return (
    <Section id="projects" label={projectsIntro.label} title={projectsIntro.title} lede={projectsIntro.lede}>
      <FeaturedCard project={featured} image={findShot(featured.slug)} />

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {rest.map((project) => (
          <ProjectCard key={project.slug} project={project} image={findShot(project.slug)} />
        ))}
      </div>

      {lab && (
        <div className="mt-5">
          <Lab project={lab} />
        </div>
      )}
    </Section>
  );
}

function Shot({ project, image }: { project: Project; image?: string }) {
  if (!image) return null;
  return (
    <a
      href={project.cta.href}
      target="_blank"
      rel="noreferrer"
      tabIndex={-1}
      aria-hidden="true"
      className="block overflow-hidden rounded-2xl border border-line/70 bg-surface"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static capture in public/ */}
      <img
        src={image}
        alt=""
        loading="lazy"
        className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 hover:scale-[1.02]"
      />
    </a>
  );
}

function Cta({ project, solid = false }: { project: Project; solid?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <a
        href={project.cta.href}
        target="_blank"
        rel="noreferrer"
        className={
          solid
            ? "rounded-full bg-bright px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            : "text-sm font-semibold text-accent transition-colors hover:text-bright"
        }
      >
        {project.cta.label} <span aria-hidden="true">→</span>
      </a>
      {project.cta.note && <span className="text-xs text-body/80">{project.cta.note}</span>}
    </div>
  );
}

function FeaturedCard({ project, image }: { project: Project; image?: string }) {
  return (
    <article className="glass grid items-center gap-6 rounded-[28px] p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10 lg:p-8">
      <div className="order-2 px-2 pb-2 lg:order-1 lg:px-0 lg:pb-0">
        <span className="inline-block rounded-full border border-line bg-surface/60 px-3 py-1 text-xs font-semibold text-accent">
          {project.kicker}
        </span>
        <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-bright sm:text-4xl">{project.name}</h3>
        <p className="mt-3 text-lg leading-relaxed text-bright/90">{project.summary}</p>
        <p className="mt-3 text-sm leading-relaxed">{project.blurb}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <div className="mt-6">
          <Cta project={project} solid />
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <Shot project={project} image={image} />
      </div>
    </article>
  );
}

function ProjectCard({ project, image }: { project: Project; image?: string }) {
  return (
    <article className="glass flex flex-col rounded-[28px] p-4 sm:p-5">
      <Shot project={project} image={image} />
      <div className="flex flex-1 flex-col px-2 pt-5 pb-2">
        <p className="text-xs font-semibold text-accent">{project.kicker}</p>
        <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-bright">{project.name}</h3>
        <p className="mt-2 leading-relaxed">{project.summary}</p>
        <p className="mt-2 text-sm leading-relaxed text-body/85">{project.blurb}</p>
        <div className="mt-auto pt-5">
          <Cta project={project} />
        </div>
      </div>
    </article>
  );
}
