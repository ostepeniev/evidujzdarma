import { ExternalLink } from "@/components/external-link";
import { MONEY_DISCLAIMER } from "@/lib/money-review";
import { P2026, paramDisplay, type ParamKey } from "@/lib/money-2026";

/** S2/B2: tabulka „Parametry výpočtu“ – každé číslo s datem platnosti a zdrojem (pravidlo 5 S2). */
export function MoneyParams({ keys, title = "Parametry výpočtu pro rok 2026", className = "mx-auto mt-14 max-w-5xl" }: { keys: readonly ParamKey[]; title?: string; className?: string }) {
  return (
    <section className={className} aria-labelledby="parametry-vypoctu">
      <h2 id="parametry-vypoctu" className="text-2xl font-bold">
        {title}
      </h2>
      <div className="relative mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead className="bg-surface text-sm text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">
                Parametr
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Hodnota
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Platí od
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Zdroj
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {keys.map((k) => {
              const x = P2026[k];
              return (
                <tr key={k}>
                  <th scope="row" className="px-4 py-2 font-medium">
                    {x.label}
                    {x.basis && <span className="block text-sm font-normal text-muted">{x.basis}</span>}
                  </th>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">{paramDisplay(x)}</td>
                  <td className="px-4 py-2 text-ink-soft">{x.validFrom}</td>
                  <td className="px-4 py-2">
                    <ExternalLink href={x.source.url} className="text-brand-700 underline underline-offset-2">
                      {x.source.label}
                    </ExternalLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">{MONEY_DISCLAIMER} Hodnoty jsme ověřili 17. 10. 2026 v uvedených zdrojích.</p>
    </section>
  );
}

/** Viditelné upozornění nad výsledkem kalkulačky. */
export function MoneyDisclaimer() {
  return <p className="rounded-xl bg-surface px-4 py-3 text-[15px] font-medium text-ink">{MONEY_DISCLAIMER}</p>;
}
