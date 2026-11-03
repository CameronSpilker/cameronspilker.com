import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { GiftListView } from "@/components/tools/gift-list/GiftListView";
import { giftListTool as copy } from "@/content/tools";
import { site } from "@/content/site";
import { SLUG_PATTERN } from "@/lib/gifts/ids";
import { isConfigured, loadList } from "@/lib/gifts/server/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** One query per request, shared by the metadata and the page. */
const getList = cache(async (slug: string) => {
  if (!SLUG_PATTERN.test(slug) || !isConfigured()) return null;
  return loadList(slug, true);
});

/**
 * What a messaging app shows when the link is pasted: the list's name, the
 * owner's note, and the card drawn by `opengraph-image.tsx` beside this file.
 * Lists are unlisted, so search engines are asked to stay out.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) return { title: `${copy.name} · ${site.name}`, robots: { index: false } };
  const description = list.note || copy.share.ideas(list.items.length);
  return {
    title: list.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: list.title,
      description,
      url: `${site.url}/tools/gift-list/${slug}`,
      siteName: site.name,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: list.title, description },
  };
}

export default async function GiftListGuestPage({ params }: Props) {
  const { slug } = await params;
  if (!isConfigured()) {
    return (
      <>
        <ToolChrome />
        <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <p className="glass rounded-[28px] p-8 text-center text-bright">{copy.errors.not_configured}</p>
        </main>
      </>
    );
  }
  const list = await getList(slug);
  if (!list) notFound();
  return (
    <>
      <ToolChrome />
      <main className="w-full px-4 py-8 sm:px-6 sm:py-12">
        <GiftListView initial={list} />
      </main>
    </>
  );
}
