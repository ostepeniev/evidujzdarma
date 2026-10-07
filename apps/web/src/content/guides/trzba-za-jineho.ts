import { SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const trzbaZaJineho: Guide = {
  slug: "trzba-za-jineho",
  category: "povinnosti",
  title: "Tržba za jiného v EET 2.0: pověření v praxi",
  h1: "Tržba za jiného (pověření): masér v hotelu, prodej v cizím obchodě",
  description:
    "Hotel vybírá za maséra, obchod prodává zboží výrobce, stánek sdílí dva podnikatelé. Jak v EET 2.0 od 1. 1. 2027 funguje evidence tržby za jiného (pověření).",
  lead:
    "EET 2.0 umožňuje, aby tržbu evidoval jiný podnikatel než ten, komu patří – na základě **pověření**. Typicky hotel, který na recepci inkasuje za externího maséra. Pověřený pak eviduje a datová zpráva od **1. 1. 2027** nese identifikaci obou podnikatelů. Často je ale jednodušší jiné uspořádání: každý eviduje sám, nebo hotel službu přeprodá.",
  summary: [
    "Poplatník, jemuž tržba plyne, může evidencí pověřit jiného poplatníka.",
    "Pověřený eviduje tržbu za pověřujícího; datová zpráva obsahuje identifikaci obou.",
    "Pověřujícího to podle rozborů zákona nezbavuje odpovědnosti za to, že jeho tržba bude zaevidována.",
    "Alternativy: každý eviduje vlastní tržby sám, nebo jeden podnikatel službu či zboží přeprodává jako svou tržbu.",
  ],
  sections: [
    {
      id: "o-co-jde",
      heading: "O co jde",
      blocks: [
        {
          p: "V praxi často peníze od zákazníka nepřebírá ten, komu tržba patří. Host zaplatí masáž na recepci hotelu, zákazník koupí med místního včelaře v cizím obchodě, dva podnikatelé sdílejí jeden stánek a jednu kasu. EET 2.0 pro tyto situace nabízí institut **pověření**: poplatník, kterému tržba plyne, pověří jiného poplatníka, aby ji za něj evidoval.",
        },
        {
          p: "Pověřený podle rozborů zákona fakticky jedná za pověřujícího: tržbu eviduje, plní za něj v rozsahu pověření i další povinnosti podle zákona o evidenci tržeb a odpovídá za jejich porušení. Pověřující se ale odpovědnosti za evidenci své tržby úplně nezbavuje – pokud tržba zaevidována není, může to dopadnout i na něj.",
        },
        {
          note: "Přesné znění ustanovení o pověření ve Sbírce zákonů jsme k 1. 10. 2026 neověřili a Finanční správa k němu zatím nevydala podrobnou metodiku pro podnikatele. Než pověření nastavíte, poraďte se s daňovým poradcem.",
          tone: "warn",
        },
      ],
    },
    {
      id: "datova-zprava",
      heading: "Co se mění v datové zprávě",
      blocks: [
        {
          p: "Zpráva odeslaná v pověření musí obsahovat identifikaci pověřujícího poplatníka – technická dokumentace EET 2.0 pro to má pole **eic_poverujiciho**. Bez těchto údajů by evidence nebyla platná. Dokumentace obsahuje i příznak **povereni_vice_popl** pro situace s pověřením od více poplatníků; jeho praktické použití zatím Finanční správa pro podnikatele nevysvětlila.",
        },
        {
          p: "Pro pokladnu to znamená, že musí umět u konkrétní tržby zvolit, za koho se eviduje. Než pověření začnete používat, ověřte si u dodavatele pokladny, že tuto funkci podporuje.",
        },
      ],
    },
    {
      id: "tri-modely",
      heading: "Tři způsoby, jak spolupráci nastavit",
      blocks: [
        {
          table: {
            head: ["Model", "Kdo eviduje", "Kdy se hodí"],
            rows: [
              ["**A. Každý sám**", "Každý podnikatel eviduje svou tržbu ve své pokladně", "Masér si bere platby sám (kartou nebo hotově u lehátka)."],
              ["**B. Přeprodej**", "Hotel nebo obchod eviduje celou částku jako svou tržbu; partner mu fakturuje", "Hotel prodává masáž jako vlastní službu, obchod zboží výrobce nakupuje."],
              ["**C. Pověření**", "Hotel nebo obchod eviduje tržbu za partnera, zpráva nese identifikaci obou", "Recepce vybírá peníze za externího maséra, ale tržba patří masérovi."],
            ],
          },
        },
        {
          p: "Model A je nejjednodušší a nevyžaduje žádnou dohodu. Model B mění obchodní vztah – tržba patří hotelu nebo obchodu a partner (masér, výrobce) jim vystaví fakturu, kterou dostane zaplacenou převodem (ta se neeviduje). Model C zachovává tržbu partnerovi, ale vyžaduje dohodu, pokladnu s podporou pověření a důvěru mezi oběma stranami.",
        },
      ],
    },
    {
      id: "priklady",
      heading: "Příklady z praxe",
      blocks: [
        { h3: "Masér v hotelu" },
        {
          p: "Masér je OSVČ a v hotelu má pronajatou místnost. Pokud mu klienti platí přímo, eviduje sám (model A) – jako evidenční jednotku uvede provozovnu, nebo sám sebe. Pokud hosté platí masáž na recepci spolu s ubytováním, může hotel tržbu evidovat v pověření (model C), nebo masáž prodávat jako vlastní službu a masérovi platit na fakturu (model B).",
        },
        { h3: "Výrobce prodává v cizím obchodě" },
        {
          p: "Včelař dodává med do obchodu se smíšeným zbožím. Když obchod med odkoupí a prodává dál, jde o běžnou tržbu obchodu. Když ho prodává na účet včelaře (komisní prodej), jde o tzv. nepřímé zastoupení nebo pověření a postup je potřeba nastavit se znalostí zákona – podle rozborů zákon s nepřímým zastoupením počítá jako se samostatnou situací.",
        },
        { h3: "Sdílený stánek nebo salon" },
        {
          p: "Dvě kadeřnice sdílejí salon a jeden terminál. Nejčistší je, když má každá vlastní pokladnu a eviduje své tržby. Pokud chtějí jednu kasu, jedna může evidovat za druhou v pověření – v pokladně pak u každé tržby musí být jasné, komu patří. Více v návodu [EET pro kadeřnictví a kosmetiku](/navody/eet-kadernictvi-kosmetika).",
        },
        { cta: "registrace" },
      ],
    },
    {
      id: "doporuceni",
      heading: "Doporučení před spuštěním",
      blocks: [
        {
          ol: [
            "Rozhodněte, který model (A, B, nebo C) vám dává smysl – nejjednodušší bývá A.",
            "Při pověření si dohodu sepište: kdo eviduje, za jaké tržby, odkdy a jak si budete předávat peníze a přehledy.",
            "Ověřte, že pokladna pověřeného umí evidovat tržby za jiného poplatníka.",
            "Ujasněte si, kdo oznamuje evidenční jednotky a jak – Finanční správa k tomu zatím nevydala podrobnou metodiku.",
            "Pravidelně si porovnávejte přehledy tržeb – pověřující se odpovědnosti za evidenci své tržby nezbavuje.",
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Může za mě tržby evidovat někdo jiný?",
      a: "Ano. EET 2.0 umožňuje pověřit evidencí tržby jiného poplatníka. Ten tržbu eviduje za vás a datová zpráva obsahuje identifikaci vás obou.",
    },
    {
      q: "Kdo odpovídá, když pověřený tržbu nezaeviduje?",
      a: "Pověřený odpovídá za povinnosti, které v rozsahu pověření plní. Podle rozborů zákona se ale pověřující nezbavuje odpovědnosti za to, že jeho tržba bude zaevidována. Proto si přehledy tržeb pravidelně kontrolujte.",
    },
    {
      q: "Musí být pověření písemné?",
      a: "Formální náležitosti pověření Finanční správa zatím podrobně nepopsala. Doporučujeme dohodu sepsat – kvůli jasnému rozsahu i případné kontrole.",
    },
    {
      q: "Hotel vybírá peníze za maséra. Je to jeho tržba, nebo masérova?",
      a: "Záleží na tom, jak máte vztah nastavený. Pokud hotel prodává masáž jako vlastní službu, je to tržba hotelu. Pokud vybírá peníze za maséra, je to masérova tržba, kterou může hotel evidovat v pověření.",
    },
  ],
  sources: [SOURCES.vyvojari, SOURCES.podnikatelDetail, SOURCES.podnikatelPrehled, SOURCES.kdoMusi],
  related: ["koho-se-eet-tyka", "evidencni-jednotka", "eet-kadernictvi-kosmetika"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-01", text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, ne od 1. 2. 2027." },
  ],
  reviewedBy: REVIEWER.name,
};
