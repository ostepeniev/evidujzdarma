import { SOURCES } from "../facts";
import type { Guide } from "./types";

/** S12 (22. 11. 2026): cluster „Doklady pro účetní bez chaosu“ – viz co-ucetni-potrebuje-kazdy-mesic.ts. Koncept do revize. */
export const parovaniPlatebSDoklady: Guide = {
  slug: "parovani-plateb-s-doklady",
  category: "doklady",
  title: "Párování plateb s doklady krok za krokem",
  description:
    "Jak jednou týdně spárovat platby z výpisu s fakturami a účtenkami: podle variabilního symbolu, částky a protistrany. A co s kartou, hotovostí a bez dokladu.",
  lead:
    "Párování znamená přiřadit ke každé platbě z výpisu doklad, který ji vysvětluje. Nejrychleji to jde jednou týdně a v pevném pořadí: nejdřív **variabilní symbol**, pak **částka a protistrana**, nakonec ručně to, co zbude. Co nespárujete, pošlete účetní jako otázku, ne jako hádanku.",
  summary: [
    "Stáhněte výpis za týden nebo měsíc – nejlépe jako soubor, ne jen PDF.",
    "Párujte v pořadí: variabilní symbol → částka a datum → protistrana → ručně.",
    "Souhrnné platby kartou párujte s denní uzávěrkou pokladny, ne s jednotlivými účtenkami.",
    "Nespárované platby označte a pošlete účetní s krátkou poznámkou, o co jde.",
  ],
  sections: [
    {
      id: "postup",
      heading: "Postup jednou týdně",
      blocks: [
        {
          ol: [
            "**Stáhněte výpis.** Z internetového bankovnictví za uplynulý týden – export CSV nebo ABO/GPC se dá zpracovat lépe než PDF.",
            "**Vydané faktury podle VS.** Příchozí platby s variabilním symbolem spárujte s vydanými fakturami se stejným číslem.",
            "**Přijaté faktury podle částky a data.** U odchozích plateb hledejte fakturu se stejnou částkou a splatností kolem data platby.",
            "**Karty a QR z pokladny.** Souhrnnou platbu od poskytovatele terminálu spárujte s tržbami kartou z denní uzávěrky; QR platby z pokladny s tržbou, ke které patří.",
            "**Zbytek ručně.** Předplatné, poplatky banky, platby kartou na internetu – doklady hledejte podle protistrany (viz [Chybějící doklady k platbám](/navody/chybejici-doklady-k-platbam)).",
            "**Co nespárujete, označte.** Účetní pošlete seznam s poznámkou: „soukromá platba“, „doklad vyžádán“, „záloha na zakázku X“.",
          ],
        },
      ],
    },
    {
      id: "pravidla",
      heading: "Pravidla, která párování zrychlí",
      blocks: [
        {
          ul: [
            "Na vydané faktuře mějte **variabilní symbol = číslo faktury**. Zákazník ho opíše a platba se spáruje sama.",
            "Pro podnikání používejte **samostatný účet** – soukromé platby pak nemusíte vysvětlovat.",
            "Hotovost vkládejte na účet **v celých částkách s poznámkou** „vklad tržeb“ a zapište ji do pokladní knihy jako výběr z kasy.",
            "Doklady pojmenujte jednotně, například `2026-11-14_dodavatel_1240.pdf` – podle data, protistrany a částky se hledají samy.",
          ],
        },
      ],
    },
    {
      id: "pokladna",
      heading: "Pokladna a EET v párování",
      blocks: [
        {
          p: "Tržby z pokladny se nepárují po jednotlivých účtenkách, ale po dnech: denní uzávěrka říká, kolik jste přijali hotově, kartou a QR kódem. Hotovost jde do pokladní knihy, karta proti souhrnné platbě od poskytovatele terminálu, QR proti příchozím platbám. Jak to do sebe zapadá, popisuje návod [Pokladní kniha, EET a banka](/navody/pokladni-kniha-eet-a-banka).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Jak často párovat?",
      a: "Jednou týdně je dobrý kompromis: platby máte ještě v paměti a na konci měsíce zbývá jen pár otázek pro účetní.",
    },
    {
      q: "Co když jedna platba hradí víc faktur?",
      a: "Přiřaďte k ní všechny faktury a poznamenejte, že jde o souhrnnou úhradu. Účetní pak ví, které faktury jsou zaplacené.",
    },
    {
      q: "Mám párování dělat já, nebo účetní?",
      a: "To se domluvte. Účetní to umí, ale nejvíc času jí zabere dohledávání dokladů, které má jen podnikatel. Když doklady přiřadíte vy, ona je zkontroluje a zaúčtuje rychleji.",
    },
  ],
  howTo: {
    name: "Párování plateb z výpisu s doklady",
    description: "Týdenní postup, jak ke každé platbě z bankovního výpisu přiřadit fakturu nebo účtenku.",
    steps: [
      { name: "Stáhnout výpis", text: "Z internetového bankovnictví stáhněte výpis za týden, nejlépe jako CSV." },
      { name: "Spárovat podle VS", text: "Příchozí platby s variabilním symbolem přiřaďte k vydaným fakturám." },
      { name: "Spárovat podle částky", text: "Odchozí platby přiřaďte k přijatým fakturám se stejnou částkou a splatností." },
      { name: "Spárovat pokladnu", text: "Souhrnné platby kartou a QR platby spárujte s denními uzávěrkami pokladny." },
      { name: "Poslat otázky", text: "Nespárované platby pošlete účetní s krátkou poznámkou." },
    ],
  },
  sources: [SOURCES.zoUcetnictvi, SOURCES.zdph, SOURCES.kdoMusi],
  related: ["kontaktni-platba", "storno-a-vraceni-eet", "eet-2-0-kompletni-pruvodce"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [{ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
