import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pos/sw-register";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Pokladna", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b7a57",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AppLayout({ children }: LayoutProps<"/">) {
  // S4b: pojistka – kdyby Microsoft Clarity z marketingových stránek běžel dál, obsah pokladny a kabinetu skryje
  // (consent-manager.tsx ho při odchodu zastaví); display: contents nemění rozvržení
  return (
    <div data-clarity-mask="true" className="contents">
      <ServiceWorkerRegister />
      {children}
    </div>
  );
}
