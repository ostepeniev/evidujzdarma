import type { FaqItem } from "@/components/faq";
import { SERVICE_COPY } from "@/lib/site";
import { FACTS, formatKc } from "./facts";

export const WHO_MUST: readonly { title: string; text: string; tone: "yes" | "maybe" | "no"; href?: string; linkLabel?: string }[] = [
  {
    title: "Kdo přijímá hotovost, kartu nebo QR platbu osobně",
    text: "Obchody, stánky, kadeřnictví, kosmetika, řemeslníci, ubytování, taxi a další služby – fyzické i právnické osoby.",
    tone: "yes",
    href: "/navody/koho-se-eet-tyka",
    linkLabel: "Koho se EET týká",
  },
  {
    title: "Paušalisté v 1. pásmu s příjmy do 1 mil. Kč",
    text: `Mohou zvolit EET OFF – přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně (${formatKc(FACTS.eetOff.surchargeYearly)} ročně) místo evidence. Volba platí na celý rok, přihlásit se lze do ${FACTS.eetOff.deadline}.`,
    tone: "maybe",
    href: "/kalkulacka-eet-off",
    linkLabel: "Kalkulačka EET OFF",
  },
  {
    title: "Prodej mimo provozovnu, e-shop s osobním odběrem",
    text: "Mobilní stánek, automat, vozidlo i podnikatel bez provozovny – každý má svou evidenční jednotku.",
    tone: "yes",
    href: "/evidencni-jednotky",
    linkLabel: "Průvodce evidenčními jednotkami",
  },
  {
    title: "Vyjmuté činnosti",
    text: "Např. pravidelná osobní doprava, poštovní služby, hazardní hry nebo dodávky energií a vody (podle rozborů – výčet ověřte). Výjimka platí jen pro danou činnost. Výjimka „příležitostné tržby do 50 000 Kč“ v zákoně není.",
    tone: "maybe",
    href: "/musim-evidovat",
    linkLabel: "Kvíz: Musím evidovat?",
  },
  {
    title: "Platby jen na dálku",
    text: "Platební brána e-shopu, QR kód na webu nebo převod na základě faktury se neevidují.",
    tone: "no",
    href: "/navody/kontaktni-platba",
    linkLabel: "Co se eviduje a co ne",
  },
];

export const LANDING_FAQ: readonly FaqItem[] = [
  {
    q: "Od kdy platí EET 2.0?",
    a: `${FACTS.pilot.summary} Přípravu v DIS+ – přihlášení k evidenci, evidenční jednotky a pokladní certifikát – lze zahájit od 1. 11. 2026.`,
  },
  {
    q: "Které platby se evidují?",
    a: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}`,
  },
  {
    q: "Je pokladna EvidujZdarma opravdu zdarma?",
    a: "Ano. Evidence tržeb, práce bez signálu, až 5 uživatelů, 3 evidenční jednotky, účtenka e-mailem a QR a export CSV jsou zdarma navždy. Platí se jen za doplňky, které nás stojí peníze nebo šetří hodiny práce – například SMS účtenky nebo export do Pohody.",
  },
  {
    q: "Jste státní aplikace?",
    a: "Ne. EvidujZdarma je nezávislá služba soukromé firmy. Státní aplikace se jmenuje MOJE eet a bude dostupná od 1. 12. 2026 na eet.gov.cz. Obě řešení férově srovnáváme v tabulce výše.",
  },
  {
    q: "Co když nemám signál?",
    a: `${FACTS.offline.summary} ${SERVICE_COPY.offlineFaq}`,
  },
  {
    q: "Musím vydávat účtenku?",
    a: `${FACTS.receipt.summary} ${FACTS.confirmation.onReceipt}`,
  },
  {
    q: "Platí výjimka pro příležitostné tržby do 50 000 Kč?",
    a: FACTS.whoMust.occasional,
  },
  {
    q: "Co je evidenční jednotka?",
    a: `${FACTS.units.summary} Jednotky se oznamují v DIS+ a Finanční správa každé přidělí číslo. ${FACTS.units.change}`,
  },
  {
    q: "Co je EET OFF a vyplatí se mi?",
    a: `${FACTS.eetOff.summary} ${FACTS.eetOff.howTo} ${FACTS.eetOff.binding} Zda se to vyplatí, spočítáte v naší kalkulačce.`,
  },
  {
    q: "Jak získám certifikát pro evidenci tržeb?",
    a: FACTS.certificate.summary,
  },
  {
    q: "Jaké hrozí pokuty?",
    a: FACTS.penalties.summary,
  },
];
