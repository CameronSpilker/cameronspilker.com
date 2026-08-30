import { site } from "@/content/site";

const links = [
  { label: "Email", href: `mailto:${site.email}`, text: site.email },
  { label: "LinkedIn", href: site.linkedin, text: "in/cameronspilker" },
  { label: "GitHub", href: site.github, text: "CameronSpilker" },
];

export function Footer() {
  return (
    <footer
      id="contact"
      className="border-t border-line/70 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          06 / contact
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-bright sm:text-3xl">
          Get in touch
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed">
          Open to conversations about analytics engineering work, data platform
          problems, and anything built in public.
        </p>

        <dl className="mt-10 grid gap-6 sm:grid-cols-3">
          {links.map((link) => (
            <div key={link.label}>
              <dt className="font-mono text-xs uppercase tracking-wider text-body/60">
                {link.label}
              </dt>
              <dd className="mt-1.5">
                <a
                  href={link.href}
                  className="text-sm text-bright underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                >
                  {link.text}
                </a>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-16 font-mono text-xs text-body/50">
          © {new Date().getFullYear()} {site.name} · Built with Next.js, deployed
          on Vercel
        </p>
      </div>
    </footer>
  );
}
