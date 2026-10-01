import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";

export const pokutyEet: Guide = {
  slug: "pokuty-eet",
  category: "povinnosti",
  title: "Pokuty za EET 2.0: až 500 000 Kč, ale bez zavírání",
  h1: "Pokuty za EET 2.0: co hrozí a jak se jim vyhnout",
  description:
    "Za neodeslání tržby nebo maření evidence hrozí v EET 2.0 pokuta až 500 000 Kč. Uzavření provozovny už nehrozí. Co se pokutuje, kdo kontroluje a jak se chránit.",
  lead: `Za neodeslání datové zprávy o tržbě nebo za závažné maření evidence hrozí v EET 2.0 pokuta až **${formatKc(FACTS.penalties.max)}**. Na rozdíl od staré EET už úřady nemohou zavřít provozovnu. Ostrý provoz začíná **1. 2. 2027**; leden je pilotní, kdy se Finanční správa chce soustředit na pomoc, ne na sankce.`,
  summary: [
    `Maximální pokuta za neodeslání tržby nebo závažné maření evidence: ${formatKc(FACTS.penalties.max)}.`,
    "Uzavření provozovny ani pozastavení činnosti jako sankce v EET 2.0 není.",
    "Pokuta za „nevydání účtenky“ podle zákona o evidenci tržeb nehrozí – účtenka povinná není.",
    "Leden 2027 je pilotní provoz; plná odpovědnost platí od 1. 2. 2027.",
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
            caption: "Stav k 1. 10. 2026 podle dostupných rozborů schváleného zákona. Přesné znění sankčních ustanovení ve Sbírce zákonů jsme zatím neověřili.",
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
      heading: "Leden 2027: pilotní provoz",
      blocks: [
        {
          p: "Zákon je účinný od **1. 1. 2027**, ale leden je podle Finanční správy **pilotní provoz**. Úřady se v tomto období chtějí soustředit hlavně na metodickou podporu a pomoc s nastavením pokladen. Plná povinnost evidovat začíná ostrým provozem **1. 2. 2027**.",
        },
        {
          note: "Zda je lednový pilot zakotven přímo v zákoně, nebo jde o správní praxi Finanční správy, jsme k 1. 10. 2026 nedokázali ověřit. Leden berte jako příležitost vše vyzkoušet, ne jako jistotu, že se nic nemůže stát.",
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
      a: "Leden 2027 je podle Finanční správy pilotní provoz zaměřený na pomoc podnikatelům; ostrý provoz začíná 1. 2. 2027. Doporučujeme v lednu evidovat nanečisto a odladit pokladnu.",
    },
  ],
  sources: [SOURCES.pokuty, SOURCES.podnikatelPrehled, SOURCES.podnikatelPilot, SOURCES.harmonogram, SOURCES.prakticke, SOURCES.srovnani],
  related: ["eet-bez-internetu", "musim-vydavat-uctenku", "eet-2-0-vs-eet-1-0"],
  published: "2026-10-01",
  updated: "2026-10-01",
  reviewedBy: null,
};
