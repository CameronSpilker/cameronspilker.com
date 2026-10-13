import type { Metadata } from "next";
import { CharacterApp } from "@/components/character/CharacterApp";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { characterPage as copy } from "@/content/character";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `${copy.title} · ${site.name}`,
  description: copy.metaDescription,
  alternates: { canonical: `/${copy.slug}` },
  openGraph: {
    title: copy.title,
    description: copy.metaDescription,
    url: `${site.url}/${copy.slug}`,
    type: "website",
  },
};

export default function CharacterPage() {
  return (
    <>
      <ToolChrome crumb={{ href: `/${copy.slug}`, label: copy.slug }} />
      <CharacterApp />
    </>
  );
}
