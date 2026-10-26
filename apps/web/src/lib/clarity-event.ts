/**
 * S4b (23. 10. 2026): události pro Microsoft Clarity – filtr záznamů a trychtýře v Clarity (např. /eet-pro/… → quiz_done →
 * prereg_done). Clarity běží jen se souhlasem s analytickými cookies (components/consent/consent-manager.tsx); bez souhlasu
 * window.clarity neexistuje a volání nic neudělá. Posílá jen název události, žádné údaje z formuláře.
 */
export type ClarityEventName = "quiz_done" | "calculator_used" | "prereg_done" | "service_order";

export function clarityEvent(name: ClarityEventName): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { clarity?: (...args: unknown[]) => void };
  w.clarity?.("event", name);
}
