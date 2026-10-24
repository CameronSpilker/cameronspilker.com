import { workIntro } from "@/content/home";
import { earlier, experience } from "@/content/experience";
import { site } from "@/content/site";
import { Section } from "./Section";
import { Tag } from "./Tag";

/**
 * The section a hiring manager skims. Each role is a card with its name and
 * dates up front; the current one shows its highlights, and the others keep
 * theirs one tap away so the page stays short on a phone.
 */
export function Experience() {
  return (
    <Section id="work" label={workIntro.label} title={workIntro.title} lede={workIntro.lede}>
      <ol className="space-y-4">
        {experience.map((role, index) => (
          <Role key={`${role.company}-${role.title}`} role={role} open={index === 0} />
        ))}
      </ol>

      <div className="glass mt-4 rounded-[28px] p-5 sm:p-7">
        <p className="text-sm font-semibold text-bright">{workIntro.earlier}</p>
        <ul className="mt-4 space-y-2.5">
          {earlier.map((role) => (
            <li
              key={`${role.company}-${role.title}`}
              className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-[8rem_1fr]"
            >
              <span className="text-xs text-body/80 sm:pt-0.5">{role.years}</span>
              <span>
                <span className="text-bright">{role.company}</span>
                <span className="text-body"> · {role.title}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <a
        href={site.linkedin}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-bright"
      >
        {workIntro.linkedin} <span aria-hidden="true">&rarr;</span>
      </a>
    </Section>
  );
}

function Role({ role, open }: { role: (typeof experience)[number]; open: boolean }) {
  return (
    <li className="glass rounded-[28px] p-5 sm:p-7">
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-1 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-xl font-bold tracking-tight text-bright">{role.company}</span>
            <span className="block text-sm text-body">{role.title}</span>
          </span>
          <span className="flex items-center gap-3 text-xs text-body/80">
            {role.start} to {role.end}
            <span
              aria-hidden="true"
              className="inline-block text-base text-accent transition-transform group-open:rotate-45"
            >
              +
            </span>
          </span>
        </summary>

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
      </details>
    </li>
  );
}
