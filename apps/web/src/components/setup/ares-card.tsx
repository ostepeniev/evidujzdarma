"use client";

import { isValidIco } from "@ez/cz/ico";

/**
 * Karta ARES v kroku „Firma“ (R17.3): „Je to vaše firma?“ místo syrových polí. Zaniklý subjekt (verdikt dissolved ze
 * stejného assess() jako „Subjekt zanikl“ na /kontrola-ico) kartu nemá, nenalezený – výzva vyplnit ručně. Texty doslovně.
 */
export type AresOutcome =
  | { kind: "found"; subject: { name: string; address: string | null; dic: string | null; vatPayer: boolean } }
  | { kind: "dissolved" }
  | { kind: "notfound" }
  | { kind: "error"; message: string };

/** Úplné platné IČO (8 číslic s kontrolní číslicí) – po jeho zadání se ARES načte sám. */
export function isCompleteIco(input: string): boolean {
  const v = input.replace(/\s+/g, "");
  return /^\d{8}$/.test(v) && isValidIco(v);
}

type ApiSubject = { name: string; dic: string | null; vatPayer: boolean; address?: { text?: string | null; street?: string | null; city?: string | null; postalCode?: string | null } };

function addressText(a: ApiSubject["address"]): string | null {
  if (!a) return null;
  if (a.text) return a.text;
  const line = [a.street, [a.postalCode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return line || null;
}

/** Odpověď /api/ico/[ico] → stav karty. */
export function aresOutcome(status: number, data: unknown): AresOutcome {
  const d = (data ?? {}) as { subject?: ApiSubject; assessment?: { verdict?: string }; error?: string };
  if (status === 404) return { kind: "notfound" };
  if (status !== 200 || !d.subject) return { kind: "error", message: d.error ?? "Registr ARES se nepodařilo načíst." };
  if (d.assessment?.verdict === "dissolved") return { kind: "dissolved" };
  return { kind: "found", subject: { name: d.subject.name, address: addressText(d.subject.address), dic: d.subject.dic, vatPayer: d.subject.vatPayer } };
}

export function AresCard({ outcome, onUse, onManual }: { outcome: AresOutcome; onUse: () => void; onManual: () => void }) {
  if (outcome.kind === "dissolved") return <p className="rounded-xl bg-sun-100 p-3 text-[15px] text-warn-700">Podle ARES tento subjekt zanikl. Zkontrolujte, zda je IČO správné.</p>;
  if (outcome.kind === "notfound") return <p className="rounded-xl bg-surface p-3 text-[15px] text-ink-soft">Subjekt s tímto IČO jsme v ARES nenašli. Údaje vyplňte ručně.</p>;
  if (outcome.kind === "error") return <p className="rounded-xl bg-danger-50 p-3 text-[15px] text-danger-600">{outcome.message}</p>;
  const s = outcome.subject;
  const rows: [string, string][] = [
    ["Název", s.name],
    ["Sídlo", s.address ?? "—"],
    ["DIČ", s.dic ?? "—"],
    ["Plátce DPH", s.vatPayer ? "Ano" : "Ne"],
  ];
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
      <h3 className="text-lg font-semibold">Je to vaše firma?</h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={onUse}>
          Ano, použít údaje z ARES
        </button>
        <button type="button" className="btn-secondary" onClick={onManual}>
          Vyplnit ručně
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">Údaje jsme načetli z veřejného registru ARES. Zkontrolujte je – tisknou se na účtenku.</p>
    </div>
  );
}
