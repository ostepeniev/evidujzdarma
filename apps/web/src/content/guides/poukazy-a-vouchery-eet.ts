import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

/**
 * S12 (22. 11. 2026): poukazy a vouchery podle dotazu veřejnosti FS z 22. 10. 2026 (č. 5525, včetně příkladů masáže
 * a fitcentra) a rozhodnutí Ф11 (stravenka jiné firmy = běžná platba). Slevové kupony a poukazy jiných firem FS v odpovědi
 * neřeší → „zatím není jisté“. Revize Heleny Jeřábkové 22. 11. 2026 → indexovatelný a ve strojových kanálech (Ф8, Ф9).
 */
export const poukazyAVoucheryEet: Guide = {
  slug: "poukazy-a-vouchery-eet",
  category: "povinnosti",
  title: "Poukazy a dárkové vouchery v EET 2.0: kdy se evidují",
  h1: "Poukazy a dárkové vouchery v EET 2.0",
  description:
    "Dárkový poukaz na masáž, kredit ve fitku, stravenka: kdy se od 1. 1. 2027 eviduje prodej poukazu, kdy jeho čerpání a co z toho říká Finanční správa.",
  lead:
    "Od **1. 1. 2027** se poukaz na konkrétní zboží nebo službu eviduje jen při prodeji, pokud ho zákazník zaplatí na místě. Jeho uplatnění platbou není. U kreditu nebo poukazu, který lze čerpat jen u vás, se evidují obě operace: nabití i pozdější čerpání.",
  summary: [
    "Evidují se kontaktní platby – i když jsou spojené s poukazem, voucherem, žetonem, čipem nebo náramkem.",
    "Poukaz na konkrétní službu (např. masáž): eviduje se prodej, uplatnění ne.",
    "Kredit nebo poukaz čerpaný jen u vydavatele: eviduje se nabití i čerpání.",
    "Stravenka nebo poukázka vydaná jinou firmou je běžná evidovaná platba.",
  ],
  sections: [
    {
      id: "pravidlo",
      heading: "Základní pravidlo",
      blocks: [
        {
          p: "Finanční správa v odpovědi z 22. 10. 2026 připomíná, že evidenci podléhají kontaktní platby všemi běžnými způsoby – hotově i bezhotovostně. Patří mezi ně i platby spojené s kupony, vouchery, žetony, elektronickými peněženkami, čipovými kartami a náramky. Rozhoduje, **na co** poukaz zní.",
        },
        {
          table: {
            head: ["Situace", "Eviduje se?"],
            rows: [
              ["Prodej dárkového poukazu na masáž, zaplacený na místě", "**Ano** – při prodeji"],
              ["Uplatnění poukazu na masáž", "**Ne** – zákazník jen převezme předem zaplacenou službu"],
              ["Doplatek nad hodnotu poukazu, zaplacený na místě", "**Ano** – doplatek je běžná kontaktní platba"],
              ["Poukaz zaplacený přes platební bránu e-shopu", "**Ne** – vzdálená platba; uplatnění se neeviduje"],
              ["Nabití kreditu nebo čipu (čerpání jen u vás)", "**Ano** – s částkou určenou k čerpání"],
              ["Čerpání kreditu nebo čipu", "**Ano** – s částkou čerpání"],
              ["Platba stravenkou nebo poukázkou jiné firmy", "**Ano** – běžná platba"],
            ],
            caption: "Podle dotazu veřejnosti Finanční správy (22. 10. 2026) a prezentace MF a FS pro vývojáře. Stav k 22. 11. 2026.",
          },
        },
      ],
    },
    {
      id: "konkretni-sluzba",
      heading: "Poukaz na konkrétní zboží nebo službu",
      blocks: [
        {
          p: "Zaplatí-li zákazník předem za určitou službu nebo zboží a dostane k tomu poukaz, eviduje se jen tato platba – a jen tehdy, když proběhla kontaktně. Pozdější uplatnění poukazu se neeviduje, protože při něm žádná platba neprobíhá.",
        },
        {
          story: [
            { time: "Prosinec", title: "Dárkový poukaz na masáž za 1 000 Kč", text: "Zákazník ho koupí na recepci a zaplatí kartou. Evidujete 1 000 Kč." },
            { time: "Únor", title: "Obdarovaná přijde na masáž", text: "Uplatní poukaz. Nic se neeviduje – služba byla zaplacená v prosinci." },
          ],
        },
        { p: `${FACTS.evidenced.notEvidenced} Koupí-li zákazník poukaz na vašem e-shopu přes platební bránu, neeviduje se tedy ani prodej, ani pozdější uplatnění.` },
      ],
    },
    {
      id: "kredit",
      heading: "Kredit, čip a poukaz čerpaný jen u vás",
      blocks: [
        {
          p: "Jinak je to u poukazu, kterým lze platit jen v prostorách vydavatele, u úzce vymezeného okruhu dodavatelů nebo za úzce vymezené zboží či služby – typicky kredit na čipu ve fitcentru. Evidují se dvě operace, pokud proběhnou kontaktně: **nabití** a **čerpání**. Datová zpráva pak obsahuje i částku určenou k čerpání, resp. částku, která byla čerpáním uhrazena; obě se promítnou do celkové částky tržby.",
        },
        {
          stats: [
            { value: "1 050 Kč", label: "celková tržba při nabití čipu na 1 000 Kč a nápoji za 50 Kč", note: "z toho 1 000 Kč určeno k čerpání" },
            { value: "300 Kč", label: "celková tržba při pozdějším čerpání 300 Kč z čipu", note: "s částkou čerpání 300 Kč" },
          ],
        },
        { p: "Příklad je převzatý z odpovědi Finanční správy." },
      ],
    },
    {
      id: "nejasne",
      heading: "Co zatím není jisté",
      blocks: [
        {
          note: "Slevové kupony a poukazy, které vydala jiná firma než prodejce (kromě stravenek a poukázek jako platebního prostředku), Finanční správa v odpovědi výslovně neřeší. Zatím není jisté, jak je evidovat – ověřte si to s daňovým poradcem nebo přímo u Finanční správy.",
          tone: "warn",
        },
      ],
    },
    {
      id: "v-pokladne",
      heading: "Poukazy v pokladně EvidujZdarma",
      blocks: [
        {
          p: "Jak v pokladně prodat poukaz, nabít kredit a přijmout stravenku, popisuje [nápověda ke stravenkám, kreditu a dárkovým poukazům](/napoveda/poukazy-kredit-zalohy).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Eviduje se prodej dárkového poukazu?",
      a: "Ano, pokud ho zákazník zaplatí kontaktně – hotově, kartou nebo QR kódem na místě. Uplatnění poukazu na konkrétní službu nebo zboží se už neeviduje.",
    },
    {
      q: "Klientka uplatní poukaz za 1 000 Kč a 200 Kč doplatí. Co evidovat?",
      a: "Doplatek 200 Kč zaplacený na místě je běžná kontaktní platba a eviduje se. Uplatnění samotného poukazu platbou není.",
    },
    {
      q: "Eviduje se nabití kreditu ve fitku?",
      a: "Ano. U kreditu čerpaného jen u vás se eviduje nabití i čerpání, pokud proběhnou kontaktně; datová zpráva obsahuje částku určenou k čerpání, resp. částku čerpání.",
    },
    {
      q: "Zákazník platí stravenkou. Je to tržba?",
      a: "Ano. Platba stravenkou nebo poukázkou vydanou jinou firmou je běžná evidovaná platba.",
    },
    {
      q: "Jak evidovat slevový kupon?",
      a: "To zatím není jisté – Finanční správa slevové kupony v odpovědi neřeší. Poraďte se s daňovým poradcem.",
    },
  ],
  howTo: {
    name: "Jak naložit s poukazem od 1. 1. 2027",
    description: "Tři otázky podle odpovědi Finanční správy z 22. 10. 2026.",
    steps: [
      { name: "Zaplatil zákazník na místě?", text: "Evidují se jen kontaktní platby. Poukaz zaplacený přes platební bránu e-shopu se neeviduje." },
      { name: "Na co poukaz zní?", text: "Na konkrétní službu nebo zboží: evidujte jen prodej. Kredit čerpaný jen u vás: evidujte nabití i čerpání." },
      { name: "Doplácí zákazník?", text: "Doplatek zaplacený na místě evidujte jako běžnou platbu." },
    ],
  },
  sources: [SOURCES.fsDotazPoukazy, SOURCES.seminarVyvojari, SOURCES.kdoMusi, SOURCES.zakonUplne],
  related: ["kontaktni-platba", "eet-kadernictvi-kosmetika", "eet-2-0-v-prikladech", "eet-eshop-dobirka"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [
    // Revize Heleny Jeřábkové 22. 11. 2026
    { date: "2026-11-22", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-11-22", text: "Nový návod – koncept před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
