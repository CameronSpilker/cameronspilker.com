import { experience } from "@/content/experience";
import { Section } from "./Section";
import { Tag } from "./Tag";

export function Experience() {
  return (
    <Section id="experience" label="02 / experience" title="Where I have worked">
      <ol className="space-y-12">
        {experience.map((role) => (
          <li
            key={`${role.company}-${role.title}`}
            className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:gap-8"
          >
            <p className="font-mono text-xs text-body/70 sm:pt-1">
              {role.start} — {role.end}
            </p>
            <div>
              <h3 className="text-lg font-medium text-bright">{role.company}</h3>
              <p className="mt-0.5 text-sm text-body">{role.title}</p>
              <ul className="mt-4 space-y-2">
                {role.highlights.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-relaxed">
                    <span aria-hidden="true" className="text-accent">
                      ·
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {role.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
