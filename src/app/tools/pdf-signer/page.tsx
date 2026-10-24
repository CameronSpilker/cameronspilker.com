import type { Metadata } from "next";
import { PdfSigner } from "@/components/tools/PdfSigner";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { pdfSignerTool as copy } from "@/content/tools";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `${copy.name} · ${site.name}`,
  description: copy.description,
  alternates: { canonical: `/tools/${copy.slug}` },
  openGraph: {
    title: copy.title,
    description: copy.description,
    url: `${site.url}/tools/${copy.slug}`,
    type: "website",
  },
};

export default function PdfSignerPage() {
  return (
    <>
      <ToolChrome />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{copy.name}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-bright sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{copy.lede}</p>

        <div className="mt-8 sm:mt-12">
          <PdfSigner />
        </div>
      </main>
    </>
  );
}
