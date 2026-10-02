"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FACTS } from "@/content/facts";

interface State {
  person: "fo" | "po";
  fixed: number;
  mobile: number;
  vending: number;
  web: number;
  vehicle: number;
  atCustomer: boolean;
}

const INITIAL: State = { person: "fo", fixed: 1, mobile: 0, vending: 0, web: 0, vehicle: 0, atCustomer: false };

function Stepper({ id, label, help, value, onChange }: { id: string; label: string; help: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-0">
      <div>
        <p id={id} className="font-medium text-ink">
          {label}
        </p>
        <p className="text-sm text-ink-soft">{help}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2" role="group" aria-labelledby={id}>
        <button type="button" aria-label="Méně" onClick={() => onChange(Math.max(0, value - 1))} className="h-10 w-10 rounded-full border border-line text-xl hover:bg-surface">
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label="Více" onClick={() => onChange(Math.min(20, value + 1))} className="h-10 w-10 rounded-full border border-line text-xl hover:bg-surface">
          +
        </button>
      </div>
    </div>
  );
}

export function UnitsWizard() {
  const [s, setS] = useState<State>(INITIAL);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((x) => ({ ...x, [k]: v }));

  const units = useMemo(() => {
    const out: { type: string; count: number; note: string }[] = [];
    if (s.fixed) out.push({ type: "Stálá provozovna", count: s.fixed, note: "Obchod, salon, kancelář, dílna – každé místo zvlášť (pojmenujte podle adresy)." });
    if (s.mobile) out.push({ type: "Mobilní provozovna", count: s.mobile, note: "Stánek na trzích, food truck, prodej na akcích." });
    if (s.vending) out.push({ type: "Automat", count: s.vending, note: "Typ jednotky „automat“ v DIS+ existuje, u některých automatů ale může platit výjimka z evidence – ověřte na eet.gov.cz." });
    if (s.web) out.push({ type: "Internetová stránka", count: s.web, note: "Web nebo aplikace, přes které nabízíte zboží či služby. Platby přes platební bránu se ale neevidují." });
    if (s.vehicle) out.push({ type: "Dopravní prostředek", count: s.vehicle, note: "Taxi, přeprava osob, prodej z vozidla." });
    if (s.atCustomer && s.person === "fo") out.push({ type: "Vy sami (bez provozovny)", count: 1, note: "Podnikatel bez provozovny uvede jako evidenční jednotku sám sebe." });
    return out;
  }, [s]);

  const total = units.reduce((a, u) => a + u.count, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <form className="card" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="mb-2">
          <legend className="label">Podnikáte jako</legend>
          <div className="flex gap-2">
            {(
              [
                ["fo", "Fyzická osoba (OSVČ)"],
                ["po", "Firma (s.r.o., a.s. …)"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={s.person === v}
                onClick={() => set("person", v)}
                className={`rounded-full border px-4 py-2 text-[15px] font-medium ${s.person === v ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-surface"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <Stepper id="u-fixed" label="Stálé provozovny" help="Místa, kde přijímáte platby od zákazníků." value={s.fixed} onChange={(v) => set("fixed", v)} />
        <Stepper id="u-mobile" label="Mobilní stánky" help="Trhy, food truck, sezonní prodej." value={s.mobile} onChange={(v) => set("mobile", v)} />
        <Stepper id="u-vending" label="Prodejní automaty" help="Na hotovost nebo kartu." value={s.vending} onChange={(v) => set("vending", v)} />
        <Stepper id="u-web" label="Weby nebo aplikace" help="Přes které nabízíte zboží či služby." value={s.web} onChange={(v) => set("web", v)} />
        <Stepper id="u-vehicle" label="Vozidla" help="Taxi, přeprava, prodej z auta." value={s.vehicle} onChange={(v) => set("vehicle", v)} />
        <label className="flex items-start gap-3 py-4">
          <input type="checkbox" checked={s.atCustomer} onChange={(e) => set("atCustomer", e.target.checked)} className="mt-1 h-5 w-5 rounded accent-brand-600" />
          <span>
            <span className="block font-medium text-ink">Pracuji u zákazníků bez provozovny</span>
            <span className="text-sm text-ink-soft">Řemeslník, masér, kosmetika nebo úklid u klienta.</span>
          </span>
        </label>
      </form>

      <div className="space-y-4" aria-live="polite">
        <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Doporučení</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {total === 0
              ? "Zatím žádná evidenční jednotka"
              : `Pravděpodobně oznámíte v DIS+ ${total} ${total === 1 ? "evidenční jednotku" : total < 5 ? "evidenční jednotky" : "evidenčních jednotek"}`}
          </p>
          {units.length > 0 && (
            <ul className="mt-4 space-y-3">
              {units.map((u) => (
                <li key={u.type} className="rounded-xl bg-white p-4">
                  <p className="font-semibold text-ink">
                    {u.count}× {u.type}
                  </p>
                  <p className="text-[15px] text-ink-soft">{u.note}</p>
                </li>
              ))}
            </ul>
          )}
          {s.atCustomer && s.person === "po" && (
            <p className="mt-4 rounded-xl bg-white p-4 text-[15px] text-ink-soft">
              U firmy bez provozovny ověřte vhodný typ jednotky v DIS+ nebo na eet.gov.cz – výslovné pravidlo „sám sebe“ platí pro podnikatele fyzické osoby.
            </p>
          )}
        </div>
        <div className="card space-y-2 text-[15px] text-ink-soft">
          <p>
            <strong className="text-ink">Jak na to:</strong> v DIS+ → Evidence tržeb → Evidenční jednotky zadáte typ, adresu nebo jiný identifikační údaj a volitelně název.
            Finanční správa každé jednotce přidělí číslo, které pokladna posílá v každé tržbě.
          </p>
          <p>{FACTS.units.change}</p>
          <p>Číslo provozovny z živnostenského rejstříku (IČP) není číslo evidenční jednotky.</p>
          <p className="text-sm text-muted">Orientační doporučení podle vašich odpovědí, nejde o daňové poradenství. Konečné rozhodnutí je na vás, případně na daňovém poradci.</p>
          {total > 2 && <p>Státní aplikace MOJE eet zvládne nejvýše 2 evidenční jednotky. EvidujZdarma má zdarma 3, více v Premium.</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/navody/evidencni-jednotka" className="btn-secondary">
            Návod: evidenční jednotka
          </Link>
          <Link href="/#registrace" className="btn-primary">
            Chci pokladnu zdarma
          </Link>
        </div>
      </div>
    </div>
  );
}
