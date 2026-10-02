import { SITE } from "@/lib/site";
import { COMPARISON_ROWS, COMPARISON_SOURCES } from "@/content/comparison";

export function ComparisonTable() {
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">Srovnání EvidujZdarma a státní aplikace MOJE eet</caption>
          <thead>
            <tr className="bg-surface">
              <th scope="col" className="px-4 py-3 text-sm font-semibold text-ink-soft">
                Funkce
              </th>
              <th scope="col" className="px-4 py-3 text-sm font-semibold text-ink-soft">
                MOJE eet (stát)
              </th>
              <th scope="col" className="bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
                EvidujZdarma (zdarma)
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((r) => (
              <tr key={r.feature} className="border-t border-line">
                <th scope="row" className="px-4 py-3 text-[15px] font-medium text-ink">
                  {r.feature}
                </th>
                <td className="px-4 py-3 text-[15px] text-ink-soft">{r.state}</td>
                <td className={`bg-brand-50/50 px-4 py-3 text-[15px] ${r.oursHighlight ? "font-semibold text-brand-700" : "text-ink"}`}>{r.ours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        Údaje o MOJE eet podle zveřejněných informací:{" "}
        {COMPARISON_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} className="underline underline-offset-2" rel="noopener">
              {s.label}
            </a>
          </span>
        ))}
        . Státní aplikace má být dostupná od 1. 12. 2026 na{" "}
        <a href="https://eet.gov.cz" className="underline underline-offset-2" rel="noopener">
          eet.gov.cz
        </a>
        . Stav k 2. 10. 2026. MOJE eet zatím není spuštěná – údaje upřesníme podle oficiálního popisu Finanční správy. Pokud najdete nepřesnost, napište nám na{" "}
        <a href={`mailto:${SITE.email}`} className="underline underline-offset-2">
          {SITE.email}
        </a>
        .
      </p>
    </div>
  );
}
