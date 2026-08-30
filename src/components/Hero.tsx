import { site } from "@/content/site";

const links = [
  { label: "GitHub", href: site.github },
  { label: "LinkedIn", href: site.linkedin },
  { label: "Email", href: `mailto:${site.email}` },
];

export function Hero() {
  return (
    <header className="mx-auto flex min-h-[85vh] w-full max-w-5xl flex-col justify-center px-6 py-24">
      <p className="font-mono text-sm text-accent">
        <span aria-hidden="true">$ </span>whoami
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-bright sm:text-6xl">
        {site.name}
      </h1>
      <p className="mt-3 font-mono text-base text-body sm:text-lg">{site.title}</p>
      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-body sm:text-xl">
        {site.tagline}
      </p>

      <nav className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-sm">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-body underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="mt-12">
        <a
          href="#projects"
          className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-5 py-2.5 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
        >
          View my work
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </header>
  );
}
