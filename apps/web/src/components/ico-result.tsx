"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RzpRecord, Subject } from "@ez/cz";
import { legalFormShort } from "@ez/cz/legal-form";
import { krajByCode } from "@ez/cz/regions";
import { assess, DEFAULT_ANSWERS, type Answers } from "@/lib/eet-assessment";
import { ExternalLink } from "@/components/external-link";

const TONE = {
  likely: { box: "border-brand-500 bg-brand-50", dot: "bg-brand-500", label: "Pravděpodobně ano" },
  possible: { box: "border-sun-500 bg-sun-100", dot: "bg-sun-500", label: "Možná – upřesněte" },
  unlikely: { box: "border-line bg-surface", dot: "bg-muted", label: "Pravděpodobně ne" },
  dissolved: { box: "border-line bg-surface", dot: "bg-muted", label: "Subjekt zanikl" },
} as const;

function Choice<T extends string>({ name, value, onChange, options }: { name: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-4 py-2 text-[15px] font-medium transition-colors ${value === o.value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink hover:bg-surface"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IcoResult({ subject, rzp, fetchedAt }: { subject: Subject; rzp: RzpRecord | null; fetchedAt: string }) {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const a = useMemo(() => assess(subject, rzp, answers), [subject, rzp, answers]);
  const tone = TONE[a.verdict];
  const fo = legalFormShort(subject.legalForm) === "OSVČ";
  const kraj = krajByCode(subject.address.regionCode);

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">{subject.name}</h2>
            <p className="mt-1 text-ink-soft">
              IČO {subject.ico} · {legalFormShort(subject.legalForm)}
              {subject.address.city && <> · {subject.address.city}</>}
              {kraj && <> ({kraj.name})</>}
              {subject.foundedAt && <> · vznik {new Date(subject.foundedAt).toLocaleDateString("cs-CZ")}</>}
            </p>
          </div>
          <span className="chip bg-surface text-muted">Údaje z ARES k {new Date(fetchedAt).toLocaleDateString("cs-CZ")}</span>
        </div>
      </section>

      <section className={`rounded-2xl border-2 p-6 ${tone.box}`} aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden="true" />
          {tone.label}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{a.headline}</h2>
        <ul className="mt-4 space-y-1.5 text-[15px] text-ink-soft">
          {a.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-white/70 p-4 text-[15px] text-ink">
          <strong>EET OFF:</strong> {a.eetOffText}
        </p>
      </section>

      {a.verdict !== "dissolved" && (
        <section className="card space-y-6">
          <h2 className="text-xl font-bold">Upřesněte odpověď</h2>
          <p className="-mt-4 text-[15px] text-muted">ARES neukazuje, jak přijímáte platby ani zda jste v paušálním režimu.</p>
          <div className="space-y-2">
            <p className="font-medium">Přijímáte platby od zákazníků osobně – hotově, kartou nebo QR kódem na místě?</p>
            <Choice
              name="Platby osobně"
              value={answers.inPerson}
              onChange={(v) => setAnswers({ ...answers, inPerson: v })}
              options={[
                { value: "yes", label: "Ano" },
                { value: "no", label: "Ne, jen fakturou / převodem / přes e-shop" },
                { value: "unknown", label: "Nevím" },
              ]}
            />
          </div>
          {fo && (
            <>
              <div className="space-y-2">
                <p className="font-medium">Jste v paušálním režimu?</p>
                <Choice
                  name="Paušální režim"
                  value={answers.pausal}
                  onChange={(v) => setAnswers({ ...answers, pausal: v })}
                  options={[
                    { value: "band1", label: "Ano, 1. pásmo" },
                    { value: "band2", label: "2. pásmo" },
                    { value: "band3", label: "3. pásmo" },
                    { value: "no", label: "Ne" },
                    { value: "unknown", label: "Nevím" },
                  ]}
                />
              </div>
              {answers.pausal === "band1" && (
                <div className="space-y-2">
                  <p className="font-medium">Jsou vaše roční příjmy ze samostatné činnosti do 1 000 000 Kč?</p>
                  <Choice
                    name="Příjmy do 1 mil."
                    value={answers.incomeUnder1M}
                    onChange={(v) => setAnswers({ ...answers, incomeUnder1M: v })}
                    options={[
                      { value: "yes", label: "Ano" },
                      { value: "no", label: "Ne" },
                      { value: "unknown", label: "Nevím" },
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </section>
      )}

      {a.checklist.length > 0 && (
        <section className="card">
          <h2 className="text-xl font-bold">Váš EET checklist</h2>
          <ol className="mt-4 space-y-4">
            {a.checklist.map((c, i) => (
              <li key={c.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{i + 1}</span>
                <div>
                  <p className="font-semibold">
                    {c.title}
                    {c.date && <span className="ml-2 text-sm font-medium text-brand-700">do {c.date}</span>}
                  </p>
                  <p className="text-[15px] text-ink-soft">{c.text}</p>
                  {c.href && (
                    <Link href={c.href} className="text-[15px] font-medium text-brand-700 underline underline-offset-4">
                      Jak na to →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rzp && rzp.establishments.length > 0 && (
        <section className="card">
          <h2 className="text-xl font-bold">Provozovny v živnostenském rejstříku</h2>
          <p className="mt-1 text-[15px] text-muted">IČP z RŽP není číslo evidenční jednotky – to přidělí Finanční správa v DIS+.</p>
          <ul className="mt-4 divide-y divide-line">
            {rzp.establishments.map((e) => (
              <li key={e.icp} className="py-3">
                <p className="font-medium">
                  {e.name ?? e.address.street ?? e.address.text ?? "Provozovna"}
                  {e.endedAt && new Date(e.endedAt) <= new Date() && <span className="chip ml-2 bg-surface text-muted">ukončena</span>}
                </p>
                <p className="text-sm text-ink-soft">
                  IČP {e.icp}
                  {e.address.city && <> · {e.address.city}</>}
                  {e.trades.length > 0 && <> · {e.trades.slice(0, 2).join(", ")}</>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted">
        Orientační výsledek z veřejných údajů, nejde o daňové poradenství. Přesné podmínky:{" "}
        <ExternalLink href="https://eet.gov.cz/cs/koho-se-eet-tyka/kdo-musi-evidovat-trzby" className="underline">
          eet.gov.cz – Kdo musí evidovat tržby
        </ExternalLink>
        .
      </p>
    </div>
  );
}
