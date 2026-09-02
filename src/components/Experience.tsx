import { experience } from "@/content/experience";
import { site } from "@/content/site";
import { Tag } from "./Tag";

/**
 * Deliberately not a takeover. Eleven roles is something a hiring manager
 * skims, so the heading pins and the roles scroll past it — the same
 * full-height staging as everything else, without pinning content they need to
 * read at their own pace.
 */
export function Experience() {
  const [current, ...rest] = experience;

  return (
    <section id="work" className="relative border-t border-line/60">
      <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-24 sm:py-32 lg:grid-cols-[18rem_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:h-fit">
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Experience</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-bright sm:text-4xl">
            Nine years of making numbers defensible.
          </h2>
          <p className="mt-5 text-sm leading-relaxed">
            Analytics engineering at Typeform, Apollo.io, and Gopuff; data
            engineering before that. The through line is migrations, cost, and
            trust — the work that makes a dashboard worth opening.
          </p>
          <a
            href={site.linkedin}
            className="mt-6 inline-block font-mono text-sm text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          >
            Full history on LinkedIn →
          </a>
        </div>

        <ol className="space-y-14">
          <Role role={current} highlight />
          {rest.map((role) => (
            <Role key={`${role.company}-${role.title}`} role={role} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Role({
  role,
  highlight = false,
}: {
  role: (typeof experience)[number];
  highlight?: boolean;
}) {
  return (
    <li className="relative border-l border-line/70 pl-6">
      <span
        aria-hidden="true"
        className={`absolute top-2 -left-[3px] h-1.5 w-1.5 rounded-full ${
          highlight ? "bg-accent" : "bg-line"
        }`}
      />
      <p className="font-mono text-xs text-body/60">
        {role.start} — {role.end}
        {role.location && <span className="text-body/40"> · {role.location}</span>}
      </p>
      <h3 className="mt-2 text-lg font-medium text-bright">{role.company}</h3>
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
    </li>
  );
}
