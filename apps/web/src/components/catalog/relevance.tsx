import Link from "next/link";
import { RELEVANCE_LABEL, type EetRelevance } from "@ez/cz";

const TONE: Record<EetRelevance, { chip: string; dot: string }> = {
  likely: { chip: "bg-brand-100 text-brand-900", dot: "bg-brand-500" },
  possible: { chip: "bg-sun-100 text-warn-700", dot: "bg-sun-500" },
  unlikely: { chip: "bg-surface-2 text-ink-soft", dot: "bg-muted" },
};

/** Štítek „EET relevantní: …“ — heuristika podle oboru, ne právní verdikt. */
export function RelevanceChip({ relevance, short = false }: { relevance: EetRelevance; short?: boolean }) {
  const t = TONE[relevance];
  return (
    <span className={`chip ${t.chip}`}>
      <span className={`h-2 w-2 rounded-full ${t.dot}`} aria-hidden="true" />
      {short ? `EET: ${RELEVANCE_LABEL[relevance]}` : `EET relevantní: ${RELEVANCE_LABEL[relevance]}`}
    </span>
  );
}

export function RelevanceExplainer({ matched, basis = "obor" }: { matched?: string[]; basis?: "obor" | "zivnosti" }) {
  return (
    <p className="text-[15px] text-ink-soft">
      {basis === "zivnosti" ? "Odhad podle živností provozovny, případně podle oboru činnosti provozovatele" : "Odhad podle oboru činnosti"}
      {matched && matched.length > 0 && <> ({matched.join(", ")})</>}. Nejde o právní posouzení: evidovat se musí platby přijaté
      osobně (hotovost, karta, QR na místě) a záleží i na výjimkách a režimu daně.{" "}
      <Link href="/navody/koho-se-eet-tyka" className="font-medium text-brand-700 underline underline-offset-4">
        Koho se EET týká
      </Link>
    </p>
  );
}

export const RELEVANCE_FILTERS: { value: EetRelevance; label: string }[] = [
  { value: "likely", label: "EET pravděpodobně ano" },
  { value: "possible", label: "EET možná" },
  { value: "unlikely", label: "EET spíše ne" },
];

export function parseRelevance(v: string | string[] | undefined): EetRelevance | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "likely" || s === "possible" || s === "unlikely" ? s : undefined;
}
