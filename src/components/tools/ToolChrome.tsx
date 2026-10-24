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
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="glass mx-auto flex w-full max-w-6xl items-center justify-between gap-6 rounded-full py-2 pr-2 pl-5">
        <div className="flex items-baseline gap-2.5">
          <Link
            href="/"
            className="text-sm font-bold whitespace-nowrap text-bright transition-colors hover:text-accent sm:text-base"
          >
            {site.name}
          </Link>
          <span aria-hidden="true" className="text-sm text-body/50">
            /
          </span>
          <Link href="/tools" className="text-sm text-body transition-colors hover:text-accent">
            tools
          </Link>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
