"use client";

import Link from "next/link";
import { useState } from "react";
import { FACTS, SOURCES, formatKc, type Source } from "@/content/facts";

type Choice = { label: string; next: string };
interface Question {
  id: string;
  text: string;
  help?: string;
  choices: Choice[];
}
interface Result {
  id: string;
  tone: "yes" | "maybe" | "no";
  title: string;
  text: string;
  links: { href: string; label: string }[];
  sources: Source[];
}

const Q: Record<string, Question> = {
  q1: {
    id: "q1",
    text: "Máte příjmy z podnikání nebo jiné samostatné činnosti?",
    help: "Jako OSVČ, firma, spolek s podnikatelskou činností… Příjmy ze zaměstnání, nájmu nebo kapitálové příjmy se neevidují.",
    choices: [
      { label: "Ano", next: "q2" },
      { label: "Ne, jen zaměstnání, nájem nebo kapitálové příjmy", next: "r-not-business" },
    ],
  },
  q2: {
    id: "q2",
    text: "Přijímáte od zákazníků platby osobně nebo v provozovně?",
    help: "Hotovost, platební karta, QR kód naskenovaný na místě, poukázka, šek. Nepočítá se platba přes platební bránu e-shopu, QR kód na webu ani převod na základě faktury.",
    choices: [
      { label: "Ano, aspoň někdy", next: "q3" },
      { label: "Ne, jen platby na dálku (faktura, převod, e-shop)", next: "r-remote" },
    ],
  },
  q3: {
    id: "q3",
    text: "Patří vaše činnost mezi vyjmuté?",
    help: "Např. část železniční osobní a letecké dopravy, poštovní služby, hazardní hry, licencované dodávky energií, voda a kanalizace, nebankovní spotřebitelské úvěry.",
    choices: [
      { label: "Ano, veškerá moje činnost je vyjmutá", next: "r-exempt" },
      { label: "Jen část činnosti", next: "q4" },
      { label: "Ne", next: "q4" },
    ],
  },
  q4: {
    id: "q4",
    text: "Jste fyzická osoba v paušálním režimu?",
    choices: [
      { label: "Ano, v 1. pásmu", next: "q5" },
      { label: "Ano, ve 2. nebo 3. pásmu", next: "q6" },
      { label: "Ne / jsem právnická osoba", next: "q6" },
    ],
  },
  q5: {
    id: "q5",
    text: "Jsou vaše roční příjmy ze samostatné činnosti do 1 000 000 Kč?",
    choices: [
      { label: "Ano", next: "r-eetoff" },
      { label: "Ne", next: "q6" },
    ],
  },
  q6: {
    id: "q6",
    text: "Kde platby přijímáte?",
    help: "Podle toho oznámíte evidenční jednotky v DIS+.",
    choices: [
      { label: "V provozovně", next: "r-yes" },
      { label: "U zákazníka / bez provozovny", next: "r-yes-mobile" },
      { label: "Na více místech (stánek, vozidlo, automat…)", next: "r-yes-mobile" },
    ],
  },
};

