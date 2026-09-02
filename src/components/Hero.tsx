import { site } from "@/content/site";

const links = [
  { label: "GitHub", href: site.github },
  { label: "LinkedIn", href: site.linkedin },
  { label: "Email", href: `mailto:${site.email}` },
];

export function Hero() {
  return (
    <header
      id="top"
      className="relative flex min-h-[100svh] w-full flex-col justify-center overflow-hidden"
    >
      {/* Ambient field: the same gradient language the project panels use, at
          a fraction of the intensity, so the takeovers feel prefigured here. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_15%_10%,rgba(76,201,164,0.10),transparent_60%),radial-gradient(60%_50%_at_85%_80%,rgba(124,169,255,0.08),transparent_60%)]"
      />

      <div className="relative mx-auto w-full max-w-5xl px-6 py-28">
        <p className="font-mono text-sm text-accent">
          <span aria-hidden="true">$ </span>whoami
        </p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight text-balance text-bright sm:text-7xl">
          {site.name}
        </h1>
        <p className="mt-4 font-mono text-base text-body sm:text-lg">{site.title}</p>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-balance text-body sm:text-xl">
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
            See the work
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-8 mx-auto w-full max-w-5xl px-6 font-mono text-xs tracking-[0.18em] text-body/45 uppercase">
        Scroll <span aria-hidden="true">↓</span>
      </p>
    </header>
  );
}
