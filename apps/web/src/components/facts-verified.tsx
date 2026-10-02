import { FACTS_UPDATED } from "@/content/facts";

/** „Ověřeno k …“ pod zdroji nástroje – kdy jsme naposledy ověřili fakta, ze kterých nástroj vychází (C Дрібне 15). */
export function FactsVerified({ className = "mt-2 text-sm text-muted" }: { className?: string }) {
  return (
    <p className={className}>
      Ověřeno k <time dateTime={FACTS_UPDATED}>{new Date(FACTS_UPDATED).toLocaleDateString("cs-CZ")}</time>.
    </p>
  );
}
