import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { GiftListEditor } from "@/components/tools/gift-list/GiftListEditor";
import { giftListTool as copy } from "@/content/tools";
import { site } from "@/content/site";
import { SLUG_PATTERN } from "@/lib/gifts/ids";

export const metadata: Metadata = {
  title: `Edit your list · ${site.name}`,
  description: copy.description,
  robots: { index: false, follow: false },
};

/**
 * The edit key rides in the URL fragment (`#key=...`), which browsers never
 * send to a server, so it stays out of request logs. The editor reads it in the
 * page and sends it with each change.
 */
export default async function GiftListEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug)) notFound();
  return (
    <>
      <ToolChrome />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <GiftListEditor slug={slug} />
      </main>
    </>
  );
}
