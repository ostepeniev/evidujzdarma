/**
 * Orientační posouzení "týká se mě EET?" z veřejných údajů ARES + RŽP a volitelných odpovědí.
 *
 * Záměrně vrací pravděpodobnost, ne verdikt: ARES neukazuje, zda podnikatel přijímá
 * platby osobně ani zda je v paušálním režimu. Proto 2–3 doplňující otázky.
 */
import { classifyNaceList, isNaturalPerson, legalFormName, type EetRelevance, type RzpRecord, type Subject } from "@ez/cz";
import { DIS_OPENS, EFFECTIVE_DATE, FACTS, formatKc, timelineAt } from "@/content/facts";

export type Answer = "yes" | "no" | "unknown";
export type PausalAnswer = "band1" | "band2" | "band3" | "no" | "unknown";

export interface Answers {
  inPerson: Answer;
  pausal: PausalAnswer;
  incomeUnder1M: Answer;
}

export const DEFAULT_ANSWERS: Answers = { inPerson: "unknown", pausal: "unknown", incomeUnder1M: "unknown" };

export type Verdict = "likely" | "possible" | "unlikely" | "dissolved";
export type EetOff = "possible" | "not_available" | "check";

export interface ChecklistItem {
  date?: string;
  title: string;
  text: string;
  href?: string;
}

export interface Assessment {
  verdict: Verdict;
  headline: string;
  eetOff: EetOff;
  eetOffText: string;
  reasons: string[];
  activeEstablishments: number;
  checklist: ChecklistItem[];
  naceRelevance: EetRelevance;
}

/** Klíčová slova živností, které typicky znamenají platby od spotřebitelů. */
const TRADE_LIKELY = [/hostinsk/i, /holičství|kadeřnictví/i, /kosmetick/i, /pedikúra|manikúra/i, /masér/i, /ubytovac/i, /prodej/i, /maloobchod/i, /taxi/i, /pekař|cukrář/i, /řeznictví/i, /opravy/i, /fitness|wellness/i];

function tradeRelevance(rzp: RzpRecord | null): EetRelevance | null {
  if (!rzp) return null;
  const texts = rzp.trades.flatMap((t) => [t.subject, ...t.fields]);
  if (texts.some((t) => TRADE_LIKELY.some((re) => re.test(t)))) return "likely";
  return texts.length ? "possible" : null;
}

function isActive(endedAt: string | null, now: Date): boolean {
  return !endedAt || new Date(endedAt) > now;
}

