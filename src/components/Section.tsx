/**
 * The frame every homepage section shares: a small label, one headline, an
 * optional line under it, and the content.
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
    <section id={id} className="py-14 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-semibold text-accent">{label}</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance text-bright sm:text-5xl">
          {title}
        </h2>
        {lede && <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">{lede}</p>}
        <div className="mt-8 sm:mt-10">{children}</div>
      </div>
    </section>
  );
}
