"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Měření návštěvnosti (R15.1, zásady „Měření návštěvnosti“) – vlastní skript, posílá jen na náš server (/api/m).
 * Nic neukládá do prohlížeče (žádné cookies ani jiné úložiště), nemá žádný identifikátor. Při zapnutém Do Not Track
 * nebo Global Privacy Control neposílá nic. Odesílá: cestu (bez query), doménu zdroje při příchodu na web a sekundy,
 * kdy byla stránka vidět.
 */

type Payload = { t: "v"; p: string; r?: string } | { t: "t"; p: string; s: number; n?: 1 } | { t: "e"; e: "quiz_done" | "calculator_used" };

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1" || w.doNotTrack === "1" || nav.msDoNotTrack === "1";
}

function send(data: Payload): void {
  if (optedOut()) return;
  const body = JSON.stringify(data);
  try {
    if (navigator.sendBeacon("/api/m", new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* níže fetch */
  }
  void fetch("/api/m", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => {});
}

/** Událost trychtýře z nástrojů (kvíz, kalkulačka) – jen název, nic dalšího. */
export function trackEvent(name: "quiz_done" | "calculator_used"): void {
  send({ t: "e", e: name });
}

/** Doména zdroje jen při příchodu z cizího webu; jen host, ne celá adresa. */
function externalReferrer(): string | undefined {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    return host && host !== window.location.hostname ? host : undefined;
  } catch {
    return undefined;
  }
}

let firstView = true;

export function AnalyticsBeacon() {
  const path = usePathname();

  useEffect(() => {
    if (!path) return;
    send({ t: "v", p: path, ...(firstView ? { r: externalReferrer() } : {}) });
    firstView = false;

    // čas, kdy byla stránka vidět; hlásí se při skrytí stránky, odchodu nebo přechodu na jinou stránku
    let visibleSince = document.visibilityState === "visible" ? Date.now() : null;
    let ms = 0;
    let reported = false;
    const flush = () => {
      if (visibleSince !== null) {
        ms += Date.now() - visibleSince;
        visibleSince = null;
      }
      const s = Math.round(ms / 1000);
      if (s > 0) {
        send({ t: "t", p: path, s, ...(reported ? {} : { n: 1 as const }) });
        reported = true;
      }
      ms = 0;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else if (visibleSince === null) visibleSince = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [path]);

  return null;
}
