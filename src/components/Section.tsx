export function Section({
  id,
  label,
  title,
  children,
}: {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-line/70 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-5xl px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          {label}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-bright sm:text-3xl">
          {title}
        </h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
