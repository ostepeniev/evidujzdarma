import Link from "next/link";
import type { EetRelevance } from "@ez/cz";
import { getGuide, isIndexable } from "@/content/guides";
import { eetGuideFor, eetVerdict, type EetGuideRef } from "@/lib/catalog-eet";
import { kontrolaIcoHref } from "@/lib/hash-params";
import { IconArrow, IconReceipt, IconShield } from "./icons";

const TONE: Record<EetRelevance, { box: string; badge: string; dot: string }> = {
  likely: { box: "border-brand-200 bg-brand-50", badge: "bg-brand-600 text-white", dot: "bg-white" },
  possible: { box: "border-sun-300 bg-warn-50", badge: "bg-sun-300 text-ink", dot: "bg-warn-700" },
  unlikely: { box: "border-line bg-surface", badge: "bg-surface-2 text-ink", dot: "bg-muted" },
};

/** Smí se návod ukázat? Jen existující a po odborné revizi (Ф9). */
export function guideAvailable(slug: string): boolean {
  const g = getGuide(slug);
  return !!g && isIndexable(g);
}

/**
 * Panel „EET 2.0 a tato firma“ (S3): odhad podle oboru srozumitelně, vždy s výhradou, že rozhoduje způsob placení;
 * odkaz na nejvhodnější návod (lib/catalog-eet.ts) a ověření podle IČO (IČO jen ve fragmentu).
 */
export function EetPanel({
  relevance,
  nace,
  ico,
  basis,
  title = "EET 2.0 a tato firma",
  guide: guideOverride,
}: {
  relevance: EetRelevance;
  nace: readonly string[];
  ico?: string;
  basis?: string[];
  title?: string;
  /** návod oboru (stránky obor × obec / kraj mají vlastní přiřazení z components/catalog/industry.ts) */
  guide?: Pick<EetGuideRef, "slug" | "label">;
}) {
  const v = eetVerdict(relevance);
  const guide = guideOverride && guideAvailable(guideOverride.slug) ? guideOverride : eetGuideFor(nace, relevance, guideAvailable);
  const t = TONE[relevance];
  return (
    <section className={`rounded-2xl border-2 p-6 ${t.box}`} aria-labelledby="eet-panel-h">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-white p-2 text-brand-700 ring-1 ring-line">
          <IconReceipt />
        </span>
        <h2 id="eet-panel-h" className="text-xl font-bold text-ink">
          {title}
        </h2>
        <span className={`chip px-3 py-1 text-sm ${t.badge}`}>
          <span className={`h-2 w-2 rounded-full ${t.dot}`} aria-hidden="true" />
          {v.title}
        </span>
      </div>
      <p className="mt-4 text-[17px] leading-relaxed text-ink">{v.text}</p>
      {basis && basis.length > 0 && <p className="mt-2 text-[15px] text-ink-soft">Odhad podle oboru činnosti: {basis.join(", ")}.</p>}
      <p className="mt-3 flex gap-2 text-[15px] text-ink-soft">
        <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <span>{v.caveat}</span>
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {ico && (
          <Link href={kontrolaIcoHref(ico)} className="btn-primary">
            Ověřit podle IČO
          </Link>
        )}
        <Link href={`/navody/${guide.slug}`} className="btn-secondary">
          {guide.label}
          <IconArrow />
        </Link>
      </div>
    </section>
  );
}
