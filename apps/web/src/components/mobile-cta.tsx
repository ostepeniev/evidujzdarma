"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SERVICE_COPY } from "@/lib/site";

/**
 * Tlačítko připnuté dole na telefonu (< 640 px) na marketingových stránkách (R14.5). Schová se, když je formulář
 * #registrace vidět; pod obsahem je místo na jeho výšku, aby nepřekrylo patičku ani odkazy. Odkaz – dosažitelný
 * klávesnicí. Text a cíl ze SERVICE_COPY (isClosed("/pokladna")).
 */
export function MobileCta() {
  const [formInView, setFormInView] = useState(false);

  useEffect(() => {
    const form = document.getElementById("registrace");
    if (!form || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setFormInView(entries.some((e) => e.isIntersecting)));
    io.observe(form);
    return () => io.disconnect();
  }, []);

  return (
    <div data-mobile-cta className="sm:hidden">
      {/* místo pod patičkou na výšku tlačítka */}
      <div data-mobile-cta-spacer="true" aria-hidden="true" className="h-20" />
      {!formInView && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
          <Link href={SERVICE_COPY.startCta.href} className="btn-primary w-full py-3 text-base">
            {SERVICE_COPY.startCta.label}
          </Link>
        </div>
      )}
    </div>
  );
}
