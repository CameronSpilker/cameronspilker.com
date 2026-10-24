import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { site } from "@/content/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} · ${site.title}`,
  description: site.tagline,
  openGraph: {
    title: `${site.name} · ${site.title}`,
    description: site.tagline,
    url: site.url,
    siteName: site.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before the first paint so a stored appearance is already on the
          document, rather than arriving after a frame of the wrong one.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${jakarta.variable} ${geistMono.variable} font-sans antialiased`}>
        {/* The lights behind every page, fixed so the cards drift over them. */}
        <div aria-hidden="true" className="aurora pointer-events-none fixed inset-0 -z-10" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
