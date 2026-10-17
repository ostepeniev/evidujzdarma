import { FACTS } from "./facts";

/**
 * S1 (17. 10. 2026): checklist „Co udělat do 1. 1. 2027“ pro nástroj /checklist-eet. Kroky a data odpovídají seznamu
 * „Co musíte udělat“ v revidovaném kompletním průvodci (eet-2-0-kompletni-pruvodce, sekce co-udelat) – při změně
 * jednoho upravte i druhý (hlídá test s1-doc-tools).
 */
export interface ChecklistStep {
  id: string;
  when: string;
  title: string;
  text: string;
  link?: { href: string; label: string };
}

export const CHECKLIST: readonly ChecklistStep[] = [
  {
    id: "tyka-se",
    when: "Do konce října 2026",
    title: "Zjistěte, zda evidovat musíte",
    text: "Evidují se kontaktní platby – hotovost, karta, QR kód nebo stravenka při osobním kontaktu. Připravte si přístup do portálu MOJE daně (např. Identita občana nebo datová schránka).",
    link: { href: "/kontrola-ico", label: "Kontrola podle IČO" },
  },
  {
    id: "dis",
    when: "Od 1. 11. 2026",
    title: "Přihlaste se v DIS+ k evidenci tržeb",
    text: "Přihlášení k evidenci tržeb se podává v daňové informační schránce DIS+.",
    link: { href: "/navody/jak-aktivovat-dis-a-certifikat", label: "Postup v DIS+" },
  },
  {
    id: "jednotky",
    when: "Hned poté",
    title: "Oznamte evidenční jednotky",
    text: `${FACTS.units.summary} ${FACTS.units.allUnits}`,
    link: { href: "/navody/evidencni-jednotka", label: "Jak oznámit jednotky" },
  },
  {
    id: "certifikat",
    when: "Hned poté",
    title: "Vygenerujte pokladní certifikát",
    text: `${FACTS.certificate.summary} Stáhněte soubor .p12 a heslo k němu si dobře uschovejte.`,
    link: { href: "/navody/jak-aktivovat-dis-a-certifikat", label: "Certifikát krok za krokem" },
  },
  {
    id: "pokladna",
    when: "Listopad – prosinec 2026",
    title: "Vyberte pokladnu a nahrajte do ní certifikát",
    text: "Státní MOJE eet (od 1. 12. 2026), komerční pokladna, nebo EvidujZdarma. Do pokladny nahrajte certifikát a údaje evidenčních jednotek.",
    link: { href: "/srovnani/moje-eet", label: "Srovnání pokladen" },
  },
  {
    id: "eet-off",
    when: `Do ${FACTS.eetOff.deadline}`,
    title: "Paušalisté: rozhodněte o EET OFF",
    text: FACTS.eetOff.summary,
    link: { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF" },
  },
  {
    id: "test",
    when: "V prosinci 2026",
    title: "Vyzkoušejte odeslání tržby",
    text: "V testovacím režimu pokladny (nebo na Playgroundu Finanční správy) ověřte, že pokladna tržby odesílá a dostává POK.",
  },
  {
    id: "start",
    when: "Od 1. 1. 2027",
    title: "Evidujte každou kontaktní platbu",
    text: `Leden už je standardní evidence. ${FACTS.offline.summary}`,
    link: { href: "/navody/eet-bez-internetu", label: "EET bez internetu" },
  },
];
