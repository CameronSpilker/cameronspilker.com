import { hero } from "@/content/home";
import { site } from "@/content/site";

const links = [
  { label: "GitHub", href: site.github },
  { label: "LinkedIn", href: site.linkedin },
  { label: "Email", href: `mailto:${site.email}` },
];

export function Hero() {
  return (
    <header id="top" className="px-4 pt-32 pb-10 text-center sm:px-6 sm:pt-44 sm:pb-16">
      <span className="glass inline-block rounded-full px-4 py-1.5 text-xs font-semibold text-accent sm:text-sm">
        {hero.chip}
      </span>
      <h1 className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.02] font-extrabold tracking-tight text-bright sm:text-7xl lg:text-8xl">
        {hero.hello}
        <br />
        <span className="text-gradient">{hero.line}</span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-balance sm:text-xl">{hero.lede}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#projects"
          className="rounded-full bg-bright px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 sm:text-base"
        >
          {hero.primary} <span aria-hidden="true">↓</span>
        </a>
        <a
          href="#contact"
          className="glass rounded-full px-6 py-3 text-sm font-semibold text-bright transition-colors hover:text-accent sm:text-base"
        >
          {hero.secondary}
        </a>
      </div>

      <ul className="mt-8 flex items-center justify-center gap-5 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-body underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </header>
  );
}
