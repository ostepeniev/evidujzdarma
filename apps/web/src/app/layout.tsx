import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import "./globals.css";
import { SITE, SITE_URL } from "@/lib/site";
import { JsonLd, organizationLd, websiteLd } from "@/lib/jsonld";
import { OG_DEFAULTS } from "@/lib/metadata";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EvidujZdarma – evidence tržeb EET 2.0 zdarma, i bez signálu",
    template: "%s | EvidujZdarma",
  },
  description: SITE.description,
  applicationName: SITE.name,
  // canonical i og:url si nastavuje každá indexovaná stránka sama (canonicalMeta) – v kořeni by je zdědila i stránka bez
  // vlastního a sdílený odkaz by ukazoval na úvodní stránku (C Дрібне 18, R9.13)
  openGraph: { ...OG_DEFAULTS },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icons/180" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b7a57",
  width: "device-width",
  initialScale: 1,
};

/** Písmo s diakritikou (latin-ext) i základní latinka – text nad ohybem je potřebuje hned (S1, LCP). */
const FONTS = ["/fonts/v1/inter-latin-wght-normal.woff2", "/fonts/v1/inter-latin-ext-wght-normal.woff2"];

export default function RootLayout({ children }: LayoutProps<"/">) {
  for (const href of FONTS) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <JsonLd data={[organizationLd(), websiteLd()]} />
        {children}
      </body>
    </html>
  );
}
