import type { Metadata } from "next";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { ColorEcho } from "@/components/games/ColorEcho";
import { colorEcho as copy } from "@/content/games";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `${copy.name} · ${site.name}`,
  description: copy.description,
  alternates: { canonical: `/games/${copy.slug}` },
  openGraph: {
    title: copy.name,
    description: copy.description,
    url: `${site.url}/games/${copy.slug}`,
    type: "website",
  },
};

export default function ColorEchoPage() {
  return (
    <>
      <ToolChrome section={{ href: "/games", label: "games" }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-bright sm:text-5xl">
          <span className="text-gradient">{copy.name}</span>
        </h1>
        <p className="mt-3 text-base text-body sm:text-lg">{copy.lede}</p>

        <div className="mt-6 sm:mt-8">
          <ColorEcho />
        </div>

        <details className="mx-auto mt-10 max-w-[460px] text-sm">
          <summary className="cursor-pointer font-semibold text-bright">{copy.rules.title}</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
            {copy.rules.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2 className="mt-5 font-semibold text-bright">{copy.rules.keysTitle}</h2>
          <dl className="mt-2 space-y-2">
            {copy.rules.keys.map((item) => (
              <div key={item.k} className="flex flex-col sm:flex-row sm:gap-6">
                <dt className="font-mono text-bright sm:w-36 sm:shrink-0">{item.k}</dt>
                <dd>{item.v}</dd>
              </div>
            ))}
          </dl>
        </details>
      </main>
    </>
  );
}
