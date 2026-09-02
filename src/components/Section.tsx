/**
 * The rhythm every non-takeover section shares: a full-height stage, a mono
 * label, and one headline. Consistent framing is what makes the project
 * takeovers read as part of the same page rather than a separate experience.
 */
export function Section({
  id,
  label,
  title,
  lede,
  children,
}: {
  id: string;
  label: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative flex min-h-[100svh] flex-col justify-center border-t border-line/60 py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{label}</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-balance text-bright sm:text-4xl">
          {title}
        </h2>
        {lede && <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{lede}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
