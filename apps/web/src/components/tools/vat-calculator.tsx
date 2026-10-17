"use client";

import { useState, type ReactNode } from "react";
import { formatCzk, parseCzNumber } from "@/lib/doc-tools";
import { VAT_RATES, cashRounding, vatFromBase, vatFromTakings, vatFromTotal, vatFromVat, type VatBreakdown, type VatRate } from "@/lib/vat";

type Mode = "base" | "total" | "vat" | "takings";

const MODES: [Mode, string][] = [
  ["base", "Cena bez DPH"],
  ["total", "Cena s DPH"],
  ["vat", "Částka DPH"],
  ["takings", "DPH z tržby"],
];

const MAX = 1e12;

function amount(raw: string): number | null {
  const n = parseCzNumber(raw);
  return n === null || n < 0 || n > MAX ? null : n;
}

function Pill<T extends string | number>({ value, current, onClick, children }: { value: T; current: T; onClick: (v: T) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={current === value}
      onClick={() => onClick(value)}
      className={`rounded-full border px-4 py-2 text-[15px] font-medium ${current === value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
    >
      {children}
    </button>
  );
}

function Breakdown({ r }: { r: VatBreakdown }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-lg tabular-nums">
      <dt className="text-ink-soft">Základ daně</dt>
      <dd className="text-right font-semibold text-ink">{formatCzk(r.base)}</dd>
      <dt className="text-ink-soft">DPH {r.rate} %</dt>
      <dd className="text-right font-semibold text-ink">{formatCzk(r.vat)}</dd>
      <dt className="border-t border-line pt-2 font-semibold text-ink">Cena s DPH</dt>
      <dd className="border-t border-line pt-2 text-right text-2xl font-extrabold text-ink">{formatCzk(r.total)}</dd>
    </dl>
  );
}

/** S2 B1: kalkulačka DPH (21 % a 12 %) – ze základu, z ceny s daní (§ 37 písm. b), z částky daně a z tržby podle sazeb. */
export function VatCalculator() {
  const [mode, setMode] = useState<Mode>("base");
  const [rate, setRate] = useState<VatRate>(21);
  const [value, setValue] = useState("");
  const [cash, setCash] = useState(false);
  const [t21, setT21] = useState("");
  const [t12, setT12] = useState("");

  const n = amount(value);
  const single = n === null ? null : mode === "base" ? vatFromBase(n, rate) : mode === "total" ? vatFromTotal(n, rate) : mode === "vat" ? vatFromVat(n, rate) : null;
  const a21 = amount(t21);
  const a12 = amount(t12);
  const takings = mode === "takings" && (a21 !== null || a12 !== null) ? vatFromTakings([{ total: a21 ?? 0, rate: 21 }, { total: a12 ?? 0, rate: 12 }]) : null;
  const badInput = mode === "takings" ? (t21.trim() !== "" && a21 === null) || (t12.trim() !== "" && a12 === null) : value.trim() !== "" && n === null;
  const rounding = mode === "total" && cash && n !== null ? cashRounding(n) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend className="label">Co znáte</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map(([v, l]) => (
              <Pill key={v} value={v} current={mode} onClick={setMode}>
                {l}
              </Pill>
            ))}
          </div>
        </fieldset>
        {mode !== "takings" ? (
          <>
            <fieldset>
              <legend className="label">Sazba DPH</legend>
              <div className="flex flex-wrap gap-2">
                {VAT_RATES.map((r) => (
                  <Pill key={r} value={r} current={rate} onClick={setRate}>
                    {r === 21 ? "21 % základní" : "12 % snížená"}
                  </Pill>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="vat-in" className="label">
                {mode === "base" ? "Cena bez DPH (základ daně)" : mode === "total" ? "Cena včetně DPH" : "Částka DPH"}
              </label>
              <div className="relative">
                <input
                  id="vat-in"
                  className="input pr-12 text-lg"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="např. 1 000"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">Kč</span>
              </div>
            </div>
            {mode === "total" && (
              <label className="flex items-start gap-3 text-[15px] text-ink">
                <input type="checkbox" className="mt-1 h-5 w-5" checked={cash} onChange={(e) => setCash(e.target.checked)} />
                <span>Zákazník platí v hotovosti a částku zaokrouhlujete na celé koruny</span>
              </label>
            )}
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["vat-t21", "Tržba v sazbě 21 %", t21, setT21],
                ["vat-t12", "Tržba v sazbě 12 %", t12, setT12],
              ] as const
            ).map(([id, label, v, set]) => (
              <div key={id}>
                <label htmlFor={id} className="label">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={id}
                    className="input pr-12"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="včetně DPH"
                    value={v}
                    onChange={(e) => set(e.target.value)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">Kč</span>
                </div>
              </div>
            ))}
            <p className="text-sm text-muted sm:col-span-2">Zadejte tržbu včetně DPH, rozdělenou podle sazeb – třeba z denní uzávěrky.</p>
          </div>
        )}
      </form>

      <div aria-live="polite" className="space-y-4">
        {badInput && (
          <p role="alert" className="rounded-2xl bg-danger-50 p-5 text-danger-600">
            Zadejte částku číslem, například 1 250,50.
          </p>
        )}
        {!badInput && single && (
          <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
            <Breakdown r={single} />
            {mode === "vat" && <p className="mt-3 text-sm text-ink-soft">Základ dopočtený z částky daně je orientační – kvůli zaokrouhlení daně se může lišit o haléř.</p>}
            {rounding && (
              <div className="mt-4 rounded-xl bg-white p-4 text-[15px] text-ink">
                <p>
                  Zákazník zaplatí <strong>{formatCzk(rounding.rounded)}</strong>
                  {rounding.difference !== 0 && <> (zaokrouhlení {rounding.difference > 0 ? "+" : ""}{formatCzk(rounding.difference)})</>}.
                </p>
                <p className="mt-1 text-ink-soft">
                  DPH se počítá z ceny před zaokrouhlením – zaokrouhlení na celé koruny do základu daně nevstupuje (§ 37 písm. b) zákona o DPH). Do EET 2.0
                  se eviduje skutečně přijatá částka, tedy {formatCzk(rounding.rounded)}.
                </p>
              </div>
            )}
          </div>
        )}
        {!badInput && takings && takings.rows.length > 0 && (
          <div className="space-y-4 rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
            <table className="w-full text-left text-[15px] tabular-nums">
              <caption className="sr-only">DPH z tržby podle sazeb</caption>
              <thead className="text-sm text-muted">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Sazba
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Základ
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    DPH
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Tržba
                  </th>
                </tr>
              </thead>
              <tbody>
                {takings.rows.map((r) => (
                  <tr key={r.rate} className="border-t border-line">
                    <th scope="row" className="py-2 font-semibold">
                      {r.rate} %
                    </th>
                    <td className="py-2 text-right">{formatCzk(r.base)}</td>
                    <td className="py-2 text-right">{formatCzk(r.vat)}</td>
                    <td className="py-2 text-right">{formatCzk(r.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink/20 font-bold">
                  <th scope="row" className="py-2">
                    Celkem
                  </th>
                  <td className="py-2 text-right">{formatCzk(takings.base)}</td>
                  <td className="py-2 text-right">{formatCzk(takings.vat)}</td>
                  <td className="py-2 text-right">{formatCzk(takings.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-ink-soft">
              Daň počítáme z tržby včetně DPH: tržba − tržba / 1,21 (nebo 1,12), zaokrouhleno na haléře. Datová zpráva EET 2.0 DPH neobsahuje – rozpis
              podle sazeb potřebujete jen pro vlastní evidenci k DPH.
            </p>
          </div>
        )}
        {!badInput && !single && !(takings && takings.rows.length > 0) && (
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">Zadejte částku a výsledek se spočítá hned.</div>
        )}
      </div>
    </div>
  );
}
