"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateEetOff, DEFAULT_INPUT, type Band, type EetOffInput } from "@/lib/eet-off";
import { FACTS } from "@/content/facts";

const kc = (n: number) => `${Math.round(n).toLocaleString("cs-CZ")} Kč`;

const period = (months: number) => (months === 12 ? "ročně" : `za ${months} ${months === 1 ? "měsíc" : months <= 4 ? "měsíce" : "měsíců"}`);

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  step = 1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  hint?: string;
  step?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input pr-16"
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">{suffix}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function EetOffCalculator() {
  const [input, setInput] = useState<EetOffInput>(DEFAULT_INPUT);
  const r = useMemo(() => calculateEetOff(input), [input]);
  const set = <K extends keyof EetOffInput>(k: K, v: EetOffInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-5" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend className="label">Paušální režim</legend>
          <div className="flex flex-wrap gap-2">
            {([
              [1, "1. pásmo"],
              [2, "2. pásmo"],
              [3, "3. pásmo"],
              [0, "Nejsem paušalista"],
            ] as [Band, string][]).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={input.band === v}
                onClick={() => set("band", v)}
                className={`rounded-full border px-4 py-2 text-[15px] font-medium ${input.band === v ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <NumberField id="eo-income" label="Roční příjmy ze samostatné činnosti" value={input.income} onChange={(v) => set("income", v)} suffix="Kč" step={10000} />
        <div>
          <label htmlFor="eo-start" className="label">
            Od kdy v roce 2027 podnikáte
          </label>
          <select id="eo-start" className="input" value={input.startMonth ?? 1} onChange={(e) => set("startMonth", Number(e.target.value))}>
            <option value={1}>Celý rok (podnikám už teď)</option>
            {MONTHS.slice(1).map((m, idx) => (
              <option key={m} value={idx + 2}>
                Začínám v průběhu roku: {m}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-muted">{FACTS.eetOff.midYear}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            id="eo-min"
            label="Čas na evidenci denně"
            value={input.minutesPerDay}
            onChange={(v) => set("minutesPerDay", v)}
            suffix="min"
            hint="Zadání tržeb, kontrola, uzávěrka."
          />
          <NumberField id="eo-days" label="Pracovních dní v měsíci" value={input.workDaysPerMonth} onChange={(v) => set("workDaysPerMonth", v)} suffix="dní" />
        </div>
        <NumberField id="eo-rate" label="Cena vaší hodiny" value={input.hourlyRate} onChange={(v) => set("hourlyRate", v)} suffix="Kč/h" step={50} />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            id="eo-tools"
            label="Pokladna měsíčně"
            value={input.toolsMonthly}
            onChange={(v) => set("toolsMonthly", v)}
            suffix="Kč"
            hint="EvidujZdarma: 0 Kč."
          />
          <NumberField
            id="eo-hw"
            label="Zařízení jednorázově"
            value={input.hardwareOneOff}
            onChange={(v) => set("hardwareOneOff", v)}
            suffix="Kč"
            hint="Tiskárna, tablet – rozpočítáme na 3 roky."
          />
        </div>
      </form>

      <div className="space-y-4" aria-live="polite">
        {!r.eligible ? (
          <div className="rounded-2xl border-2 border-line bg-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">EET OFF není možný</p>
            <p className="mt-2 text-xl font-bold text-ink">{r.reason}</p>
            <p className="mt-3 text-ink-soft">Tržby přijaté osobně budete evidovat. Pokladnu pro EET 2.0 máme zdarma.</p>
            <Link href="/#registrace" className="btn-primary mt-4">
              Chci pokladnu zdarma
            </Link>
          </div>
        ) : (
          <>
            <div className={`rounded-2xl border-2 p-6 ${r.verdict === "eet-off" ? "border-brand-500 bg-brand-50" : r.verdict === "evidence" ? "border-sun-500 bg-sun-100" : "border-line bg-surface"}`}>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Výsledek</p>
              <p className="mt-2 text-2xl font-bold text-ink">
                {r.verdict === "eet-off"
                  ? "EET OFF se vám pravděpodobně vyplatí."
                  : r.verdict === "evidence"
                    ? "Evidence vás pravděpodobně vyjde levněji než EET OFF."
                    : "Vychází to zhruba nastejno."}
              </p>
              <p className="mt-2 text-ink-soft">
                {r.verdict === "eet-off"
                  ? `Evidence by vás stála o ${kc(r.difference)} ${period(r.months)} víc než přirážka.`
                  : r.verdict === "evidence"
                    ? `Přirážka by vás stála o ${kc(-r.difference)} ${period(r.months)} víc než evidence.`
                    : "Rozhodněte se podle toho, co je pro vás pohodlnější."}
              </p>
              <p className="mt-3 text-sm text-muted">
                Orientační výpočet podle vašich odhadů, nejde o daňové poradenství. Volba EET OFF platí na celý kalendářní rok (při zahájení
                činnosti v průběhu roku od měsíce zahájení) – počítejte proto s příjmy a prací za celé toto období.
              </p>
            </div>
            <div className="card">
              <table className="w-full text-left text-[15px]">
                <tbody className="divide-y divide-line">
                  <tr>
                    <th scope="row" className="py-2 font-medium">
                      Přirážka EET OFF {period(r.months)}
                    </th>
                    <td className="py-2 text-right font-semibold">{kc(r.surchargeYearly)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2 font-medium">
                      Náklady evidence {r.months === 12 ? "ročně" : "za stejné období"}
                    </th>
                    <td className="py-2 text-right font-semibold">{kc(r.evidenceYearly)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2 font-normal text-ink-soft">
                      z toho čas
                    </th>
                    <td className="py-2 text-right text-ink-soft">{r.timeHoursYearly.toLocaleString("cs-CZ")} h</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2 font-normal text-ink-soft">
                      Paušální záloha 2027 (1. pásmo)
                    </th>
                    <td className="py-2 text-right text-ink-soft">{kc(r.pausalMonthly)}/měs.</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2 font-normal text-ink-soft">
                      Záloha s přirážkou EET OFF
                    </th>
                    <td className="py-2 text-right text-ink-soft">{kc(r.pausalWithSurchargeMonthly)}/měs.</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted">Výše paušální zálohy pro rok 2027 je zatím předběžná (oznámená, oficiální leták FS ještě nevyšel).</p>
            </div>
            <div className="rounded-xl bg-surface p-4 text-[15px] text-ink-soft">
              {(input.startMonth ?? 1) === 1 ? (
                <p>
                  Přihlásit se k EET OFF je třeba do <strong className="text-ink">{FACTS.eetOff.deadline}</strong>. Pozdní oznámení je neúčinné a zpětně se přihlásit nelze.
                </p>
              ) : (
                <p>
                  Při zahájení činnosti v průběhu roku platíte přirážku od měsíce zahájení. {FACTS.eetOff.startDeadline}
                </p>
              )}
              <ul className="mt-3 list-disc space-y-1 pl-5">
                <li>{FACTS.eetOff.binding}</li>
                <li>{FACTS.eetOff.overLimit}</li>
                <li>{FACTS.eetOff.exit}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
