"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/tools/money-ui";
import { kc } from "@/lib/money-2026";
import { MONEY_DISCLAIMER } from "@/lib/money-review";
import { TIPS_DEFAULT, TIP_EXEMPT_PERCENT, TIP_RULE_FROM, calculateTips } from "@/lib/tips";

const MAX_ROWS = 30;

/** S2/B2: spropitné ze stravovacích služeb od 1. 1. 2027 (§ 6 odst. 9 písm. g) ZDP). Nic se neukládá ani neodesílá. */
export function TipsCalculator() {
  const [income, setIncome] = useState(TIPS_DEFAULT.monthlyFoodIncome);
  const [tips, setTips] = useState<number[]>([...TIPS_DEFAULT.tips]);
  const r = useMemo(() => calculateTips({ monthlyFoodIncome: income, tips }), [income, tips]);
  const setTip = (idx: number, v: number) => setTips((t) => t.map((x, i) => (i === idx ? v : x)));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <NumberField
          id="tp-income"
          label="Měsíční příjmy podniku ze stravovacích služeb"
          value={income}
          onChange={setIncome}
          suffix="Kč"
          step={10_000}
          hint="Příjmy zaměstnavatele ze stravovacích služeb za jeden kalendářní měsíc. Zda u plátce DPH počítat s daní, nebo bez ní, Finanční správa zatím podrobně nepopsala – ověřte s účetní."
        />
        <fieldset>
          <legend className="label">Spropitné jednotlivých zaměstnanců za stejný měsíc</legend>
          <div className="space-y-3">
            {tips.map((t, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <NumberField id={`tp-tip-${idx}`} label={`Zaměstnanec ${idx + 1}`} value={t} onChange={(v) => setTip(idx, v)} suffix="Kč" step={100} />
                </div>
                {tips.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTips((x) => x.filter((_, i) => i !== idx))}
                    className="mb-1 rounded-full border border-line bg-white px-3 py-2 text-sm hover:bg-surface"
                    aria-label={`Odebrat zaměstnance ${idx + 1}`}
                  >
                    Odebrat
                  </button>
                )}
              </div>
            ))}
          </div>
          {tips.length < MAX_ROWS && (
            <button type="button" onClick={() => setTips((x) => [...x, 0])} className="mt-3 rounded-full border border-brand-600 px-4 py-2 text-[15px] font-medium text-brand-700 hover:bg-brand-50">
              Přidat zaměstnance
            </button>
          )}
          <p className="mt-2 text-sm text-muted">Zaměstnanec, který v měsíci spropitné nedostal (0 Kč), se do počtu pro rovný díl nezapočítá.</p>
        </fieldset>
      </form>

      <div className="space-y-4" aria-live="polite">
        <p className="rounded-xl bg-surface px-4 py-3 text-[15px] font-medium text-ink">{MONEY_DISCLAIMER}</p>
        <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Limit osvobození za měsíc (od {TIP_RULE_FROM})</p>
          <p className="mt-2 text-3xl font-bold text-ink">{kc(r.cap)}</p>
          <p className="mt-2 text-ink-soft">
            To je {TIP_EXEMPT_PERCENT} % z měsíčních příjmů ze stravovacích služeb – pro všechny zaměstnance dohromady, ne z každého účtu zvlášť.
          </p>
        </div>
        <div className="card">
          <h3 className="text-lg font-bold">Způsob 1: rovným dílem</h3>
          <p className="mt-1 text-[15px] text-ink-soft">
            {r.perEmployeeLimit === null
              ? "Nikdo v měsíci spropitné nedostal."
              : r.recipients === 1
                ? `Spropitné dostal jen jeden zaměstnanec, celý limit ${kc(r.perEmployeeLimit)} připadá na něj.`
                : `Limit se dělí mezi ${r.recipients} ${r.recipients <= 4 ? "zaměstnance" : "zaměstnanců"}, kteří spropitné dostali: ${kc(r.perEmployeeLimit)} na každého.`}
          </p>
          <table className="mt-3 w-full text-left text-[15px]">
            <thead className="text-sm text-muted">
              <tr>
                <th scope="col" className="py-1 font-semibold">
                  Zaměstnanec
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Spropitné
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Osvobozeno
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Nad limit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.rows.map((row, idx) => (
                <tr key={idx}>
                  <th scope="row" className="py-2 font-medium">
                    {idx + 1}
                  </th>
                  <td className="py-2 text-right">{kc(row.tip)}</td>
                  <td className="py-2 text-right">{kc(row.exempt)}</td>
                  <td className={`py-2 text-right font-semibold ${row.over > 0 ? "text-ink" : "text-muted"}`}>{kc(row.over)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 font-bold">
                  Celkem
                </th>
                <td className="py-2 text-right font-bold">{kc(r.totalTips)}</td>
                <td className="py-2 text-right font-bold">{kc(r.exemptA)}</td>
                <td className="py-2 text-right font-bold">{kc(r.overA)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="text-lg font-bold">Způsob 2: částky určí zaměstnavatel</h3>
          <p className="mt-1 text-[15px] text-ink-soft">
            Zákon dovoluje, aby zaměstnavatel určil osvobozené částky sám – úhrn osvobozeného spropitného všech zaměstnanců ale nesmí přesáhnout {kc(r.cap)}.
          </p>
          <p className="mt-2 text-[15px] text-ink">
            Osvobodit lze nejvýše <strong>{kc(r.exemptBMax)}</strong> z {kc(r.totalTips)}
            {r.overBMin > 0 ? `; nejméně ${kc(r.overBMin)} zůstane nad limitem.` : " – celé spropitné se do limitu vejde."}
          </p>
        </div>
        <div className="rounded-xl bg-surface p-4 text-[15px] text-ink-soft">
          <p>
            Část nad limit je zdanitelný příjem zaměstnance ze závislé činnosti. Za plátce tohoto příjmu se považuje zaměstnavatel (§ 6 odst. 19 zákona o daních z
            příjmů). Jak část nad limit zdanit a zda se z ní platí pojistné, proberte s účetní.
          </p>
        </div>
      </div>
    </div>
  );
}
