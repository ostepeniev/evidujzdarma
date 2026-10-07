import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const eetBezInternetu: Guide = {
  slug: "eet-bez-internetu",
  category: "prakticke",
  title: "EET bez internetu: pravidlo 48 hodin v EET 2.0",
  h1: "Co dělat bez internetu: pravidlo 48 hodin",
  description:
    "Výpadek signálu neznamená konec prodeje. Jak v EET 2.0 funguje dodatečné odeslání tržby do 48 hodin, co je POK a na co si dát pozor při práci offline.",
  lead:
    "Když vypadne internet, můžete v EET 2.0 dál prodávat. Tržbu je třeba odeslat bez zbytečného odkladu, **nejpozději do 48 hodin** od přijetí platby. Pokladna zprávu opakuje, dokud Finanční správa nevrátí potvrzovací kód (POK). Pravidlo platí od začátku evidence **1. 1. 2027**.",
  summary: [
    "Datová zpráva se běžně odesílá nejpozději v okamžiku přijetí platby.",
    "Při výpadku spojení lze prodávat dál a tržbu odeslat dodatečně, nejpozději do 48 hodin.",
    "Pokladna zprávu opakuje, dokud nedostane potvrzovací kód (POK).",
    "EET 2.0 neukládá povinnost vydat účtenku – výpadek tedy neřešíte papírovým kódem na dokladu.",
  ],
  sections: [
    {
      id: "jak-to-funguje",
      heading: "Jak funguje odeslání tržby",
      blocks: [
        {
          p: "Každou evidovanou tržbu – platbu přijatou osobně hotově, kartou nebo QR kódem – pokladna odešle Finanční správě jako datovou zprávu. Finanční správa ji přijme a vrátí **potvrzovací kód (POK)**. Tím je tržba zaevidovaná.",
        },
        { p: FACTS.offline.summary },
        { h3: "Jak dlouho pokladna čeká na odpověď" },
        { p: FACTS.offline.responseTimeout },
      ],
    },
    {
      id: "vypadek",
      heading: "Co dělat při výpadku signálu",
      blocks: [
        {
          ol: [
            "Prodávejte dál – přijetí platby výpadek neblokuje.",
            "Pokladna tržbu uloží v zařízení a zařadí ji do fronty k odeslání.",
            "Jakmile je spojení zpět, pokladna tržbu odešle znovu – s příznakem, že nejde o první zaslání.",
            "Hlídejte lhůtu: nejpozději **48 hodin** od přijetí platby musí být tržba odeslána.",
          ],
        },
        {
          note: "Pokladna EvidujZdarma ukazuje u každé neodeslané tržby, kolik času do konce lhůty zbývá, a upozorní vás dřív, než lhůta vyprší.",
        },
      ],
    },
    {
      id: "na-co-pozor",
      heading: "Na co si dát pozor",
      blocks: [
        {
          ul: [
            "**Nemažte data prohlížeče ani neodinstalujte aplikaci, dokud fronta neodeslaných tržeb není prázdná** – tržby čekají v paměti zařízení.",
            "**Dlouhý výpadek** (například na horách nebo na trhu bez signálu): po návratu na místo se signálem otevřete pokladnu, aby frontu odeslala.",
            "**Opakované odeslání nevytváří novou tržbu** – pokladna posílá stejnou tržbu (stejné pořadové číslo, datum a částku), dokud nedostane POK. Tržby, ke kterým POK už přišel, se znovu neposílají.",
          ],
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Musím při výpadku vydat zákazníkovi účtenku?",
      a: FACTS.receipt.summary,
    },
    {
      q: "Co když se tržbu do 48 hodin nepodaří odeslat?",
      a: `Neodeslání datové zprávy je porušení povinnosti, za které hrozí pokuta. ${FACTS.penalties.summary} Proto pokladna upozorňuje s předstihem.`,
    },
    {
      q: "Jak dlouho má pokladna čekat na odpověď Finanční správy?",
      a: FACTS.offline.responseTimeout,
    },
    {
      q: "Funguje státní aplikace MOJE eet bez signálu?",
      a: "Finanční správa zatím nezveřejnila, zda MOJE eet bude fungovat bez připojení; podle dostupných informací ([Podnikatel.cz](https://www.podnikatel.cz/clanky/jak-bude-fungovat-aplikace-zdarma-moje-eet-zjistili-jsme-detaily-od-financni-spravy/)) připojení vyžaduje. Pokladna EvidujZdarma tržby bez signálu ukládá a odešle je automaticky později.",
    },
  ],
  sources: [SOURCES.prakticke, SOURCES.fsFaq, SOURCES.prezident, SOURCES.pokuty, SOURCES.mojeEet],
  related: ["eet-2-0-kompletni-pruvodce", "evidencni-jednotka", "pokuty-eet"],
  published: "2026-10-01",
  updated: "2026-10-02",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: pravidlo 48 hodin platí od 1. 1. 2027, ne až od 1. 2. 2027. Doplněno, jak dlouho pokladna čeká na odpověď a které tržby se posílají znovu.",
    },
  ],
  reviewedBy: REVIEWER.name,
};
