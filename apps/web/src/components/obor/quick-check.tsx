"use client";

import Link from "next/link";
import { useState } from "react";
import { trackEvent } from "@/components/analytics-beacon";
import { RichText } from "@/components/rich-text";
import type { CheckAnswer, CheckQuestion, CheckTone } from "@/content/obor-landings";

/**
 * S4: rychlá kontrola na stránkách „EET pro …“ – otázky po jedné (Ano / Ne), pak co pro vás platí, plán po datech
 * a výzva k předregistraci. Stav jen v paměti stránky (nic se neukládá), na konci jen událost quiz_done.
 */

const TONE: Record<CheckTone, { box: string; label: string; dot: string }> = {
  yes: { box: "border-brand-500 bg-brand-50", label: "Evidujete", dot: "bg-brand-600" },
  maybe: { box: "border-sun-500 bg-sun-100", label: "Můžete volit", dot: "bg-sun-500" },
  no: { box: "border-line bg-surface", label: "Nejspíš ne", dot: "bg-muted" },
  info: { box: "border-line bg-white", label: "Dobré vědět", dot: "bg-brand-500" },
};

export interface QuickCheckProps {
  questions: readonly CheckQuestion[];
  /** „pro váš salon“ */
  forYour: string;
  /** pokladna ještě zavřená (isClosed("/pokladna")) – předregistrace místo přihlášení */
  closed: boolean;
  disLabel: string;
  launchLabel: string;
  eetOffDeadline: string;
  startHref: string;
  startLabel: string;
}

export function QuickCheck({ questions, forYour, closed, disLabel, launchLabel, eetOffDeadline, startHref, startLabel }: QuickCheckProps) {
  const [answers, setAnswers] = useState<boolean[]>([]);
  const step = answers.length;
  const done = step >= questions.length;
  const total = questions.length;

  function answer(value: boolean) {
    const next = [...answers, value];
    setAnswers(next);
    if (next.length === total) trackEvent("quiz_done");
  }

  if (!done) {
    const q = questions[step]!;
    return (
      <div className="card mx-auto max-w-2xl p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-brand-700">
            Otázka {step + 1}/{total}
          </p>
          {step > 0 && (
            <button type="button" onClick={() => setAnswers(answers.slice(0, -1))} className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">
              ← Zpět
            </button>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(step / total) * 100}%` }} />
        </div>
        <h3 className="mt-5 text-2xl font-bold leading-snug text-ink" aria-live="polite">
          {q.q}
        </h3>
        {q.hint && <p className="mt-2 text-[15px] text-ink-soft">{q.hint}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => answer(true)} className="btn-primary py-4 text-lg">
            Ano
          </button>
          <button type="button" onClick={() => answer(false)} className="btn-secondary py-4 text-lg">
            Ne
          </button>
        </div>
      </div>
    );
  }

  const gateNo = questions.some((q, i) => q.gate && answers[i] === false);
  const eetOff = questions.some((q, i) => q.eetOff && answers[i] === true);
  const items: CheckAnswer[] = questions.flatMap((q, i) => {
    const a = answers[i] ? q.yes : q.no;
    return a ? [a] : [];
  });

  const plan: { date: string; text: string }[] = gateNo
    ? []
    : [
        { date: `od ${disLabel}`, text: "V DIS+ (MOJE daně) se přihlaste k evidenci tržeb, oznamte evidenční jednotky a zdarma si vygenerujte pokladní certifikát." },
        closed
          ? { date: launchLabel, text: `Spouštíme pokladnu EvidujZdarma – zdarma navždy. Po předregistraci vám pošleme pozvánku a návod k DIS+ a certifikátu krok za krokem.` }
          : { date: `od ${launchLabel}`, text: `Nastavte si pokladnu EvidujZdarma ${forYour} – zdarma navždy.` },
        ...(eetOff ? [{ date: `do ${eetOffDeadline}`, text: "Pokud zvolíte EET OFF, podejte oznámení o přihlášení k přirážce. Jinak evidujete." }] : []),
        { date: "od 1. 1. 2027", text: "Evidujete každou platbu přijatou na místě." },
      ];

  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-ink">{gateNo ? "Evidence se vás nejspíš netýká" : `Co platí ${forYour}`}</h3>
        <button type="button" onClick={() => setAnswers([])} className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">
          Odpovědět znovu
        </button>
      </div>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.text} className={`rounded-2xl border-2 p-5 ${TONE[it.tone].box}`}>
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span className={`h-2 w-2 rounded-full ${TONE[it.tone].dot}`} aria-hidden="true" />
              {TONE[it.tone].label}
            </p>
            <p className="text-[17px] leading-relaxed text-ink">
              <RichText text={it.text} />
            </p>
          </li>
        ))}
      </ul>

      {plan.length > 0 && (
        <div className="card p-6">
          <h4 className="text-xl font-bold text-ink">Váš plán</h4>
          <ol className="mt-4 space-y-4">
            {plan.map((p, i) => (
              <li key={p.date} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong className="block text-ink">{p.date}</strong>
                  <span className="text-ink-soft">{p.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-base font-medium text-ink">
          {closed ? `Pokladnu ${forYour} spouštíme ${launchLabel}. Předregistrace zabere 20 vteřin.` : `Pokladna ${forYour} zdarma navždy.`}
        </p>
        <div className="flex shrink-0 flex-wrap gap-3">
          {closed ? (
            <a href="#registrace" className="btn-primary no-underline">
              Předregistrovat pokladnu zdarma
            </a>
          ) : (
            <Link href={startHref} className="btn-primary no-underline">
              {startLabel}
            </Link>
          )}
          <Link href="/ukazka" className="btn-secondary no-underline">
            Vyzkoušet ukázku
          </Link>
        </div>
      </div>
    </div>
  );
}