const R: Record<string, Result> = {
  "r-not-business": {
    id: "r-not-business",
    tone: "no",
    title: "Evidence tržeb se vás netýká",
    text: FACTS.whoMust.notCovered,
    links: [{ href: "/navody/koho-se-eet-tyka", label: "Koho se EET týká" }],
    sources: [SOURCES.kdoMusi],
  },
  "r-remote": {
    id: "r-remote",
    tone: "no",
    title: "Pravděpodobně evidovat nemusíte",
    text: `${FACTS.evidenced.notEvidenced} Jakmile ale začnete přijímat platby osobně (hotově, kartou, QR kódem na místě), evidence se vás týká.`,
    links: [{ href: "/navody/kontaktni-platba", label: "Co se eviduje a co ne" }],
    sources: [SOURCES.kdoMusi],
  },
  "r-exempt": {
    id: "r-exempt",
    tone: "maybe",
    title: "Vaše činnost je pravděpodobně vyjmutá",
    text: `${FACTS.whoMust.exemptions} Výjimku si ověřte na eet.gov.cz nebo u daňového poradce – vztahuje se jen na konkrétní činnost.`,
    links: [{ href: "/navody/koho-se-eet-tyka", label: "Koho se EET týká a kdo má výjimku" }],
    sources: [SOURCES.kdoMusi],
  },
  "r-eetoff": {
    id: "r-eetoff",
    tone: "maybe",
    title: "Evidovat musíte – nebo zvolte EET OFF",
    text: `Splňujete podmínky režimu EET OFF: za přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně k paušální záloze tržby evidovat nemusíte. ${FACTS.eetOff.howTo}`,
    links: [
      { href: "/kalkulacka-eet-off", label: "Spočítat, zda se EET OFF vyplatí" },
      { href: "/navody/eet-off", label: "EET OFF: vyplatí se?" },
    ],
    sources: [SOURCES.eetOff, SOURCES.eetOffJak],
  },
  "r-yes": {
    id: "r-yes",
    tone: "yes",
    title: "Ano, tržby budete evidovat",
    text: `${FACTS.whoMust.summary} Od 1. 11. 2026 se přihlaste k evidenci v DIS+, oznamte provozovnu jako evidenční jednotku a vygenerujte pokladní certifikát. Ostrý provoz začíná 1. 2. 2027.`,
    links: [
      { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami" },
      { href: "/navody/jak-aktivovat-dis-a-certifikat", label: "Jak aktivovat DIS+ a certifikát" },
    ],
    sources: [SOURCES.kdoMusi, SOURCES.harmonogram],
  },
  "r-yes-mobile": {
    id: "r-yes-mobile",
    tone: "yes",
    title: "Ano, tržby budete evidovat – i mimo provozovnu",
    text: `${FACTS.units.summary} Pokladna by měla zvládat i práci bez signálu. ${FACTS.offline.summary}`,
    links: [
      { href: "/evidencni-jednotky", label: "Které jednotky oznámit" },
      { href: "/navody/eet-bez-internetu", label: "EET bez internetu" },
    ],
    sources: [SOURCES.jakZacit, SOURCES.prakticke],
  },
};

const TONE = {
  yes: "border-brand-500 bg-brand-50",
  maybe: "border-sun-500 bg-sun-100",
  no: "border-line bg-surface",
} as const;

export function Quiz() {
  const [path, setPath] = useState<string[]>(["q1"]);
  const current = path[path.length - 1]!;
  const step = path.filter((p) => p.startsWith("q")).length;
  const question = Q[current];
  const result = R[current];

  return (
    <div className="card mx-auto max-w-2xl p-6 sm:p-8">
      {question && (
        <div>
          <p className="text-sm font-semibold text-brand-700">Otázka {step}</p>
          <h2 className="mt-1 text-2xl font-bold leading-snug text-ink">{question.text}</h2>
          {question.help && <p className="mt-2 text-[15px] text-ink-soft">{question.help}</p>}
          <div className="mt-6 grid gap-3">
            {question.choices.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setPath([...path, c.next])}
                className="rounded-xl border border-line bg-white px-5 py-4 text-left text-[17px] font-medium text-ink transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div aria-live="polite">
          <div className={`rounded-2xl border-2 p-6 ${TONE[result.tone]}`}>
            <h2 className="text-2xl font-bold text-ink">{result.title}</h2>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">{result.text}</p>
          </div>
          <ul className="mt-5 space-y-2">
            {result.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="font-medium text-brand-700 underline underline-offset-4">
                  {l.label} →
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted">
            Zdroj:{" "}
            {result.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} className="underline" rel="noopener">
                  {s.label}
                </a>
              </span>
            ))}
            . Orientační výsledek, nejde o daňové poradenství.
          </p>
          {result.tone !== "no" && (
            <Link href="/#registrace" className="btn-primary mt-6">
              Chci pokladnu pro EET zdarma
            </Link>
          )}
        </div>
      )}
      {path.length > 1 && (
        <div className="mt-6 flex gap-4 border-t border-line pt-4 text-[15px]">
          <button type="button" onClick={() => setPath(path.slice(0, -1))} className="font-medium text-ink-soft hover:text-ink">
            ← Zpět
          </button>
          <button type="button" onClick={() => setPath(["q1"])} className="font-medium text-ink-soft hover:text-ink">
            Začít znovu
          </button>
        </div>
      )}
    </div>
  );
}
