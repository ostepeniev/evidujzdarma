"use client";

import { useState } from "react";
import { CALCULATOR_PRESETS, PRICES_CHECKED_LABEL, yearlyCost } from "@/content/pos-prices";
import { parseCzNumber } from "@/lib/doc-tools";

const kc = (n: number) => `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(n)} Kč`;

/**
 * S2-E: „Platíte X Kč měsíčně → za rok Y Kč“. Počítá jen v prohlížeči, nic neukládá ani neodesílá.
 * Předvolby = základní tarify z ceníků výrobců (bez DPH), viz content/pos-prices.ts.
 */
export function SwitchCostCalculator() {
  const [amount, setAmount] = useState("590");
  const [addVat, setAddVat] = useState(false);
  const parsed = parseCzNumber(amount);
  const valid = parsed !== null && parsed >= 0 && parsed <= 1_000_000;
  const cost = valid ? yearlyCost(parsed, { addVat }) : null;

  return (
    <div className="card mx-auto max-w-3xl">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="pokladna-mesicne" className="label">
            Kolik platíte měsíčně za software pokladny
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pokladna-mesicne"
              className="input w-40 text-lg"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby="pokladna-mesicne-tip"
            />
            <span className="text-lg text-ink-soft">Kč</span>
          </div>
          <p id="pokladna-mesicne-tip" className="mt-1 text-sm text-muted">
            Jen licence softwaru, bez hardwaru a poplatků za platby kartou.
          </p>
        </div>
        <label className="flex items-start gap-2 text-[15px] text-ink-soft sm:max-w-xs">
          <input type="checkbox" className="mt-1" checked={addVat} onChange={(e) => setAddVat(e.target.checked)} />
          <span>Cena je bez DPH a nejsem plátce DPH – připočíst 21 %</span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Základní tarify podle ceníků">
        {CALCULATOR_PRESETS.map((p) => (
          <button key={p.label} type="button" className="rounded-full border border-line px-3 py-1 text-sm hover:border-brand-300" onClick={() => setAmount(String(p.monthly))}>
            {p.label}: {kc(p.monthly)} bez DPH
          </button>
        ))}
      </div>

      <output className="mt-6 block rounded-2xl bg-brand-50 p-5" aria-live="polite">
        {cost ? (
          <>
            <span className="block text-lg text-ink">
              Platíte <strong>{kc(cost.monthly)}</strong> měsíčně → za rok <strong className="text-2xl text-brand-700">{kc(cost.year)}</strong>
            </span>
            <span className="mt-1 block text-[15px] text-ink-soft">Za 3 roky {kc(cost.threeYears)}. Evidence tržeb v EvidujZdarma i ve státní aplikaci MOJE eet: 0 Kč.</span>
          </>
        ) : (
          <span className="block text-[15px] text-danger-600">Zadejte měsíční částku v Kč, například 590 nebo 297,50.</span>
        )}
      </output>
      <p className="mt-3 text-sm text-muted">Předvolby jsou základní tarify podle veřejných ceníků výrobců k {PRICES_CHECKED_LABEL}. Neplátce DPH si DPH neodečte, platí tedy cenu s DPH.</p>
    </div>
  );
}
