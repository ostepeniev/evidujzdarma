import type { HelpArticle } from "./types";

/**
 * Pro účetní: setup-app.tsx (Export pro účetní, Uzávěrky a pokladní kniha, Účetní s přístupem), app/api/ucet/export
 * (sloupce CSV), components/cabinet/* a lib/server/cabinet.ts (kabinet, pozvánka 14 dní, shoda IČO).
 */
export const UCETNI: readonly HelpArticle[] = [
  {
    slug: "export-pro-ucetni",
    topic: "ucetni",
    title: "Export tržeb a pokladní kniha pro účetní",
    description:
      "Jak z pokladny EvidujZdarma stáhnout export tržeb za libovolné období do CSV pro Excel a pokladní knihu s uzávěrkami ze všech pokladen pro účetní.",
    lead: "Účetní nepotřebuje přístup do pokladny – stačí jí dva soubory CSV z **Nastavení pokladny**: export tržeb a pokladní kniha. Oba obsahují údaje ze všech vašich pokladen.",
    steps: [
      {
        name: "Zvolte období",
        text: "V kroku **Export pro účetní** vyplňte **Od** a **Do**. Předvyplněné je období od začátku měsíce do dneška. Dny se počítají v českém čase, od půlnoci do půlnoci – tržba po půlnoci patří do nového dne.",
      },
      { name: "Stáhněte tržby", text: "Klepněte na **Stáhnout CSV**. Soubor má středníky a desetinné čárky, takže ho český Excel otevře rovnou." },
      {
        name: "Stáhněte pokladní knihu",
        text: "V kroku **Uzávěrky a pokladní kniha** zvolte období a klepněte na **Pokladní kniha (CSV)**. Tržby v hotovosti v ní jsou souhrnně za každou uzávěrku.",
      },
      { name: "Předejte soubory", text: "Pošlete je účetní, nebo ji s účtem propojte – pak si export stáhne sama. Viz [Účetní kabinet a pozvánka](/napoveda/propojeni-s-ucetni)." },
    ],
    sections: [
      {
        id: "co-export-obsahuje",
        heading: "Co export obsahuje",
        blocks: [
          {
            p: "Každá tržba je jeden řádek: datum a čas, pokladna, evidenční jednotka, pořadové číslo, celková částka, částky podle způsobu platby, spropitné, sleva, základ a DPH podle sazeb, evidovaná částka, POK, stav, důvod odmítnutí, režim, odkaz na původní tržbu u vratky a jméno pokladní.",
          },
          { p: "Uzávěrky v nastavení ukazují i součet rozdílů za období – manka a přebytky ze všech pokladen na jednom místě." },
        ],
      },
    ],
    related: ["propojeni-s-ucetni", "denni-uzaverka", "denni-prehled"],
    updated: "2026-10-17",
  },
  {
    slug: "propojeni-s-ucetni",
    topic: "ucetni",
    title: "Účetní kabinet a pozvánka od účetní",
    description:
      "Jak účetní v Účetním kabinetu EvidujZdarma pozve klienta do pokladny a jak klient pozvánku přijme. Co účetní po propojení vidí a jak přístup zrušit.",
    lead: "Účetní si v **Účetním kabinetu** vede přehled, jak jsou klienti připravení na EET 2.0, a po propojení stahuje export jejich tržeb. Propojení potvrzuje klient sám a může ho kdykoli zrušit.",
    steps: [
      {
        name: "Účetní založí kabinet",
        text: "Přihlásí se e-mailem na evidujzdarma.cz/kabinet, vyplní **Název kanceláře** (IČO je nepovinné), souhlasí s podmínkami a klepne na **Založit kabinet**.",
      },
      { name: "Přidá klienty", text: "Do pole **Přidat klienty** vloží IČO klientů, oddělená čárkou nebo novým řádkem, a klepne na tlačítko **Přidat klienty**." },
      { name: "Pošle pozvánku", text: "U klienta klepne na **Pozvat do pokladny**. Odkaz se zkopíruje do schránky a platí 14 dní." },
      {
        name: "Klient pozvánku přijme",
        text: "Otevře odkaz, klepne na **Přihlásit se e-mailem** a pak na **Propojit s účetní**. Pokud ještě nemá vyplněnou firmu, pozvánka ho pošle nejdřív do nastavení.",
      },
    ],
    sections: [
      {
        id: "co-ucetni-vidi",
        heading: "Co účetní uvidí",
        blocks: [
          {
            p: "U propojeného klienta se stav **DIS+**, **Jednotky**, **Certifikát** a **1. tržba** zjišťuje z pokladny automaticky; u ostatních ho účetní odškrtává ručně. Export tržeb propojených klientů stáhne tlačítkem **Stáhnout CSV**. Do pokladny samotné účetní nevstupuje.",
          },
        ],
      },
      {
        id: "zruseni",
        heading: "Shoda IČO a zrušení propojení",
        blocks: [
          {
            p: "Pozvánka platí jen pro IČO, pro které ji účetní vystavila. Po propojení dostane vlastník e-mail. Propojení zrušíte v nastavení pokladny v oddílu **Účetní s přístupem** tlačítkem **Zrušit propojení**.",
          },
        ],
      },
    ],
    related: ["export-pro-ucetni", "firma-a-ares", "bezpecnost"],
    updated: "2026-10-17",
  },
];
