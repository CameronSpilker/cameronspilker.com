import Link from "next/link";
import { site } from "@/content/site";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The header a tool page wears. Deliberately not the homepage `Chrome`: that
 * one tracks scroll progress through the homepage sections and its links are
 * anchors into a page that is not this one. What a tool page needs instead is a
 * way back and the same appearance control.
 */
export function ToolChrome() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="font-mono text-xs whitespace-nowrap text-bright transition-colors hover:text-accent sm:text-sm"
          >
            {site.name}
          </Link>
          <span aria-hidden="true" className="font-mono text-xs text-body/40">
            /
          </span>
          <Link href="/tools" className="font-mono text-xs text-body/70 transition-colors hover:text-accent">
            tools
          </Link>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
