import { about, contact } from "@/content/home";
import { site } from "@/content/site";
import { Section } from "./Section";

const links = [
  { label: "Email", href: `mailto:${site.email}`, text: site.email },
  { label: "LinkedIn", href: site.linkedin, text: "in/cameronspilker" },
  { label: "GitHub", href: site.github, text: "CameronSpilker" },
];

/** About and contact side by side: who I am, then how to reach me. */
export function About() {
  return (
    <Section id="about" label={about.label} title={about.title}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="glass rounded-[28px] p-6 sm:p-8">
          <div className="max-w-2xl space-y-4 text-base leading-relaxed">
            {about.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <dl className="mt-6 grid gap-4 border-t border-line/70 pt-6 sm:grid-cols-2">
            {about.facts.map((fact) => (
              <div key={fact.k}>
                <dt className="text-xs text-body/80">{fact.k}</dt>
                <dd className="mt-0.5 text-sm font-medium text-bright">{fact.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div id="contact" className="glass scroll-mt-28 rounded-[28px] p-6 sm:p-8">
          <p className="text-sm font-semibold text-accent">{contact.label}</p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-bright sm:text-3xl">{contact.title}</h3>
          <p className="mt-3 leading-relaxed">{contact.lede}</p>
          <ul className="mt-6 space-y-2">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line/70 bg-surface/60 px-4 py-3 transition-colors hover:border-accent"
                >
                  <span className="text-xs text-body">{link.label}</span>
                  <span className="truncate text-sm font-medium text-bright">{link.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
