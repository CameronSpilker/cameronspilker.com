import { workIntro } from "@/content/home";
import { earlier, experience } from "@/content/experience";
import { site } from "@/content/site";
import { Section } from "./Section";
import { Tag } from "./Tag";

/**
 * The section a hiring manager skims. Each role leads with three short hits,
 * so the impact reads at a glance, and keeps the full bullets one tap away so
 * the page stays short on a phone.
 */
export function Experience() {
  return (
    <Section id="work" label={workIntro.label} title={workIntro.title} lede={workIntro.lede}>
      <ol className="space-y-4">
        {experience.map((role) => (
          <Role key={`${role.company}-${role.title}`} role={role} />
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

function Role({ role }: { role: (typeof experience)[number] }) {
  return (
    <li className="glass rounded-[28px] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-bright">{role.company}</h3>
          <p className="text-sm text-body">{role.title}</p>
        </div>
        <p className="text-xs text-body/80">
          {role.start} to {role.end}
        </p>
      </div>

      {/* The hits: what a skimming reader takes away without opening anything. */}
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {role.hits.map((hit) => (
          <li
            key={hit}
            className="flex gap-2 rounded-2xl border border-line/70 bg-surface/60 px-3.5 py-2.5 text-sm leading-snug font-medium text-bright"
          >
            <span aria-hidden="true" className="text-accent">
              ✓
            </span>
            {hit}
          </li>
        ))}
      </ul>

      <details className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-bright [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">{workIntro.more}</span>
          <span className="hidden group-open:inline">{workIntro.less}</span>
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">
            ↓
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
