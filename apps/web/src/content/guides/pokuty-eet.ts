import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const pokutyEet: Guide = {
  slug: "pokuty-eet",
  category: "povinnosti",
  title: "Pokuty za EET 2.0: až 500 000 Kč, ale bez zavírání",
  h1: "Pokuty za EET 2.0: co hrozí a jak se jim vyhnout",
  description:
    "Za neodeslání tržby nebo maření evidence hrozí v EET 2.0 pokuta až 500 000 Kč. Uzavření provozovny už nehrozí. Co se pokutuje, kdo kontroluje a jak se chránit.",
  lead: `Za neodeslání datové zprávy o tržbě nebo za závažné maření evidence hrozí v EET 2.0 pokuta až **${formatKc(FACTS.penalties.max)}**. Na rozdíl od staré EET už úřady nemohou zavřít provozovnu. Pokuta platí od účinnosti zákona **1. 1. 2027** – zákon žádnou výjimku pro leden nestanoví.`,
  summary: [
    `Maximální pokuta za neodeslání tržby nebo závažné maření evidence: ${formatKc(FACTS.penalties.max)}.`,
    "Uzavření provozovny ani pozastavení činnosti jako sankce v EET 2.0 není.",
    "Pokuta za „nevydání účtenky“ podle zákona o evidenci tržeb nehrozí – účtenka povinná není.",
    "Povinnost evidovat i pokuta platí od 1. 1. 2027. Zda bude Finanční správa v lednu pokutovat, oficiálně stanoveno není.",
    "Výše pokuty je horní hranice – konkrétní částku určuje úřad podle závažnosti.",
  ],
  sections: [
    {
      id: "za-co",
      heading: "Za co hrozí pokuta",
      blocks: [
        { p: FACTS.penalties.summary },
        {
          table: {
            head: ["Porušení", "Maximální sankce", "Poznámka"],
            rows: [
              ["Neodeslání datové zprávy o evidované tržbě", formatKc(FACTS.penalties.max), "Včetně nedodržení lhůty 48 hodin při výpadku spojení."],
              ["Závažné úmyslné ztížení nebo zmaření evidence", formatKc(FACTS.penalties.max), "Např. soustavné neevidování, manipulace s údaji."],
              ["Nesplnění oznamovacích povinností (evidenční jednotky)", "Obecná pokuta podle daňového řádu", "Podle rozborů zákona se neřeší zvláštní sankcí EET."],
              ["Nevydání účtenky", "Podle zákona o EET nic", "Účtenka není povinná; doklad na žádost ale ukládá zákon o ochraně spotřebitele."],
            ],
            caption: `Stav k 1. 10. 2026 podle schváleného znění zákona (${FACTS.law.printNo}, ${FACTS.law.sections.penalty}) a dostupných rozborů. Číslo zákona ve Sbírce zákonů zatím nebylo zveřejněno.`,
          },
        },
        {
          note: "Částka 500 000 Kč je horní hranice pro nejzávažnější případy, ne sazebník. Konkrétní výši pokuty určuje správce daně podle okolností – závažnosti, opakování a toho, zda šlo o úmysl.",
        },
        {
          note: "Některé weby uvádějí i stupeň „až 50 000 Kč“ za méně závažná porušení. V dostupných rozborech schváleného zákona jsme ho nenašli – zatím ho proto neuvádíme jako fakt. Jakmile Finanční správa zveřejní metodiku, návod doplníme.",
          tone: "warn",
        },
      ],
    },
    {
      id: "co-se-zmenilo",
      heading: "Co se změnilo oproti staré EET",
      blocks: [
        {
          table: {
            head: ["", "Stará EET (2016–2020)", "EET 2.0 (od 2027)"],
            rows: [
              ["Maximální pokuta", "500 000 Kč", "500 000 Kč"],
              ["Uzavření provozovny / pozastavení činnosti", "Ano, bylo možné", "Ne"],
              ["Sankce za nevydání účtenky", "Ano", "Ne (účtenka není povinná)"],
              ["Informační oznámení v provozovně", "Povinné", "Podle rozborů zákona odpadá"],
            ],
          },
        },
        {
          p: "Podrobné srovnání obou systémů najdete v článku [EET 2.0 vs stará EET](/navody/eet-2-0-vs-eet-1-0).",
        },
      ],
    },
    {
      id: "kontroly",
      heading: "Kdo kontroluje a jak",
      blocks: [
        {
          p: "Evidenci tržeb spravuje Finanční správa. Podle rozborů zákona může kontrolovat a pokutovat na místě i Celní správa. Protože tržby chodí online, má Finanční správa přehled o tom, kdy a kolik která evidenční jednotka eviduje, a data může využít k cíleným kontrolám.",
        },
        {
          p: "Kontrolní nákup zůstává možný, ale podle dostupných informací by neměl být standardem – kontroloři ho mají využívat, když je k tomu důvod.",
        },
      ],
    },
    {
      id: "pilot",
      heading: "Leden 2027: „pilotní“ měsíc není zákonná výjimka",
      blocks: [
        { p: FACTS.pilot.summary },
        {
          p: `Zákon je účinný od **${FACTS.law.effectiveFrom}** (${FACTS.law.sections.effect}) a pokuta až ${formatKc(FACTS.penalties.max)} (${FACTS.law.sections.penalty}) se vztahuje na tržby od tohoto dne. Lednové označení „pilotní“ je pojem z harmonogramu Finanční správy, ne zákonná výjimka.`,
        },
        {
          note: "Pokladnu si vyzkoušejte v prosinci 2026 – certifikát získáte v DIS+ od 1. 11. 2026 a v testovacím režimu pokladny nebo na Playgroundu Finanční správy ověříte, že tržby odcházejí a vrací se POK. Od 1. 1. 2027 už evidujte naostro.",
          tone: "warn",
        },
      ],
    },
    {
      id: "jak-se-chranit",
      heading: "Jak se pokutám vyhnout",
      blocks: [
        {
          ol: [
            "**Ujasněte si, co evidovat.** Hotovost, karta i QR kód na místě ano, převod na fakturu ne – viz [Kontaktní platba](/navody/kontaktni-platba).",
            "**Včas se přihlaste v DIS+** (od 1. 11. 2026), založte evidenční jednotky a vygenerujte certifikát – [postup](/navody/jak-aktivovat-dis-a-certifikat).",
            "**Hlídejte frontu neodeslaných tržeb.** Při výpadku signálu máte na odeslání nejvýše 48 hodin – [jak na to](/navody/eet-bez-internetu).",
            "**Hlídejte platnost certifikátu** (366 dní) – s propadlým certifikátem pokladna tržby neodešle.",
            "**Oznamujte změny jednotek** do 15 dnů, nejpozději před první tržbou po změně.",
            "**Zvažte EET OFF**, pokud splňujete podmínky a evidovat nechcete vůbec – [vyplatí se?](/navody/eet-off)",
          ],
        },
        {
          p: "Pokladna EvidujZdarma tržby bez signálu ukládá, odesílá je automaticky, jakmile je spojení zpět, a u každé neodeslané tržby ukazuje, kolik času do konce lhůty zbývá.",
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Jaká je nejvyšší pokuta za EET 2.0?",
      a: `Až ${formatKc(FACTS.penalties.max)} za neodeslání datové zprávy o tržbě nebo za závažné maření evidence. Jde o horní hranici; konkrétní výši určuje úřad podle závažnosti.`,
    },
    {
      q: "Můžou mi kvůli EET zavřít provozovnu?",
      a: "Ne. Uzavření provozovny nebo pozastavení činnosti, které umožňovala první EET, zákon o EET 2.0 nezná.",
    },
    {
      q: "Hrozí pokuta, když zákazníkovi nedám účtenku?",
      a: "Podle zákona o evidenci tržeb ne, účtenka v EET 2.0 povinná není. Na žádost spotřebitele ale musíte vydat doklad podle zákona o ochraně spotřebitele – viz [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku).",
    },
    {
      q: "Co když mi vypadne internet?",
      a: "Prodávejte dál a tržbu odešlete dodatečně bez zbytečného odkladu, nejpozději do 48 hodin od přijetí platby. Neodeslání v této lhůtě už je porušením povinnosti.",
    },
    {
      q: "Kdo může EET kontrolovat?",
      a: "Evidenci spravuje Finanční správa. Podle rozborů zákona může kontrolovat a pokutovat na místě i Celní správa. Kontrolní nákup je možný, ale neměl by být standardem.",
    },
    {
      q: "Hrozí pokuta, když zapomenu oznámit novou provozovnu?",
      a: "Podle rozborů zákona se nesplnění oznamovacích povinností neřeší zvláštní sankcí EET, ale obecnou pokutou podle daňového řádu. Změny proto oznamujte včas – před první tržbou po změně, nejpozději do 15 dnů.",
    },
    {
      q: "Dostanu pokutu v lednu 2027?",
      a: `Může. Zákon je účinný od 1. 1. 2027 a výjimku pro leden nestanoví, pokuta až ${formatKc(FACTS.penalties.max)} tedy platí od prvního dne. Finanční správa v lednu počítá s pilotním režimem a chce se zaměřit na metodickou podporu; jak bude postupovat při kontrolách, oficiálně stanoveno není. Evidujte od 1. 1. 2027 a pokladnu si odlaďte už v prosinci.`,
    },
  ],
  sources: [SOURCES.pokuty, SOURCES.psp, SOURCES.podnikatelPrehled, SOURCES.harmonogram, SOURCES.prakticke, SOURCES.fsPlayground, SOURCES.srovnani],
  related: ["eet-bez-internetu", "musim-vydavat-uctenku", "eet-2-0-vs-eet-1-0"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: povinnost evidovat i pokuta až 500 000 Kč platí od 1. 1. 2027, tedy i v lednu; test pokladny doporučujeme v prosinci 2026.",
    },
  ],
  reviewedBy: REVIEWER.name,
};