export function assess(subject: Subject, rzp: RzpRecord | null, answers: Answers = DEFAULT_ANSWERS, now = new Date()): Assessment {
  const fo = isNaturalPerson(subject.legalForm);
  const nace = classifyNaceList(subject.nace);
  const trade = tradeRelevance(rzp);
  const activeEstablishments = rzp?.establishments.filter((e) => isActive(e.endedAt, now)).length ?? 0;
  const reasons: string[] = [];

  reasons.push(`Právní forma: ${legalFormName(subject.legalForm)}.`);
  if (nace.matched.length) reasons.push(`Obory podle CZ-NACE: ${nace.matched.map((m) => m.label.toLowerCase()).join(", ")}.`);
  if (rzp?.trades.length) reasons.push(`Živnosti: ${rzp.trades.slice(0, 3).map((t) => t.subject).join("; ")}${rzp.trades.length > 3 ? " a další" : ""}.`);
  if (activeEstablishments) reasons.push(`V živnostenském rejstříku ${activeEstablishments === 1 ? "je 1 provozovna" : `je ${activeEstablishments} provozoven`}.`);

  // 1) Verdikt
  let verdict: Verdict;
  if (subject.dissolvedAt && new Date(subject.dissolvedAt) <= now) {
    verdict = "dissolved";
  } else if (answers.inPerson === "yes") {
    verdict = "likely";
    reasons.push("Uvedli jste, že přijímáte platby osobně (hotovost, karta, QR) – takové tržby se evidují.");
  } else if (answers.inPerson === "no") {
    verdict = "unlikely";
    reasons.push("Uvedli jste, že přijímáte jen platby na dálku (faktura, převod, platební brána) – ty se neevidují.");
  } else {
    const best = [nace.relevance, trade].includes("likely") || activeEstablishments > 0 ? "likely" : nace.relevance === "unlikely" && trade !== "possible" ? "unlikely" : "possible";
    verdict = best;
  }

  // 2) EET OFF
  let eetOff: EetOff;
  let eetOffText: string;
  if (!fo) {
    eetOff = "not_available";
    eetOffText = "EET OFF je jen pro fyzické osoby v 1. pásmu paušálního režimu – pro právnické osoby není.";
  } else if (answers.pausal === "band1" && answers.incomeUnder1M === "yes") {
    eetOff = "possible";
    eetOffText = `Splňujete podmínky EET OFF: přirážka ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně místo evidence. Oznámení podejte do ${FACTS.eetOff.deadline}.`;
  } else if (answers.pausal === "band2" || answers.pausal === "band3" || answers.pausal === "no" || answers.incomeUnder1M === "no") {
    eetOff = "not_available";
    eetOffText = "EET OFF je jen pro 1. pásmo paušálního režimu s příjmy do 1 mil. Kč – podle vašich odpovědí ho využít nemůžete.";
  } else {
    eetOff = "check";
    eetOffText = `Pokud jste v 1. pásmu paušálního režimu a máte příjmy do 1 mil. Kč, můžete zvolit EET OFF (přirážka ${formatKc(FACTS.eetOff.surchargeMonthly)}/měs.).`;
  }

  const headline =
    verdict === "dissolved"
      ? "Subjekt podle ARES zanikl – evidence tržeb se ho netýká."
      : verdict === "likely"
        ? eetOff === "possible"
          ? "EET 2.0 se vás pravděpodobně týká – můžete ale zvolit EET OFF."
          : "EET 2.0 se vás pravděpodobně týká."
        : verdict === "unlikely"
          ? "EET 2.0 se vás pravděpodobně netýká."
          : "EET 2.0 se vás může týkat – odpovězte na 2 otázky níže.";

  // 3) Checklist
  const today = now.toISOString().slice(0, 10);
  const checklist: ChecklistItem[] = [];
  if (verdict !== "dissolved" && verdict !== "unlikely") {
    const dis = timelineAt(DIS_OPENS);
    checklist.push({
      date: dis.date >= today ? dis.dateLabel : undefined,
      title: "Přihlášení k evidenci v DIS+",
      text: "V DIS+ (MOJE daně) se přihlaste k evidenci tržeb.",
      href: "/navody/jak-aktivovat-dis-a-certifikat",
    });
    checklist.push({
      title: "Oznámení evidenčních jednotek",
      text: activeEstablishments
        ? `Podle RŽP máte ${activeEstablishments === 1 ? "1 provozovnu" : `${activeEstablishments} provozovny`}. Každé místo, kde přijímáte tržby, oznamte jako evidenční jednotku – číslo jednotky přidělí Finanční správa (není to IČP z RŽP).`
        : "Oznamte každé místo, kde přijímáte tržby (provozovna, stánek, vozidlo, web). Bez provozovny uvedete jako jednotku sebe.",
      href: "/evidencni-jednotky",
    });
    checklist.push({
      title: "Pokladní certifikát",
      text: "Vygenerujte certifikát v DIS+ (zdarma, platí 366 dní). Jeden certifikát stačí pro více pokladen.",
      href: "/navody/jak-aktivovat-dis-a-certifikat",
    });
    if (fo && eetOff !== "not_available") {
      checklist.push({
        date: FACTS.eetOff.deadline,
        title: "Rozhodnutí o EET OFF",
        text: "Spočítejte si, zda se vám vyplatí přirážka místo evidence.",
        href: "/kalkulacka-eet-off",
      });
    }
    checklist.push({
      date: "prosinec 2026",
      title: "Pokladna vyzkoušená",
      text: "Pokladnu si vyzkoušejte v testovacím režimu ještě v prosinci – od ledna už se eviduje naostro.",
      href: "/#registrace",
    });
    checklist.push({
      date: timelineAt(EFFECTIVE_DATE).dateLabel,
      title: "Evidence tržeb",
      text: "Od 1. 1. 2027 musí být každá evidovaná tržba odeslána. Platí to i v lednu.",
    });
  }

  return { verdict, headline, eetOff, eetOffText, reasons, activeEstablishments, checklist, naceRelevance: nace.relevance };
}
