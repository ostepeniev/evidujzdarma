import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { ConsentManager } from "@/components/consent/consent-manager";
import { MobileCta } from "@/components/mobile-cta";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="obsah" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileCta />
      {/* měření návštěvnosti bez cookies, jen marketingové stránky (R15.1) */}
      <AnalyticsBeacon />
      {/* S4-COOKIES: lišta a nastavení cookies, značky třetích stran jen po souhlasu (lib/consent.ts) */}
      <ConsentManager />
    </>
  );
}
