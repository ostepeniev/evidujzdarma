/**
 * Šablony dopisů účetních klientům k EET 2.0.
 *
 * Všechna fakta (termíny, částky, podmínky) se skládají z `facts.ts` — žádná nová právní
 * tvrzení. Při změně faktů se šablony aktualizují samy.
 */
import { FACTS, TIMELINE, formatKc } from "./facts";

export const PLACEHOLDER_CLIENT = "[Jméno klienta]";
export const PLACEHOLDER_OFFICE = "[Vaše kancelář]";

export interface LetterTemplate {
  id: string;
  title: string;
  /** kdy dopis poslat */
  when: string;
  /** komu je určen */
  audience: string;
  subject: string;
  body: string;
}

const greeting = `Dobrý den, ${PLACEHOLDER_CLIENT},`;
const signature = `S pozdravem\n${PLACEHOLDER_OFFICE}`;

const timelineSteps = TIMELINE.map((t) => `• ${t.dateLabel} – ${t.title}: ${t.action}`).join("\n");

export const LETTERS: readonly LetterTemplate[] = [
  {
    id: "uvod",
    title: "Úvod: EET 2.0 a co vás čeká",
    when: "Hned – ideálně před 1. 11. 2026",
    audience: "Všem klientům, kteří přijímají platby osobně",
    subject: "EET 2.0: co vás čeká od roku 2027 a co udělat už teď",
    body: [
      greeting,
      `chceme vás upozornit, že ${FACTS.law.effectiveFrom} nabývá účinnosti nový ${FACTS.law.name}. Leden 2027 je pilotní (dobrovolný) provoz, ostrý provoz začíná 1. 2. 2027.`,
      `Koho se to týká: ${FACTS.whoMust.summary} ${FACTS.whoMust.notCovered}`,
      `Co se eviduje: ${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
      `Důležité termíny:\n${timelineSteps}`,
      `Paušalisté v 1. pásmu s příjmy do ${formatKc(FACTS.eetOff.incomeLimit)} mohou místo evidence zvolit režim EET OFF. Pokud se vás to týká, napíšeme vám k tomu zvlášť.`,
      "S přípravou vám rádi pomůžeme. Ozvěte se nám prosím, pokud si nejste jisti, zda se vás evidence týká, nebo pokud chcete probrat výběr pokladny.",
      signature,
    ].join("\n\n"),
  },
  {
    id: "eet-off",
    title: "Paušalisté: rozhodnutí o EET OFF",
    when: "Listopad–prosinec 2026",
    audience: "Fyzickým osobám v 1. pásmu paušálního režimu",
    subject: `EET OFF: rozhodnutí potřebujeme nejpozději do ${FACTS.eetOff.deadline}`,
    body: [
      greeting,
      "protože jste v paušálním režimu, chceme vás upozornit na možnost zvolit režim EET OFF.",
      FACTS.eetOff.summary,
      `Za celý rok to dělá přirážku ${formatKc(FACTS.eetOff.surchargeMonthly * 12)}.`,
      FACTS.eetOff.howTo,
      "Pokud EET OFF nezvolíte a přijímáte platby osobně (hotově, kartou nebo QR kódem na místě), budete od 1. 2. 2027 tržby evidovat.",
      "Zda se vám přirážka vyplatí, můžete si orientačně spočítat na evidujzdarma.cz/kalkulacka-eet-off, nebo to probereme společně. Dejte nám prosím vědět co nejdříve, nejlépe do konce roku 2026, abychom oznámení stihli podat včas.",
      signature,
    ].join("\n\n"),
  },
  {
    id: "podklady",
    title: "Podklady: evidenční jednotky a certifikát",
    when: "Od 1. 11. 2026 (spuštění EET v DIS+)",
    audience: "Klientům, kterým pomáháte s DIS+",
    subject: "EET 2.0: prosíme o podklady k evidenčním jednotkám",
    body: [
      greeting,
      `od ${TIMELINE[0]!.dateLabel} je v DIS+ (MOJE daně) možné přihlásit se k evidenci tržeb, oznámit evidenční jednotky a vygenerovat pokladní certifikát.`,
      `Co je evidenční jednotka: ${FACTS.units.summary} ${FACTS.units.change}`,
      "Abychom vám mohli pomoci, pošlete nám prosím:\n• seznam všech míst, kde přijímáte platby (provozovna, stánek, automat, vozidlo, internetová stránka či aplikace),\n• informaci, zda prodáváte i mimo provozovnu (trhy, akce, u zákazníka),\n• kolik zařízení (pokladen, telefonů, tabletů) budete k evidenci používat.",
      `Pokladní certifikát: ${FACTS.certificate.summary}`,
      signature,
    ].join("\n\n"),
  },
  {
    id: "ostry-provoz",
    title: "Kontrola před ostrým provozem",
    when: "Leden 2027 (pilotní provoz)",
    audience: "Všem klientům, kteří budou evidovat",
    subject: "EET 2.0: ostrý provoz od 1. 2. 2027 – poslední kontrola",
    body: [
      greeting,
      "od 1. 2. 2027 začíná ostrý provoz evidence tržeb. Prosíme, projděte si krátký kontrolní seznam:",
      [
        "☐ Jste přihlášeni k evidenci v DIS+ a máte oznámené všechny evidenční jednotky.",
        "☐ Máte pokladní certifikát nahraný v pokladně (platí 366 dní).",
        "☐ Pokladnu jste si vyzkoušeli v lednovém pilotním provozu.",
        `☐ Víte, co dělat bez signálu: ${FACTS.offline.summary}`,
        `☐ ${FACTS.confirmation.summary}`,
      ].join("\n"),
      `Účtenka: ${FACTS.receipt.summary}`,
      `Sankce: ${FACTS.penalties.summary}`,
      "Pokud cokoli z toho ještě nemáte, ozvěte se nám – vyřešíme to společně.",
      signature,
    ].join("\n\n"),
  },
];

/** Doplní název kanceláře; ostatní zástupné texty v hranatých závorkách nechá. */
export function fillLetter(text: string, office: string): string {
  const name = office.trim();
  return name ? text.split(PLACEHOLDER_OFFICE).join(name) : text;
}
