import { FACTS, SOURCES, timelineAt } from "../facts";
import type { Guide } from "./types";

const DIS = timelineAt("2026-11-01");

export const eetEshopDobirka: Guide = {
  slug: "eet-eshop-dobirka",
  category: "obory",
  title: "EET 2.0 a e-shop: dobírka, osobní odběr a karta",
  h1: "EET 2.0 a e-shop: dobírka, osobní odběr a platba kartou",
  description:
    "Platby přes platební bránu a převodem se v EET 2.0 neevidují. Co od 1. 1. 2027 platí pro osobní odběr, platbu kartou při převzetí a pro dobírku přes dopravce.",
  lead:
    "Platby, které zákazník e-shopu pošle **na dálku** – přes platební bránu, převodem nebo QR kódem z webu – se v EET 2.0 neevidují. Od **1. 1. 2027** evidujete jen to, co zákazník zaplatí osobně, typicky při osobním odběru na prodejně nebo výdejním místě. U dobírky vybrané dopravcem zatím není jisté, jak ji Finanční správa posoudí.",
  summary: [
    "Platební brána, převod předem a QR kód zaplacený z domova se neevidují.",
    "Platba hotově, kartou nebo QR kódem při osobním odběru se eviduje.",
    "Zboží zaplacené předem, které si zákazník jen vyzvedne, se neeviduje.",
    "U dobírky přes dopravce zatím není jisté, jak ji Finanční správa posoudí.",
    "E-shop, který přijímá jen platby na dálku, evidovat nemusí.",
  ],
  sections: [
    {
      id: "co-se-eviduje",
      heading: "Co se u e-shopu eviduje a co ne",
      blocks: [
        { p: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced}` },
        {
          table: {
            head: ["Způsob platby", "Eviduje se?"],
            rows: [
              ["Platební brána na webu", "Ne"],
              ["Bankovní převod předem, i QR kódem z webu nebo z e-mailu", "Ne"],
              ["Zaplaceno předem, zákazník si zboží jen vyzvedne", "Ne"],
              ["Platba hotově, kartou nebo QR kódem při osobním odběru u vás", "**Ano**"],
              ["Vlastní rozvoz: zákazník zaplatí vašemu řidiči hotově nebo kartou", "**Ano**"],
              ["Dobírka vybraná dopravcem", "Zatím není jisté"],
            ],
            caption: "Rozhoduje, zda zákazník platí při osobním kontaktu s vámi, ne kde si zboží objednal.",
          },
        },
      ],
    },
    {
      id: "osobni-odber",
      heading: "Osobní odběr a platba kartou při převzetí",
      blocks: [
        {
          p: "Kdo zaplatí přes platební bránu nebo převodem a na prodejně si zboží jen vyzvedne, zaplatil na dálku – platbu neevidujete. Kdo platí až při vyzvednutí – hotově, kartou nebo QR kódem u pokladny –, platí osobně a tržbu evidujete.",
        },
        { h3: "Platba kartou" },
        {
          p: "Platba kartou do terminálu při osobním odběru nebo při doručení vlastním řidičem je kontaktní platba a eviduje se. Stará EET platby kartou evidovala jen do roku 2018, kdy tuto povinnost zrušil Ústavní soud; EET 2.0 je do evidence vrací.",
        },
        { h3: "Část předem, doplatek při převzetí" },
        {
          p: "Část ceny zaplacená předem převodem nebo přes bránu je platba na dálku a neeviduje se. Doplatek, který zákazník zaplatí při převzetí u vás, je běžná kontaktní platba a eviduje se.",
        },
      ],
    },
    {
      id: "dobirka",
      heading: "Dobírka: zatím není jisté",
      blocks: [
        {
          p: "U dobírky zákazník platí při převzetí zásilky dopravci – kurýrovi, na poště nebo na výdejním místě dopravce – a vy dostanete peníze později převodem od dopravce. Podle výkladů, které jsou zatím k dispozici, se taková platba neeviduje: zákazník neplatí při osobním kontaktu s vámi a k vám peníze přijdou převodem.",
        },
        {
          note: "Finanční správa dobírku zatím výslovně nevysvětlila, proto **zatím není jisté**, jak ji posoudí. Návod doplníme, jakmile bude oficiální odpověď. Do té doby sledujte eet.gov.cz.",
          tone: "warn",
        },
        {
          p: "Jinak je to u vlastního rozvozu: když zboží doveze váš zaměstnanec a zákazník mu zaplatí, jde o platbu při osobním kontaktu s vámi a evidujete ji.",
        },
      ],
    },
    {
      id: "evidencni-jednotky",
      heading: "Evidenční jednotky e-shopu",
      blocks: [
        {
          p: `${FACTS.whoMust.summary} E-shop, který přijímá jen platby na dálku, proto evidovat nemusí.`,
        },
        {
          p: `Přijímáte-li i osobní platby – na prodejně, na výdejním místě nebo při vlastním rozvozu –, oznamujete v DIS+ od **${DIS.dateLabel}** evidenční jednotky. ${FACTS.units.allUnits} K typům jednotek patří i internetová stránka.`,
        },
        { p: "Jak jednotky založit a kolik jich potřebujete, popisuje návod [Evidenční jednotka v EET 2.0: co to je a jak ji oznámit](/navody/evidencni-jednotka)." },
        { cta: "jednotky" },
      ],
    },
  ],
  faq: [
    { q: "Eviduje se platba přes platební bránu?", a: "Ne. Platba přes platební bránu e-shopu je vzdálená platba a v EET 2.0 se neeviduje." },
    {
      q: "Eviduje se QR platba z potvrzení objednávky?",
      a: "Ne, pokud ji zákazník zaplatí na dálku, například z domova. Eviduje se QR platba, kterou zákazník zaplatí přímo u vás – na prodejně nebo při osobním odběru.",
    },
    {
      q: "Zákazník zaplatil předem a zboží si vyzvedne na prodejně. Eviduji?",
      a: "Ne. Platba proběhla na dálku předem; samotné vyzvednutí zboží platbou není.",
    },
    {
      q: "Musím evidovat dobírku?",
      a: "Zatím není jisté. Podle výkladů, které jsou k dispozici, se dobírka vybraná dopravcem neeviduje, protože peníze přijdou převodem od dopravce. Finanční správa to ale zatím výslovně nepotvrdila.",
    },
    {
      q: "Potřebuje e-shop pokladnu?",
      a: "Jen pokud přijímá osobní platby – na prodejně, na výdejním místě nebo při vlastním rozvozu. E-shop jen s platbami na dálku evidovat nemusí.",
    },
  ],
  howTo: {
    name: "Jak nastavit evidenci tržeb u e-shopu",
    description: "Rozdělte platby na vzdálené a osobní a evidujte jen ty osobní.",
    steps: [
      { name: "Projděte způsoby platby", text: "Rozdělte je na platby na dálku (brána, převod, QR z webu) a platby při osobním kontaktu (osobní odběr, vlastní rozvoz)." },
      { name: "Bez osobních plateb nic neevidujete", text: "E-shop, který přijímá jen platby na dálku, evidovat nemusí." },
      { name: "Přihlaste se v DIS+", text: `Máte-li osobní platby, od ${DIS.dateLabel} se v DIS+ přihlaste k evidenci tržeb a oznamte všechny evidenční jednotky.` },
      { name: "Připravte pokladnu", text: "Vydejte si pokladní certifikát a nastavte pokladnu na prodejně, na výdejním místě nebo u řidiče." },
      { name: "Evidujte osobní platby", text: "Od 1. 1. 2027 evidujte každou platbu přijatou při osobním odběru nebo při doručení vlastním rozvozem." },
    ],
  },
  sources: [
    SOURCES.kdoMusi,
    SOURCES.mfPredstavuje,
    SOURCES.danovkyKontaktni,
    SOURCES.srovnani,
    SOURCES.podnikatelDetail,
    SOURCES.jakZacit,
    SOURCES.harmonogram,
    SOURCES.usoudEet,
    SOURCES.seminarVyvojari,
    SOURCES.psp,
  ],
  related: ["kontaktni-platba", "evidencni-jednotka", "koho-se-eet-tyka"],
  published: "2026-10-07",
  updated: "2026-10-07",
  changelog: [{ date: "2026-10-07", text: "Koncept návodu – před odbornou revizí." }],
  reviewedBy: null,
};
