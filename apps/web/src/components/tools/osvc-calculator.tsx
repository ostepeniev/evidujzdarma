"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Choice, NumberField, Row } from "@/components/tools/money-ui";
import { EXPENSE_FLAT, P2026, kc, type ExpenseRate } from "@/lib/money-2026";
import { MONEY_DISCLAIMER } from "@/lib/money-review";
import { OSVC_DEFAULT, calculateOsvc, type Activity, type OsvcInput } from "@/lib/osvc-2026";

const RATES = [80, 60, 40, 30] as const satisfies readonly ExpenseRate[];

/** S2/B2: kalkulačka OSVČ 2026 – daň, sociální a zdravotní pojištění; srovnání s paušální daní. Nic se neukládá. */
export function OsvcCalculator() {
  const [input, setInput] = useState<OsvcInput>(OSVC_DEFAULT);
  const [real, setReal] = useState(300_000);
  const r = useMemo(() => calculateOsvc(input), [input]);
  const set = <K extends keyof OsvcInput>(k: K, v: OsvcInput[K]) => setInput((s) => ({ ...s, [k]: v }));
  const usesReal = input.realExpenses !== null;
  const diff = r.cheapestPausal ? r.total - r.cheapestPausal.yearly : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <NumberField id="os-income" label="Příjmy z podnikání za rok 2026" value={input.income} onChange={(v) => set("income", v)} suffix="Kč" step={10_000} />
        <div>
          <label htmlFor="os-rate" className="label">
            Druh činnosti (výdajový paušál)
          </label>
          <select id="os-rate" className="input" value={input.expenseRate} onChange={(e) => set("expenseRate", Number(e.target.value) as ExpenseRate)}>
            {RATES.map((k) => (
              <option key={k} value={k}>
                {EXPENSE_FLAT[k].label} (strop {EXPENSE_FLAT[k].cap.toLocaleString("cs-CZ")} Kč)
              </option>
            ))}
          </select>
        </div>
        <Choice
          legend="Výdaje"
          value={usesReal}
          options={[
            [false, "Paušálem"],
            [true, "Skutečné výdaje"],
          ]}
          onChange={(v) => set("realExpenses", v ? real : null)}
        />
        {usesReal && (
          <NumberField
            id="os-real"
            label="Skutečné výdaje za rok 2026"
            value={real}
            onChange={(v) => {
              setReal(v);
              set("realExpenses", v);
            }}
            suffix="Kč"
            step={10_000}
          />
        )}
        <Choice
          legend="Činnost"
          value={input.activity}
          options={
            [
              ["hlavni", "Hlavní"],
              ["vedlejsi", "Vedlejší"],
            ] as const satisfies readonly (readonly [Activity, string])[]
          }
          onChange={(v) => set("activity", v)}
          hint="Vedlejší je činnost při zaměstnání, studiu do 26 let, pobírání starobního nebo invalidního důchodu, péči o dítě do 4 let a v dalších případech podle ČSSZ."
        />
        <NumberField
          id="os-months"
          label="Kolik měsíců roku 2026 podnikáte"
          value={input.months}
          onChange={(v) => set("months", Math.max(1, Math.min(12, Math.trunc(v || 12))))}
          suffix="měs."
          min={1}
          max={12}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Choice
            legend="Sleva na poplatníka"
            value={input.taxpayerCredit}
            options={[
              [true, "Uplatním"],
              [false, "Ne"],
            ]}
            onChange={(v) => set("taxpayerCredit", v)}
          />
          <NumberField
            id="os-children"
            label="Děti (daňové zvýhodnění)"
            value={input.children}
            onChange={(v) => set("children", Math.max(0, Math.min(10, Math.trunc(v || 0))))}
            suffix="dětí"
            max={10}
          />
        </div>
      </form>

      <div className="space-y-4" aria-live="polite">
        <p className="rounded-xl bg-surface px-4 py-3 text-[15px] font-medium text-ink">{MONEY_DISCLAIMER}</p>
        <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Daň a pojistné za rok 2026</p>
          <p className="mt-2 text-3xl font-bold text-ink">{kc(r.total)}</p>
          <p className="mt-2 text-ink-soft">
            To je v průměru {kc(Math.round(r.total / r.months))} za každý měsíc podnikání. Zálohy zaplacené během roku se od této částky odečtou.
          </p>
        </div>
        <div className="card">
          <h3 className="text-lg font-bold">Daň z příjmů</h3>
          <table className="mt-2 w-full text-left text-[15px]">
            <tbody className="divide-y divide-line">
              <Row label="Příjmy" value={r.income} />
              <Row label={usesReal ? "Skutečné výdaje" : `Výdaje paušálem ${EXPENSE_FLAT[input.expenseRate].rate} %${r.expensesCapped ? " (strop)" : ""}`} value={r.expenses} minus />
              <Row label="Základ daně (na stovky dolů)" value={r.taxBase} soft />
              <Row label="Daň před slevami" value={r.taxBeforeCredits} soft />
              <Row label="Sleva na poplatníka" value={r.taxpayerCredit} soft minus />
              <Row label="Sleva na děti" value={r.childCredit} soft minus />
              <Row label="Daň" value={r.tax} />
              {r.childBonus > 0 && <Row label="Daňový bonus (vrátí finanční úřad)" value={r.childBonus} minus />}
            </tbody>
          </table>
          {r.childBonusLost > 0 && (
            <p className="mt-2 text-sm text-muted">
              Daňový bonus {kc(r.childBonusLost)} se nevyplatí: vyplácí se od {P2026.bonusMinRocni.value} Kč a jen při příjmech aspoň{" "}
              {P2026.bonusPrijemRocni.value.toLocaleString("cs-CZ")} Kč (6× minimální mzda).
            </p>
          )}
        </div>
        <div className="card">
          <h3 className="text-lg font-bold">Pojistné</h3>
          <table className="mt-2 w-full text-left text-[15px]">
            <tbody className="divide-y divide-line">
              <Row label={`Sociální pojištění (29,2 % z vyměřovacího základu ${kc(r.social.base)})`} value={r.social.premium} />
              <Row label={`Zdravotní pojištění (13,5 % z vyměřovacího základu ${kc(r.health.base)})`} value={r.health.premium} />
            </tbody>
          </table>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {input.activity === "vedlejsi" && r.social.threshold !== null && (
              <li>
                {r.social.participates
                  ? `Zisk dosáhl rozhodné částky ${kc(r.social.threshold)}, sociální pojištění proto platíte.`
                  : `Zisk nedosáhl rozhodné částky ${kc(r.social.threshold)} – sociální pojištění z vedlejší činnosti neplatíte.`}
              </li>
            )}
            {r.social.participates && r.social.base === r.social.minBase && <li>Sociální pojištění se platí z minimálního vyměřovacího základu.</li>}
            {r.social.capped && <li>Vyměřovací základ dosáhl maxima {kc(P2026.maxVzSoc.value)}.</li>}
            {input.activity === "hlavni" && r.health.base === r.health.minBase && <li>Zdravotní pojištění se platí z minimálního vyměřovacího základu.</li>}
            {input.activity === "vedlejsi" && (
              <li>U vedlejší činnosti se u zdravotního pojištění minimum nepočítá, pokud jste zároveň zaměstnanec nebo za vás platí pojistné stát. Ověřte u své pojišťovny.</li>
            )}
          </ul>
        </div>
        <div className="card">
          <h3 className="text-lg font-bold">Minimální zálohy v roce 2026</h3>
          <table className="mt-2 w-full text-left text-[15px]">
            <tbody className="divide-y divide-line">
              {input.activity === "hlavni" ? (
                <>
                  <Row label="Sociální pojištění, leden až červen" value={P2026.minZalohaHlavniDoCervna.value} soft />
                  <Row label="Sociální pojištění od července (zákon č. 90/2026 Sb.)" value={P2026.minZalohaHlavniOdCervence.value} soft />
                  <Row label="Zdravotní pojištění" value={P2026.minZalohaZdr.value} soft />
                </>
              ) : (
                <Row label="Sociální pojištění (jen když jste účastni pojištění)" value={P2026.minZalohaVedlejsi.value} soft />
              )}
            </tbody>
          </table>
          {input.activity === "hlavni" && (
            <p className="mt-2 text-sm text-muted">
              Do přehledu za rok 2026 se minimum počítá z 35 % průměrné mzdy za celý rok. Kdo platil v první polovině roku vyšší minimální zálohy, může o vrácení rozdílu požádat do 31. 12. 2026.
            </p>
          )}
        </div>
        <div className="card">
          <h3 className="text-lg font-bold">Srovnání s paušální daní 2026</h3>
          <table className="mt-2 w-full text-left text-[15px]">
            <thead className="text-sm text-muted">
              <tr>
                <th scope="col" className="py-1 font-semibold">
                  Pásmo
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Měsíčně
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  {r.months === 12 ? "Za rok" : `Za ${r.months} měs.`}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.pausal.map((b) => (
                <tr key={b.band} className={b.available ? "" : "text-muted"}>
                  <th scope="row" className="py-2 font-medium">
                    {b.band}. pásmo{" "}
                    <span className="block text-sm font-normal text-muted">příjmy do {b.incomeLimit.toLocaleString("cs-CZ")} Kč{b.available ? "" : " – nevejdete se"}</span>
                  </th>
                  <td className="py-2 text-right">{kc(b.monthly)}</td>
                  <td className="py-2 text-right font-semibold">{kc(b.yearly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[15px] text-ink-soft">
            {r.cheapestPausal && diff !== null
              ? diff > 0
                ? `V ${r.cheapestPausal.band}. pásmu paušální daně byste zaplatili o ${kc(diff)} méně než v běžném režimu.`
                : diff < 0
                  ? `Běžný režim vychází o ${kc(-diff)} levněji než ${r.cheapestPausal.band}. pásmo paušální daně.`
                  : "Paušální daň i běžný režim vycházejí stejně."
              : "S příjmy nad 2 mil. Kč paušální režim zvolit nelze."}
          </p>
          <p className="mt-2 text-sm text-muted">
            Paušální daň zahrnuje daň i obě pojistná a platí se měsíčně. Nelze ji zvolit jako plátce DPH ani s příjmy ze zaměstnání (kromě příjmů se srážkovou daní) a slevy
            ani zvýhodnění na děti se v ní neuplatní. Podmínky si ověřte u finančního úřadu nebo s účetní.
          </p>
          {r.cheapestPausal?.band === 1 && (
            <p className="mt-2 text-sm text-ink-soft">
              Jste v 1. pásmu? Od roku 2027 můžete místo evidence tržeb platit přirážku EET OFF.{" "}
              <Link href="/kalkulacka-eet-off" className="font-medium text-brand-700 underline underline-offset-2">
                Spočítejte, zda se vyplatí
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
