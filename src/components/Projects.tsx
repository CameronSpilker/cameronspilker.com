import { projects, type ProjectState } from "@/content/projects";
import { Section } from "./Section";
import { Tag } from "./Tag";

const stateLabel: Record<ProjectState, string> = {
  live: "Live",
  repo: "Open source",
  archive: "No longer active",
};

export function Projects() {
  return (
    <Section id="projects" label="03 / portfolio" title="Things I have built">
      <div className="grid gap-6 sm:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.slug}
            className={`flex flex-col rounded-lg border border-line bg-surface p-6 transition-colors hover:border-accent/40 ${
              project.featured ? "sm:col-span-2" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-medium text-bright">{project.name}</h3>
              <span className="shrink-0 font-mono text-xs text-body/60">
                {stateLabel[project.state]}
              </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed">{project.blurb}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            {(project.href || project.repo) && (
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm">
                {project.href && (
                  <a
                    href={project.href}
                    className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                  >
                    Visit site →
                  </a>
                )}
                {project.repo && (
                  <a
                    href={project.repo}
                    className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                  >
                    View repo →
                  </a>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}
