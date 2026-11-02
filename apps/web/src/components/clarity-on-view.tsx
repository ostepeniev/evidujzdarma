"use client";

import { useEffect } from "react";
import { clarityEvent, type ClarityEventName } from "@/lib/clarity-event";

/**
 * S11: událost při zobrazení stránky (např. acc_lp_view na /ucetni) – jen přes clarityEvent, tedy jen se souhlasem
 * s analytickými cookies; bez souhlasu nic. Nic nevykresluje.
 */
export function ClarityOnView({ name }: { name: ClarityEventName }) {
  useEffect(() => {
    // Clarity se načítá asynchronně až po souhlasu – krátce počkáme, ať událost nepropadne
    const t = window.setTimeout(() => clarityEvent(name), 1500);
    return () => window.clearTimeout(t);
  }, [name]);
  return null;
}
