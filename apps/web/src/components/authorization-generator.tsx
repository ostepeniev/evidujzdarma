"use client";

import { useMemo, useState } from "react";
import { type Authorization, type Party, authorizationText } from "@/lib/doc-tools";

const emptyParty = (): Party => ({ name: "", ico: "", eic: "", address: "" });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Příklady rozsahu – jen předvyplnění textu, uživatel ho upraví. */
const SCOPE_EXAMPLES = [
  { label: "Masér v hotelu", scope: "platby hostů za masážní služby pověřujícího poplatníka", place: "na recepci hotelu ⟨název a adresa⟩" },
  { label: "Sdílený salon", scope: "platby zákazníků za kadeřnické služby pověřujícího poplatníka", place: "v provozovně ⟨adresa salonu⟩" },
] as const;

function PartyFields({ id, title, hint, value, onChange }: { id: string; title: string; hint: string; value: Party; onChange: (p: Party) => void }) {
  const set = (k: keyof Party, v: string) => onChange({ ...value, [k]: v });
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-bold">{title}</legend>
      <p className="text-sm text-muted">{hint}</p>
      <div>
        <label htmlFor={`${id}-name`} className="label">
          Jméno a příjmení nebo název
        </label>
        <input id={`${id}-name`} className="input" value={value.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-ico`} className="label">
            IČO
          </label>
          <input id={`${id}-ico`} className="input" inputMode="numeric" maxLength={10} value={value.ico} onChange={(e) => set("ico", e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-eic`} className="label">
            DIČ (evidenční identifikační číslo)
          </label>
          <input id={`${id}-eic`} className="input" placeholder="CZ…" value={value.eic} onChange={(e) => set("eic", e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-addr`} className="label">
          Sídlo nebo místo podnikání
        </label>
        <input id={`${id}-addr`} className="input" value={value.address} onChange={(e) => set("address", e.target.value)} />
      </div>
    </fieldset>
  );
}

/** Vzor pověření k evidování tržeb (§ 10 zákona č. 180/2026 Sb.). Text se skládá v prohlížeči, nic se neodesílá. */
export function AuthorizationGenerator() {
  const [a, setA] = useState<Authorization>({
    principal: emptyParty(),
    agent: emptyParty(),
    scope: "",
    place: "",
    from: "2027-01-01",
    to: "",
    handover: "",
    noticeDays: "30",
    signPlace: "",
    signDate: today(),
  });
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => authorizationText(a), [a]);
  const set = <K extends keyof Authorization>(k: K, v: Authorization[K]) => setA((x) => ({ ...x, [k]: v }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <form className="card space-y-6 no-print" onSubmit={(e) => e.preventDefault()}>
        <PartyFields
          id="pv-p"
          title="Pověřující poplatník"
          hint="Ten, komu tržba patří (např. masér)."
          value={a.principal}
          onChange={(p) => set("principal", p)}
        />
        <PartyFields
          id="pv-a"
          title="Pověřený poplatník"
          hint="Ten, kdo tržbu přijme a zaeviduje ve své pokladně (např. hotel)."
          value={a.agent}
          onChange={(p) => set("agent", p)}
        />
        <p className="text-sm text-muted">
          Evidenčním identifikačním číslem je DIČ. Fyzická osoba bez DIČ má číslo složené z „CZ“ a rodného čísla (§ 18) – můžete ho do vytištěného
          pověření dopsat ručně, sem ho zadávat nemusíte.
        </p>

        <fieldset className="space-y-3">
          <legend className="text-lg font-bold">Rozsah pověření</legend>
          <div className="flex flex-wrap gap-2">
            {SCOPE_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="btn-secondary px-3 py-1 text-sm"
                onClick={() => setA((x) => ({ ...x, scope: ex.scope, place: ex.place }))}
              >
                {ex.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="pv-scope" className="label">
              Jaké tržby pověřený eviduje
            </label>
            <textarea id="pv-scope" className="input min-h-20" value={a.scope} onChange={(e) => set("scope", e.target.value)} />
          </div>
          <div>
            <label htmlFor="pv-place" className="label">
              Kde se platby přijímají
            </label>
            <input id="pv-place" className="input" placeholder="např. v provozovně ⟨adresa⟩" value={a.place} onChange={(e) => set("place", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pv-from" className="label">
                Platí od
              </label>
              <input id="pv-from" type="date" className="input" value={a.from} onChange={(e) => set("from", e.target.value)} />
            </div>
            <div>
              <label htmlFor="pv-to" className="label">
                Platí do (prázdné = na dobu neurčitou)
              </label>
              <input id="pv-to" type="date" className="input" value={a.to} onChange={(e) => set("to", e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="pv-hand" className="label">
              Jak si předáváte peníze a přehledy tržeb
            </label>
            <input
              id="pv-hand"
              className="input"
              placeholder="např. každé pondělí převodem na účet pověřujícího s přehledem tržeb za týden"
              value={a.handover}
              onChange={(e) => set("handover", e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="pv-notice" className="label">
                Výpověď (dní)
              </label>
              <input id="pv-notice" className="input" inputMode="numeric" maxLength={3} value={a.noticeDays} onChange={(e) => set("noticeDays", e.target.value)} />
            </div>
            <div>
              <label htmlFor="pv-splace" className="label">
                Místo podpisu
              </label>
              <input id="pv-splace" className="input" value={a.signPlace} onChange={(e) => set("signPlace", e.target.value)} />
            </div>
            <div>
              <label htmlFor="pv-sdate" className="label">
                Datum podpisu
              </label>
              <input id="pv-sdate" type="date" className="input" value={a.signDate} onChange={(e) => set("signDate", e.target.value)} />
            </div>
          </div>
        </fieldset>
      </form>

      <div className="space-y-4">
        <pre className="doc-paper card w-full overflow-x-auto whitespace-pre-wrap bg-white font-serif text-[15px] leading-relaxed text-ink">{text}</pre>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Tisk nebo uložit jako PDF
          </button>
          <button type="button" className="btn-secondary" onClick={copy}>
            {copied ? "Zkopírováno" : "Kopírovat text"}
          </button>
        </div>
        <p className="no-print text-sm text-muted">Text se skládá ve vašem prohlížeči, na náš server se nic neodesílá. Nevyplněná místa ⟨…⟩ můžete doplnit ručně.</p>
      </div>
    </div>
  );
}
