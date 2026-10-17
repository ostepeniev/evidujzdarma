"use client";

import { useMemo, useState } from "react";
import { Choice, NumberField, Row, Warnings } from "@/components/tools/money-ui";
import { kc } from "@/lib/money-2026";
import { MONEY_DISCLAIMER } from "@/lib/money-review";
import { NET_WAGE_DEFAULT, calculateNetWage, type NetWageInput } from "@/lib/net-wage";

/** S2/B2: kalkulačka čisté mzdy 2026. Výpočet běží v prohlížeči, nic se neukládá ani neodesílá. */
export function NetWageCalculator() {
  const [input, setInput] = useState<NetWageInput>(NET_WAGE_DEFAULT);
  const r = useMemo(() => calculateNetWage(input), [input]);
  const set = <K extends keyof NetWageInput>(k: K, v: NetWageInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <NumberField
          id="nw-gross"
          label="Hrubá měsíční mzda"
          value={input.gross}
          onChange={(v) => set("gross", v)}
          suffix="Kč"
          step={500}
          hint="Pracovní poměr, mzda za jeden běžný měsíc roku 2026."
        />
        <Choice
          legend="Podepsali jste u zaměstnavatele prohlášení poplatníka?"
          value={input.declaration}
          options={[
            [true, "Ano"],
            [false, "Ne"],
          ]}
          onChange={(v) => set("declaration", v)}
          hint="Prohlášení se podepisuje jen u jednoho zaměstnavatele. Bez něj se neuplatní sleva na poplatníka ani na děti."
        />
        <NumberField
          id="nw-children"
          label="Počet dětí, na které uplatňujete daňové zvýhodnění"
          value={input.children}
          onChange={(v) => set("children", Math.max(0, Math.min(10, Math.trunc(v || 0))))}
          suffix="dětí"
          max={10}
          hint="Zvýhodnění na dítě uplatňuje jen jeden z rodičů. Dítě s průkazem ZTP/P kalkulačka nepočítá."
        />
      </form>

      <div className="space-y-4" aria-live="polite">
        <p className="rounded-xl bg-surface px-4 py-3 text-[15px] font-medium text-ink">{MONEY_DISCLAIMER}</p>
        {!r.ok ? (
          <div className="rounded-2xl border-2 border-line bg-surface p-6">
            <p className="text-xl font-bold text-ink">{r.reason}</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Čistá mzda</p>
              <p className="mt-2 text-3xl font-bold text-ink">{kc(r.net)}</p>
              <p className="mt-2 text-ink-soft">
                Zaměstnavatele stojíte {kc(r.employerCost)} měsíčně.
                {r.childBonus > 0 && ` Z toho daňový bonus na děti ${kc(r.childBonus)}.`}
              </p>
            </div>
            <div className="card">
              <h3 className="text-lg font-bold">Jak se čistá mzda počítá</h3>
              <table className="mt-2 w-full text-left text-[15px]">
                <tbody className="divide-y divide-line">
                  <Row label="Hrubá mzda" value={r.gross} />
                  <Row label="Sociální pojištění zaměstnance (7,1 %)" value={r.socialEmployee} minus />
                  <Row label="Zdravotní pojištění zaměstnance (4,5 %)" value={r.healthEmployee} minus />
                  <Row label="Základ pro zálohu na daň (na stokoruny nahoru)" value={r.advanceBase} soft />
                  <Row label="Záloha na daň před slevami" value={r.advance} soft />
                  <Row label="Sleva na poplatníka" value={r.taxpayerCredit} soft minus />
                  <Row label="Sleva na děti" value={r.childCredit} soft minus />
                  <Row label="Záloha na daň po slevách" value={r.advanceAfterCredits} minus />
                  <Row label="Daňový bonus na děti" value={r.childBonus} plus />
                  <Row label="Čistá mzda" value={r.net} strong />
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 className="text-lg font-bold">Náklady zaměstnavatele</h3>
              <table className="mt-2 w-full text-left text-[15px]">
                <tbody className="divide-y divide-line">
                  <Row label="Hrubá mzda" value={r.gross} />
                  <Row label="Sociální pojištění zaměstnavatele (24,8 %)" value={r.socialEmployer} plus />
                  <Row label="Zdravotní pojištění zaměstnavatele (9 %)" value={r.healthEmployer} plus />
                  <Row label="Celková cena práce" value={r.employerCost} strong />
                </tbody>
              </table>
            </div>
            <Warnings items={r.warnings} />
          </>
        )}
      </div>
    </div>
  );
}
