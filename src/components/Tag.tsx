export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface/60 px-2.5 py-0.5 text-xs text-body">
      {children}
    </span>
  );
}
