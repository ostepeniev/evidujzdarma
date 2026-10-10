"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Měření návštěvnosti (R15.1, zásady „Měření návštěvnosti“) – vlastní skript, posílá jen na náš server (/api/m).
 * Nic neukládá do prohlížeče (žádné cookies ani jiné úložiště), nemá žádný identifikátor. Při zapnutém Do Not Track
 * nebo Global Privacy Control neposílá nic. Odesílá: cestu (bez query), doménu zdroje a označení kampaně (UTM) při
 * příchodu na web a sekundy, kdy byla stránka vidět.
 */

type Utm = { s?: string; m?: string; c?: string };
type Payload = { t: "v"; p: string; r?: string; u?: Utm } | { t: "t"; p: string; s: number; n?: 1 } | { t: "e"; e: "quiz_done" | "calculator_used" };

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

/** Označení kampaně z adresy (R17.4, K9): jen utm_source, utm_medium, utm_campaign; server je ještě prověří. */
function utmFromUrl(): Utm | undefined {
  const q = new URLSearchParams(window.location.search);
  const u: Utm = {};
  // delší než 40 znaků se neposílá vůbec (nezkracuje se) – server stejně přijme jen [a-z0-9._-]{1,40}
  const take = (k: string) => {
    const v = q.get(k);
    return v && v.length <= 40 ? v : undefined;
  };
  const s = take("utm_source");
  const m = take("utm_medium");
  const c = take("utm_campaign");
  if (s) u.s = s;
  if (m) u.m = m;
  if (c) u.c = c;
  return u.s || u.m || u.c ? u : undefined;
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
    send({ t: "v", p: path, ...(firstView ? { r: externalReferrer(), u: utmFromUrl() } : {}) });
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
