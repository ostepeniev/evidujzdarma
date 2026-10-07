import { FACTS, SOURCES, formatKc, timelineAt } from "../facts";
import type { Guide } from "./types";

const DIS = timelineAt("2026-11-01");

export const eetTrhyStanky: Guide = {
  slug: "eet-trhy-stanky",
  category: "obory",
  title: "EET 2.0 na trzích a ve stáncích: co a jak evidovat",
  h1: "EET 2.0 na trzích a ve stáncích",
  description:
    "Stánek je v EET 2.0 mobilní provozovna. Jak od 1. 1. 2027 evidovat na trzích bez signálu, co s hotovostí, kartou a QR platbou a kdy je tržba ojedinělá.",
  lead:
    "Prodej na trzích a ve stáncích se od **1. 1. 2027** eviduje stejně jako v kamenném obchodě: hotovost, karta i QR platba přijatá u stánku. Stánek oznámíte v DIS+ jako **mobilní provozovnu**. Když na trhu není signál, prodáváte dál a tržbu odešlete **nejpozději do 48 hodin** od přijetí platby.",
  summary: [
    "Stánek, food truck nebo pojízdná prodejna je v DIS+ mobilní provozovna.",
    "Eviduje se hotovost, karta i QR platba přijatá u stánku.",
    "Bez signálu prodáváte dál – tržbu odešlete nejpozději do 48 hodin.",
    "Pevná hranice, pod kterou by se malý nebo sezónní prodej neevidoval, v zákoně není.",
    "Účtenku vydávat nemusíte, jen na žádost zákazníka.",
  ],
  sections: [
    {
      id: "stanek-jako-jednotka",
      heading: "Stánek jako evidenční jednotka",
      blocks: [
        { p: FACTS.units.summary },
        {
          p: `Stánek na trzích, food truck nebo pojízdná prodejna je v DIS+ **mobilní provozovna**. Jednotky oznamujete od **${DIS.dateLabel}**. ${FACTS.units.change}`,
        },
        {
          note: `${FACTS.units.allUnits} Máte-li obchod ve městě a k tomu stánek na trzích, oznamujete dvě jednotky – stálou a mobilní provozovnu.`,
          tone: "warn",
        },
        {
          p: "Zda stánek, se kterým jezdíte po různých trzích, stačí oznámit jako jednu mobilní provozovnu, Finanční správa zatím podrobně nepopsala. Řiďte se popisem jednotky v DIS+ a návod doplníme, jakmile to bude jasné.",
        },
      ],
    },
    {
      id: "bez-signalu",
      heading: "Trh bez signálu: pravidlo 48 hodin",
      blocks: [
        { p: FACTS.offline.summary },
        {
          ol: [
            "Prodávejte dál – přijetí platby výpadek neblokuje.",
            "Pokladna tržbu uloží v zařízení a zařadí ji do fronty k odeslání.",
            "Jakmile má zařízení signál, pokladna frontu odešle.",
            "Hlídejte lhůtu: nejpozději **48 hodin** od přijetí platby musí být tržba odeslaná.",
          ],
        },
        {
          ul: [
            "Po trhu otevřete pokladnu na místě se signálem, aby frontu odeslala – lhůta běží od přijetí platby, ne od konce trhu.",
            "Nemažte data aplikace ani ji neodinstalujte, dokud fronta neodeslaných tržeb není prázdná.",
            "Zda bude bez připojení fungovat státní MOJE eet, Finanční správa zatím nezveřejnila.",
          ],
        },
        { p: "Podrobnosti najdete v návodu [EET bez internetu: pravidlo 48 hodin](/navody/eet-bez-internetu)." },
      ],
    },
    {
      id: "platby",
      heading: "Hotovost, karta, QR: co se u stánku eviduje",
      blocks: [
        {
          table: {
            head: ["Situace u stánku", "Eviduje se?"],
            rows: [
              ["Zákazník platí hotově", "**Ano**"],
              ["Zákazník platí kartou do terminálu", "**Ano**"],
              ["Zákazník naskenuje QR kód u stánku a hned zaplatí z mobilu", "**Ano**"],
              ["Objednávka zaplacená předem převodem, u stánku ji zákazník jen vyzvedne", "Ne"],
              ["Objednávka, kterou zákazník zaplatí až při vyzvednutí u stánku", "**Ano**"],
            ],
            caption: "Rozhoduje, zda zákazník platí při osobním kontaktu s vámi nebo ve vaší provozovně, ne způsob platby.",
          },
        },
        {
          p: "Datová zpráva neobsahuje způsob platby, sazby DPH ani položky – jen celkovou částku, datum, evidenční jednotku a pořadové číslo. Hraniční případy rozebírá návod [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "sezonni-prodej",
      heading: "Sezónní a nárazový prodej",
      blocks: [
        {
          p: "Evidujete vždy, když na trhu přijímáte kontaktní platby – i když prodáváte jen několik víkendů v roce. Výjimkou jsou činnosti, které zákon vyjímá (např. prodej kaprů před Vánoci), a režim EET OFF. Pevnou hranici, pod kterou by se malý nebo sezónní prodej neevidoval, zákon nemá.",
        },
        { h3: "Ojedinělá tržba (§ 7)" },
        { p: FACTS.whoMust.occasional },
        { h3: "EET OFF pro malé paušalisty" },
        {
          p: `Fyzická osoba v ${FACTS.eetOff.band}. pásmu paušálního režimu s příjmy ze samostatné činnosti do ${formatKc(FACTS.eetOff.incomeLimit)} ročně může místo evidence platit přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně (${formatKc(FACTS.eetOff.surchargeYearly)} ročně). ${FACTS.eetOff.binding} Oznámení pro rok 2027 podáte do **${FACTS.eetOff.deadline}**.`,
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "sdileny-stanek",
      heading: "Sdílený stánek a zboží jiného podnikatele",
      blocks: [
        {
          p: "Prodáváte-li u stánku i zboží jiného podnikatele, nebo stánek sdílíte, může jeden z vás evidovat tržbu za druhého na základě pověření. Jak to funguje, popisuje návod [Tržba za jiného v EET 2.0: pověření v praxi](/navody/trzba-za-jineho).",
        },
      ],
    },
    {
      id: "doklad",
      heading: "Účtenka u stánku",
      blocks: [{ p: FACTS.receipt.summary }, { cta: "registrace" }],
    },
  ],
  faq: [
    {
      q: "Musím evidovat, když prodávám jen na pár trzích za rok?",
      a: `Ano, pokud na nich přijímáte kontaktní platby v rámci podnikání. ${FACTS.whoMust.occasional}`,
    },
    {
      q: "Co když na trhu celý den není signál?",
      a: `${FACTS.offline.summary} Lhůta běží od přijetí platby, proto pokladnu po trhu co nejdřív otevřete na místě se signálem.`,
    },
    { q: "Musím u stánku vydávat účtenky?", a: FACTS.receipt.summary },
    {
      q: "Stačí mi jedna evidenční jednotka pro obchod i stánek?",
      a: `Ne. Obchod je stálá provozovna, stánek mobilní provozovna – oznamujete obě. ${FACTS.units.allUnits}`,
    },
    {
      q: "Eviduje se platba kartou nebo QR kódem u stánku?",
      a: "Ano. Karta i QR platba, kterou zákazník zaplatí přímo u stánku, jsou kontaktní platby a evidují se stejně jako hotovost.",
    },
  ],
  howTo: {
    name: "Jak se připravit na prodej na trzích v EET 2.0",
    description: "Od oznámení stánku v DIS+ po prodej bez signálu.",
    steps: [
      { name: "Oznamte stánek", text: `Od ${DIS.dateLabel} se v DIS+ přihlaste k evidenci tržeb a stánek oznamte jako mobilní provozovnu.` },
      { name: "Vygenerujte pokladní certifikát", text: "Pokladní certifikát si zdarma vygenerujete v DIS+ a nahrajete ho do pokladny v mobilu nebo tabletu." },
      { name: "Vyzkoušejte prodej bez signálu", text: "Ještě před sezónou si v pokladně vyzkoušejte prodej v režimu Letadlo a odeslání fronty po návratu signálu." },
      { name: "Na trhu evidujte", text: "Od 1. 1. 2027 evidujte každou hotovostní, kartovou i QR platbu přijatou u stánku." },
      { name: "Odešlete frontu do 48 hodin", text: "Po trhu otevřete pokladnu na místě se signálem; neodeslané tržby musí odejít nejpozději do 48 hodin od přijetí platby." },
    ],
  },
  sources: [
    SOURCES.jakZacit,
    SOURCES.harmonogram,
    SOURCES.prakticke,
    SOURCES.fsFaq,
    SOURCES.kdoMusi,
    SOURCES.mfPredstavuje,
    SOURCES.vyvojari,
    SOURCES.podnikatelDetail,
    SOURCES.psp,
    SOURCES.eetOff,
    SOURCES.eetOffJak,
    SOURCES.mojeEet,
    SOURCES.prezident,
    SOURCES.zos,
  ],
  related: ["eet-bez-internetu", "evidencni-jednotka", "eet-off", "trzba-za-jineho"],
  published: "2026-10-07",
  updated: "2026-10-07",
  changelog: [{ date: "2026-10-07", text: "Koncept návodu – před odbornou revizí." }],
  reviewedBy: null,
};
