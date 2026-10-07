import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const eetUbytovani: Guide = {
  slug: "eet-ubytovani",
  category: "obory",
  title: "EET 2.0 u ubytování: zálohy, kauce, poplatek z pobytu",
  h1: "EET u ubytování: zálohy, kauce a městský poplatek",
  description:
    "Penzion, apartmány, Airbnb: co se od 1. 1. 2027 eviduje v EET 2.0 – platba na recepci, záloha převodem, Booking, kauce a místní poplatek z pobytu.",
  lead:
    "Ubytovatel eviduje od **1. 1. 2027** všechny platby, které host zaplatí na místě – hotově, kartou nebo QR kódem na recepci. Neeviduje se záloha poslaná převodem ani platba přes Booking.com či Airbnb online. Jak naložit s vratnou kaucí a místním poplatkem z pobytu, Finanční správa k **1. 10. 2026** podrobně nevysvětlila.",
  summary: [
    "Platby hostů na místě (recepce, check-in, check-out) se evidují – hotovost, karta i QR kód.",
    "Záloha nebo celá platba převodem, platební bránou či přes platformu online se neeviduje.",
    "Záloha zaplacená na místě se eviduje jako běžná platba, doplatek na místě také.",
    "U vratné kauce a místního poplatku z pobytu zatím chybí metodika Finanční správy – ověřte u poradce.",
    "Horská chata bez signálu: tržbu lze odeslat dodatečně, nejpozději do 48 hodin.",
  ],
  sections: [
    {
      id: "koho-se-tyka",
      heading: "Koho se to týká",
      blocks: [
        {
          p: "EET 2.0 se týká každého, kdo ubytování provozuje jako podnikání a přijímá od hostů kontaktní platby: penziony, hotely, kempy, chaty, apartmány i krátkodobé pronájmy přes platformy, pokud jde o živnost (ubytovací službu).",
        },
        {
          p: "Pozor na rozdíl mezi **ubytováním** a **nájmem**. Příjmy z nájmu (typicky dlouhodobý pronájem bytu) pod EET nespadají. Krátkodobé ubytování s poskytováním služeb (úklid, povlečení, recepce) bývá podnikáním. Hranice není vždy ostrá – pokud si nejste jisti, jak je váš příjem zdaněný, poraďte se s daňovým poradcem.",
        },
        { cta: "kontrola-ico" },
      ],
    },
    {
      id: "co-se-eviduje",
      heading: "Co se eviduje a co ne",
      blocks: [
        {
          table: {
            head: ["Platba", "Eviduje se?", "Poznámka"],
            rows: [
              ["Host platí ubytování na recepci hotově nebo kartou", "**Ano**", "Typický případ."],
              ["Host naskenuje QR kód na recepci a zaplatí z mobilu", "**Ano**", "Kontaktní platba."],
              ["Záloha převodem na účet při rezervaci", "Ne", "Vzdálená platba."],
              ["Záloha zaplacená na místě (např. při prohlídce)", "**Ano**", "Jako běžná platba."],
              ["Platba přes Booking.com / Airbnb online, platforma vám pošle výplatu", "Ne", "Platí se vzdáleně přes platformu."],
              ["Rezervace přes platformu, host platí až při příjezdu na místě", "**Ano**", "Rozhoduje platba na místě."],
              ["Minibar, snídaně, parkování, wellness placené na místě", "**Ano**", "Všechny kontaktní platby."],
              ["Faktura firmě, úhrada převodem", "Ne", "Platba na fakturu."],
            ],
            caption: "Stav k 1. 10. 2026 podle informací ministerstva financí a Finanční správy o kontaktních platbách.",
          },
        },
        {
          p: "Obecná pravidla vysvětluje návod [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "zalohy",
      heading: "Zálohy: kdy a jak je evidovat",
      blocks: [
        { p: FACTS.evidenced.prepayments },
        {
          ol: [
            "Host při rezervaci pošle zálohu **převodem** → neevidujete.",
            "Host při příjezdu zaplatí **na místě zálohu** (např. kartou) → evidujete ji jako běžnou platbu.",
            "Při odjezdu host doplatí zbytek **na místě** → evidujete doplatek jako další samostatnou platbu.",
          ],
        },
        {
          note: "Záloha a doplatek se v datové zprávě nepropojují: každou platbu přijatou na místě evidujete zvlášť, zálohu poslanou převodem neevidujete. Doplatek zaplacený na místě evidujete vždy. Postup si ověřte u daňového poradce nebo na [eet.gov.cz](https://eet.gov.cz).",
          tone: "warn",
        },
      ],
    },
    {
      id: "kauce",
      heading: "Vratná kauce",
      blocks: [
        {
          p: "Vratná kauce (jistota pro případ škody) není platbou za ubytování – po odjezdu ji hostovi vracíte. Podle dostupných výkladů se proto neeviduje. Jinak to může být, když kauci celou nebo zčásti ponecháte jako úhradu škody, úklidu nebo služby: pak se z ponechané částky může stát tržba.",
        },
        {
          note: "Výslovné stanovisko Finanční správy ke kaucím v EET 2.0 jsme k 1. 10. 2026 nenašli. Pokud kauce vybíráte často a ve vyšších částkách, nechte si postup potvrdit daňovým poradcem.",
          tone: "warn",
        },
      ],
    },
    {
      id: "poplatek-z-pobytu",
      heading: "Místní (městský) poplatek z pobytu",
      blocks: [
        {
          p: "Místní poplatek z pobytu vybírá ubytovatel od hosta a odvádí ho obci – sám ho neplatí, jen ho vybírá a odvádí. Nejde tedy o platbu za ubytování. Jestli se v EET 2.0 do evidované tržby zahrnuje, nebo se z ní vyčleňuje, Finanční správa k 1. 10. 2026 nezveřejnila.",
        },
        {
          p: "Prakticky: pokud host zaplatí na recepci jednou platbou ubytování i poplatek, nemá pokladna v datové zprávě EET 2.0 zvláštní pole pro poplatek – zpráva obsahuje celkovou částku tržby. Než Finanční správa vydá metodiku, doporučujeme postup konzultovat s daňovým poradcem a mít poplatek v knize hostů a vyúčtování pro obec doložený zvlášť.",
        },
        {
          note: "Tuto část návodu aktualizujeme, jakmile Finanční správa zveřejní stanovisko k místnímu poplatku z pobytu. Informace sledujte na [eet.gov.cz](https://eet.gov.cz).",
        },
      ],
    },
    {
      id: "jednotky-a-signal",
      heading: "Evidenční jednotka a výpadky signálu",
      blocks: [
        {
          p: "Penzion nebo hotel je stálá provozovna – jedna evidenční jednotka, i když máte víc pokladen (recepce, bar). Pokud máte víc objektů na různých místech, budete zpravidla potřebovat víc jednotek. Postup v návodu [Evidenční jednotka](/navody/evidencni-jednotka).",
        },
        {
          p: `Na horských chatách a v odlehlých kempech bývá signál slabý. ${FACTS.offline.summary} Podrobnosti v návodu [EET bez internetu](/navody/eet-bez-internetu).`,
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Host zaplatil přes Booking.com. Musím to evidovat?",
      a: "Pokud host zaplatil online přes platformu a vy dostanete výplatu převodem, neevidujete. Pokud si ubytování přes platformu jen rezervoval a platí až u vás na místě (hotově, kartou, QR), evidujete.",
    },
    {
      q: "Eviduje se záloha za ubytování?",
      a: "Záloha poslaná převodem ne. Záloha zaplacená na místě ano – jako běžná platba. Doplatek na místě evidujete vždy.",
    },
    {
      q: "Eviduje se vratná kauce?",
      a: "Podle dostupných výkladů ne, protože nejde o platbu za službu. Pokud ji ale ponecháte jako úhradu škody nebo služby, může se z ní stát tržba. Výslovné stanovisko Finanční správy zatím chybí.",
    },
    {
      q: "Patří místní poplatek z pobytu do tržby v EET?",
      a: "Zatím není jasné. Finanční správa k 1. 10. 2026 nezveřejnila, zda se poplatek, který ubytovatel vybírá pro obec, zahrnuje do evidované tržby. Poraďte se s daňovým poradcem.",
    },
    {
      q: "Pronajímám byt dlouhodobě. Týká se mě EET?",
      a: "Příjmy z nájmu pod EET nespadají. EET se týká krátkodobého ubytování provozovaného jako podnikání, pokud přijímáte platby na místě.",
    },
  ],
  sources: [SOURCES.mfPredstavuje, SOURCES.kdoMusi, SOURCES.danovkyKontaktni, SOURCES.prakticke, SOURCES.jakZacit, SOURCES.vyvojari, SOURCES.zmp, SOURCES.seminarVyvojari],
  related: ["kontaktni-platba", "eet-bez-internetu", "evidencni-jednotka"],
  published: "2026-10-01",
  updated: "2026-10-03",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-03", text: "Opraveno podle semináře Finanční správy pro vývojáře: záloha a doplatek jsou dvě běžné platby, dárkový poukaz se eviduje jen při prodeji (jeho uplatnění není platbou) a částku určenou k čerpání a čerpání uvádí pokladna jen u kreditu." },{ date: "2026-10-01", text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, ne od 1. 2. 2027." }],
  reviewedBy: REVIEWER.name,
};
