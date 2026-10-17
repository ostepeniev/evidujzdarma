"use client";

import Link from "next/link";
import { useState } from "react";
import { checkIco } from "@/lib/validators";

/** S2 B1: ověření kontrolní číslice IČO s rozpisem výpočtu. Nic se neodesílá; ke kontrole EET vede odkaz s IČO ve fragmentu. */
export function IcoValidator() {
  const [value, setValue] = useState("");
  const r = checkIco(value);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="ico-v" className="label">
            IČO
          </label>
          <input
            id="ico-v"
            className="input text-lg"
            inputMode="numeric"
            autoComplete="off"
            placeholder="např. 12345679"
            maxLength={12}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby="ico-v-hint"
          />
          <p id="ico-v-hint" className="mt-1 text-sm text-muted">
            8 číslic. Starší IČO se někdy píše bez úvodních nul – ty doplníme sami.
          </p>
        </div>
        <p className="text-sm text-muted">Kontrola běží jen ve vašem prohlížeči, IČO nikam neodesíláme.</p>
      </form>

      <div aria-live="polite" className="space-y-4">
        {"error" in r ? (
          r.error === "empty" ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Zadejte IČO a hned uvidíte, zda sedí kontrolní číslice.</div>
          ) : (
            <div role="alert" className="rounded-2xl bg-danger-50 p-6 text-danger-600">
              {r.error === "format" ? "IČO tvoří jen číslice, nejvýše osm." : "IČO ze samých nul neexistuje."}
            </div>
          )
        ) : (
          <>
            <div className={`rounded-2xl border-2 p-6 ${r.ok ? "border-brand-500 bg-brand-50" : "border-danger-600 bg-danger-50"}`}>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">{r.ok ? "Kontrolní číslice sedí" : "Kontrolní číslice nesedí"}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{r.ico}</p>
              {r.padded && <p className="mt-1 text-sm text-ink-soft">Doplnili jsme úvodní nuly na 8 číslic.</p>}
              <p className="mt-2 text-ink-soft">
                {r.ok
                  ? "Tvar IČO je v pořádku. Zda firma opravdu existuje, ukáže až registr ARES."
                  : `Podle výpočtu má být poslední číslice ${r.expected}, v zadaném IČO je ${r.actual}. Nejspíš jde o překlep.`}
              </p>
              {r.ok && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={`/kontrola-ico#ico=${r.ico}`} className="btn-primary">
                    Týká se firmy EET 2.0?
                  </a>
                  <Link href="/ucetni/hromadna-kontrola" className="btn-secondary">
                    Více IČO najednou
                  </Link>
                </div>
              )}
            </div>
            <div className="card">
              <h2 className="text-lg font-bold">Jak jsme počítali</h2>
              <table className="mt-3 w-full text-left text-[15px] tabular-nums">
                <caption className="sr-only">Výpočet kontrolní číslice IČO</caption>
                <thead className="text-sm text-muted">
                  <tr>
                    <th scope="col" className="py-1 font-medium">
                      Číslice
                    </th>
                    {r.products.map((p, i) => (
                      <td key={i} className="py-1 text-center font-semibold text-ink">
                        {p.digit}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="py-1 text-sm font-medium text-muted">
                      Váha
                    </th>
                    {r.products.map((p, i) => (
                      <td key={i} className="py-1 text-center">
                        × {p.weight}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-line">
                    <th scope="row" className="py-1 text-sm font-medium text-muted">
                      Součin
                    </th>
                    {r.products.map((p, i) => (
                      <td key={i} className="py-1 text-center">
                        {p.product}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-[15px] text-ink-soft">
                <li>
                  Součet součinů: <strong className="text-ink">{r.sum}</strong>
                </li>
                <li>
                  Zbytek po dělení 11: <strong className="text-ink">{r.remainder}</strong>
                </li>
                <li>
                  Kontrolní číslice: {r.remainder === 0 ? "zbytek 0 → 1" : r.remainder === 1 ? "zbytek 1 → 0" : `11 − ${r.remainder} = ${r.expected}`}
                  {" "}
                  (v IČO je <strong className="text-ink">{r.actual}</strong>)
                </li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
