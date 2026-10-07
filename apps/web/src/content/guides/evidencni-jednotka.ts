import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const evidencniJednotka: Guide = {
  slug: "evidencni-jednotka",
  category: "prakticke",
  title: "Evidenční jednotka v EET 2.0: co to je a jak ji oznámit",
  h1: "Evidenční jednotka: co to je a jak ji oznámit",
  description:
    "Evidenční jednotka je provozovna, stánek, web, vozidlo nebo vy sami. Jak ji od 1. 11. 2026 oznámit v DIS+, kolik jich potřebujete a do kdy hlásit změny.",
  lead:
    "Evidenční jednotka je místo nebo kanál, kde přijímáte tržby: provozovna, stánek, automat, web či aplikace, vozidlo – nebo vy sami, pokud provozovnu nemáte. Oznamuje se v DIS+ od **1. 11. 2026**, systém jí přidělí ID, které posíláte s každou tržbou. Změny hlásíte nejpozději do **15 dnů**.",
  summary: [
    "Typy jednotek v DIS+: stálá provozovna, mobilní provozovna, automat, internetová stránka, dopravní prostředek.",
    "Podnikatel bez provozovny (např. řemeslník, mobilní kadeřnice) uvede jako jednotku sám sebe.",
    "Jednotky zakládáte v DIS+ (od 1. 11. 2026); každá dostane neměnné ID – není to IČP z živnostenského rejstříku.",
    "Změnu údajů oznamte před první tržbou po změně, nejpozději do 15 dnů.",
    "Oznamují se všechny jednotky – i ty bez evidovaných tržeb, pokud máte aspoň jednu jednotku, kde je přijímáte.",
  ],
  sections: [
    {
      id: "co-to-je",
      heading: "Co je evidenční jednotka",
      blocks: [
        {
          p: "V první EET se tržby vázaly na **provozovnu**. EET 2.0 zavádí širší pojem **evidenční jednotka**: kromě kamenné provozovny jím může být i stánek, vozidlo, webová stránka nebo aplikace – a u podnikatelů, kteří žádné takové místo nemají, přímo osoba podnikatele.",
        },
        { p: FACTS.units.summary },
        {
          table: {
            head: ["Typ jednotky v DIS+", "Typický příklad"],
            rows: [
              ["Stálá provozovna", "Kadeřnictví, kavárna, obchod, penzion, ordinace"],
              ["Mobilní provozovna", "Stánek na trzích, food truck, pojízdná prodejna"],
              ["Automat", "Samoobslužné zařízení – pozor, řada automatů je z evidence vyjmuta"],
              ["Internetová stránka (i její část či aplikace)", "Web nebo aplikace, přes které nabízíte zboží a služby"],
              ["Dopravní prostředek", "Taxi, vyhlídková loď, autobus zájezdové dopravy"],
              ["Poplatník sám", "Řemeslník, mobilní kadeřnice, masér jezdící ke klientům, lektor"],
            ],
            caption: "Typy podle eet.gov.cz. Příklady jsou ilustrační.",
          },
        },
        {
          note: "Webová stránka se stává evidenční jednotkou typicky tehdy, když přes ni zákazník objedná a platí při osobním kontaktu s vámi. Samotné platby přes platební bránu se neevidují – viz [Kontaktní platba](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "kolik-jednotek",
      heading: "Kolik jednotek potřebujete",
      blocks: [
        {
          p: "Pravidlo zní: jedna jednotka za každé místo nebo kanál, kde přijímáte evidované tržby – a k tomu všechny ostatní jednotky (viz upozornění níže). Několik pokladen v jedné provozovně je pořád jedna jednotka – pokladny se v datové zprávě rozlišují vlastním označením pokladního zařízení.",
        },
        {
          note: `${FACTS.units.allUnits} Například provozovnu, kde zákazníci platí jen převodem na fakturu, tedy oznámíte také – jen u ní uvedete, že se v ní evidované tržby neuskutečňují.`,
          tone: "warn",
        },
        {
          table: {
            head: ["Situace", "Počet jednotek"],
            rows: [
              ["Kadeřnice s jedním salonem", "1 (stálá provozovna)"],
              ["Kadeřnice, která chodí jen za klienty domů", "1 (poplatník sám)"],
              ["Kavárna se dvěma pokladnami", "1 (stálá provozovna)"],
              ["Obchod ve městě + stánek na farmářských trzích", "2 (stálá + mobilní provozovna)"],
              ["Taxikář s jedním vozem", "1 (dopravní prostředek)"],
              ["Dvě kavárny ve dvou městech", "2 (dvě stálé provozovny)"],
            ],
          },
        },
        {
          p: "Zda a kolik jednotek budete potřebovat, vám předběžně řekne náš [průvodce evidenčními jednotkami](/evidencni-jednotky), který vychází z provozoven zapsaných v živnostenském rejstříku. Rychlý odhad podle IČO nabízí [kontrola IČO](/kontrola-ico).",
        },
        { cta: "jednotky" },
      ],
    },
    {
      id: "jak-oznamit",
      heading: "Jak jednotku oznámit v DIS+",
      blocks: [
        {
          p: "Vše se dělá elektronicky v **Daňové informační schránce (DIS+)** na portálu MOJE daně. Funkce pro EET 2.0 se otevírají **1. 11. 2026**.",
        },
        {
          ol: [
            "Přihlaste se do DIS+ (portál MOJE daně) – například bankovní identitou nebo eObčankou.",
            "Přihlaste se k evidenci tržeb.",
            "V části Evidence tržeb → Evidenční jednotky založte každou jednotku.",
            "Vyplňte údaje: identifikaci jednotky (např. adresu, název stránky, vozidlo), druh jednotky, převažující druh činnosti a informaci, zda se v ní uskutečňují evidované tržby.",
            "Systém jednotce přidělí **ID jednotky**. To zadáte do pokladny – posílá se v každé datové zprávě.",
          ],
        },
        {
          p: "Podrobný postup včetně pokladního certifikátu najdete v návodu [Jak aktivovat DIS+ a stáhnout certifikát EET](/navody/jak-aktivovat-dis-a-certifikat).",
        },
        {
          p: "Oznamujete i jednotky, kde evidované tržby nepřijímáte (viz výše). Proto se v DIS+ u každé jednotky uvádí i to, zda se v ní evidované tržby uskutečňují.",
        },
        {
          note: "**IČP ≠ ID jednotky.** Identifikační číslo provozovny (IČP) ze živnostenského rejstříku je jiný údaj. Do pokladny patří ID, které přidělí DIS+. Zadáte-li do pokladny místo ID jednotky IČP, datová zpráva nebude odpovídat oznámené jednotce.",
          tone: "warn",
        },
      ],
    },
    {
      id: "zmeny",
      heading: "Změny a rušení jednotek",
      blocks: [
        { p: FACTS.units.change },
        {
          ul: [
            "**Stěhujete provozovnu** – oznamte změnu adresy dřív, než v novém místě přijmete první tržbu.",
            "**Otevíráte novou pobočku** – založte novou jednotku a ID zadejte do pokladny ještě před prvním prodejem.",
            "**Končíte s provozovnou** – změnu oznamte, ať jednotka zbytečně nevisí jako aktivní.",
          ],
        },
        {
          p: "ID jednotky se nemění ani při změně údajů. Jedna pokladna může obsluhovat více jednotek, pokud v ní u každé tržby zvolíte tu správnou.",
        },
      ],
    },
    {
      id: "pokladny-a-limity",
      heading: "Jednotky v pokladních aplikacích",
      blocks: [
        {
          p: "Pokladní certifikát patří podnikateli, ne jednotce: jeden certifikát můžete použít pro všechny své jednotky i pokladny. Rozdíl je v tom, kolik jednotek pokladní aplikace zvládne.",
        },
        {
          ul: [
            "Státní aplikace **MOJE eet** podle zveřejněných informací umožní až 2 evidenční jednotky a přístup pro 2 zaměstnance.",
            "Pokladna **EvidujZdarma** nabízí zdarma 3 jednotky a až 5 uživatelů a funguje i bez signálu.",
          ],
        },
        {
          p: "Nezávislé srovnání obou aplikací najdete na stránce [EvidujZdarma vs MOJE eet](/srovnani/moje-eet).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Musím oznámit evidenční jednotku, když nemám provozovnu?",
      a: "Ano, pokud přijímáte evidované tržby. Podnikatel bez provozovny uvede jako evidenční jednotku sám sebe.",
    },
    {
      q: "Do kdy musím jednotky oznámit?",
      a: "Před první evidovanou tržbou. Evidovat se musí od 1. 1. 2027, DIS+ umožní jednotky zakládat od 1. 11. 2026. Doporučujeme to stihnout v listopadu, abyste si mohli v prosinci pokladnu vyzkoušet – evidovat se musí už od 1. 1. 2027.",
    },
    {
      q: "Musím oznámit i provozovnu, kde evidované tržby nepřijímám?",
      a: FACTS.units.allUnits,
    },
    {
      q: "Je ID jednotky totéž co IČP?",
      a: "Ne. IČP je číslo provozovny ze živnostenského rejstříku. ID evidenční jednotky přidělí DIS+ při jejím založení a právě to se posílá v datové zprávě.",
    },
    {
      q: "Mám v jedné provozovně dvě pokladny. Potřebuji dvě jednotky?",
      a: "Ne. Jde o jednu evidenční jednotku; pokladny se rozliší označením pokladního zařízení, které si nastavíte v pokladně.",
    },
    {
      q: "Do kdy musím nahlásit změnu?",
      a: "Před první evidovanou tržbou po změně, nejpozději do 15 dnů ode dne, kdy změna nastala.",
    },
  ],
  sources: [SOURCES.jakZacit, SOURCES.harmonogram, SOURCES.prakticke, SOURCES.vyvojari, SOURCES.finmagNavod, SOURCES.mojeEet],
  related: ["jak-aktivovat-dis-a-certifikat", "koho-se-eet-tyka", "eet-2-0-kompletni-pruvodce"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, a to i v lednu. Doplněno, že se oznamují všechny jednotky včetně těch bez evidovaných tržeb.",
    },
  ],
  reviewedBy: REVIEWER.name,
};
