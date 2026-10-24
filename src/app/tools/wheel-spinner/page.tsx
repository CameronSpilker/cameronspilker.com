import type { Metadata } from "next";
import { ToolChrome } from "@/components/tools/ToolChrome";
import { WheelSpinner } from "@/components/tools/WheelSpinner";
import { wheelTool as copy } from "@/content/tools";
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

export default function WheelSpinnerPage() {
  return (
    <>
      <ToolChrome />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-bright sm:text-5xl">
          <span className="text-gradient">{copy.title}</span>
        </h1>
        <p className="mt-3 text-base text-body sm:text-lg">{copy.lede}</p>

        <div className="mt-6 sm:mt-8">
          <WheelSpinner />
        </div>
      </main>
    </>
  );
}
