import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";

export const eet20VsEet10: Guide = {
  slug: "eet-2-0-vs-eet-1-0",
  category: "zaklady",
  title: "EET 2.0 vs stará EET: hlavní rozdíly přehledně",
  h1: "EET 2.0 vs stará EET: v čem se liší",
  description:
    "Žádná povinná účtenka, žádné FIK a BKP, nový kód POK, platby kartou a QR, EET OFF a žádné zavírání provozoven. Srovnání EET 2.0 (2027) se starou EET.",
  lead:
    "EET 2.0 (od **1. 1. 2027**, naostro od 1. 2. 2027) je jednodušší než stará EET z let 2016–2020: nemusíte vydávat účtenku, kódy FIK, BKP a PKP nahradil jediný **POK**, odesílá se méně údajů a provozovnu už nelze zavřít. Nově se ale evidují i platby kartou a QR kódem na místě a všichni začínají najednou.",
  summary: [
    "Účtenka už není povinná – jen na žádost zákazníka podle zákona o ochraně spotřebitele.",
    "Kódy FIK, BKP a PKP zmizely, Finanční správa vrací jediný potvrzovací kód POK.",
    "Evidují se kontaktní platby včetně karet a QR kódů na místě, ne jen hotovost.",
    "Místo provozovny je evidenční jednotka; vše se vyřizuje v DIS+.",
    "Pokuta až 500 000 Kč zůstává, uzavření provozovny jako sankce zmizelo.",
  ],
  sections: [
    {
      id: "kratka-historie",
      heading: "Krátce k historii",
      blocks: [
        {
          p: "První EET startovala **1. 12. 2016** pro ubytování a stravování a **1. 3. 2017** pro maloobchod a velkoobchod. Další vlny už nenaběhly: Ústavní soud koncem roku 2017 zrušil jejich harmonogram i evidenci plateb kartou, v březnu 2020 byla evidence kvůli pandemii pozastavena a od **1. 1. 2023** byla zrušena úplně.",
        },
        {
          p: `Nový zákon o evidenci tržeb (sněmovní tisk 189) podepsal prezident ${FACTS.law.signedOn} a účinnosti nabývá ${FACTS.law.effectiveFrom}. Na rozdíl od první EET se týká všech oborů najednou.`,
        },
      ],
    },
    {
      id: "srovnani",
      heading: "Srovnání v tabulce",
      blocks: [
        {
          table: {
            head: ["", "Stará EET (2016–2020)", "EET 2.0 (od 2027)"],
            rows: [
              ["Náběh", "Ve vlnách podle oborů (realizovány 2 vlny)", "Všichni najednou: 1. 1. 2027, ostře 1. 2. 2027"],
              ["Co se eviduje", "Hotovost a obdobné prostředky; platby kartou jen do roku 2018", "Kontaktní platby: hotovost, karta, QR kód, poukázka, šek, virtuální aktiva"],
              ["Účtenka", "Povinná u každé tržby", "Nepovinná; na žádost doklad podle zákona o ochraně spotřebitele"],
              ["Kódy", "FIK, BKP, PKP", "Jediný potvrzovací kód POK"],
              ["Údaje ve zprávě", "Mohly obsahovat i rozpis podle sazeb DPH a další členění", "Méně údajů: bez DPH, bez způsobu platby, bez položek"],
              ["Místo prodeje", "Provozovna (id_provoz)", "Evidenční jednotka (id_jednotky) – i web, vozidlo nebo poplatník sám"],
              ["Identifikace poplatníka", "DIČ (dic_popl)", "EIČ (eic_popl)"],
              ["Správa", "Webová aplikace EET na daňovém portálu", "DIS+ na portálu MOJE daně"],
              ["Certifikát", "Platnost 3 roky", "Platnost 366 dní, možná automatická obnova"],
              ["Výpadek spojení", "Účtenka s PKP a BKP, dodatečné odeslání do 48 hodin", "Prodej pokračuje, odeslání nejpozději do 48 hodin"],
              ["Informační oznámení", "Povinné v provozovně", "Podle rozborů zákona odpadá"],
              ["Možnost vyvázání", "Ne (jen věcné výjimky)", `EET OFF: přirážka ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně pro paušalisty v 1. pásmu`],
              ["Sankce", "Pokuta až 500 000 Kč, uzavření provozovny", "Pokuta až 500 000 Kč, bez uzavření provozovny"],
            ],
            caption: "Stav k 1. 10. 2026. Technické údaje podle dokumentace Finanční správy pro vývojáře.",
          },
        },
      ],
    },
    {
      id: "uctenka-a-kody",
      heading: "1. Konec povinné účtenky a kódů FIK, BKP a PKP",
      blocks: [
        {
          p: "Ve staré EET pokladna u každé tržby vytiskla účtenku s **FIK** (fiskální identifikační kód od Finanční správy) a **BKP** (bezpečnostní kód poplatníka); bez spojení s **PKP** (podpisový kód poplatníka) místo FIK. V EET 2.0 nic z toho není. Pokladna odešle datovou zprávu a Finanční správa vrátí **POK – potvrzovací kód**.",
        },
        { p: FACTS.receipt.summary },
        {
          p: "Více v návodu [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)",
        },
      ],
    },
    {
      id: "rozsah",
      heading: "2. Širší rozsah: karty a QR kódy",
      blocks: [
        {
          p: "Nová evidence stojí na pojmu **kontaktní platba**. Rozhoduje, zda zákazník platí při osobním kontaktu nebo v provozovně – ne čím. Proto se evidují i platby kartou a QR kódem na místě. Ve staré EET se karty evidovaly jen zpočátku; Ústavní soud tuto povinnost zrušil s odůvodněním, že bezhotovostní platby jsou dohledatelné.",
        },
        { p: FACTS.evidenced.notEvidenced },
        {
          p: "Podrobnosti v návodu [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "mene-udaju",
      heading: "3. Méně údajů ve zprávě",
      blocks: [
        {
          p: "Datová zpráva EET 2.0 obsahuje jen nezbytné údaje: identifikaci poplatníka (EIČ), ID evidenční jednotky, označení pokladny, pořadové číslo, datum a čas tržby, celkovou částku a případně částky záloh a jejich čerpání. Rozpis podle sazeb DPH, způsob platby ani položky se neposílají.",
        },
        {
          p: "Pro vývojáře: oproti staré EET se mění i názvy polí – **dic_popl** nahradilo **eic_popl** a **id_provoz** nahradilo **id_jednotky**. Komunikace probíhá přes rozhraní SOAP s podpisem certifikátem; dokumentaci zveřejňuje [eet.gov.cz pro vývojáře](https://eet.gov.cz/pro-vyvojare/).",
        },
      ],
    },
    {
      id: "jednotky-a-dis",
      heading: "4. Evidenční jednotky a DIS+ místo provozoven",
      blocks: [
        {
          p: "Stará EET pracovala s provozovnami, které podnikatel zadával ve webové aplikaci EET. EET 2.0 zavádí **evidenční jednotky** – kromě provozoven i stánky, vozidla, weby nebo samotného podnikatele bez provozovny. Vše se vyřizuje v **DIS+** na portálu MOJE daně, funkce se otevírají 1. 11. 2026.",
        },
        {
          p: "Viz [Evidenční jednotka: co to je a jak ji oznámit](/navody/evidencni-jednotka) a [Jak aktivovat DIS+ a stáhnout certifikát](/navody/jak-aktivovat-dis-a-certifikat).",
        },
      ],
    },
    {
      id: "eet-off-a-sankce",
      heading: "5. EET OFF a mírnější sankce",
      blocks: [
        {
          p: `Úplnou novinkou je **EET OFF**: OSVČ v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč se může z evidence vyvázat přirážkou ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně. Lhůta pro rok 2027 je ${FACTS.eetOff.deadline}. Více v návodu [EET OFF: vyplatí se?](/navody/eet-off)`,
        },
        {
          p: "Sankce zůstávají přísné – pokuta až 500 000 Kč –, ale úřady už nemohou provozovnu zavřít ani pozastavit činnost. Viz [Pokuty za EET 2.0](/navody/pokuty-eet).",
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "co-zustava",
      heading: "Co zůstává stejné",
      blocks: [
        {
          ul: [
            "Evidovat musí poplatník daně z příjmů, který přijímá evidované tržby.",
            "Tržba se odesílá online a při výpadku spojení dodatečně do 48 hodin.",
            "Pokladna potřebuje pokladní certifikát od Finanční správy (zdarma).",
            "Zálohy a jejich čerpání se v datové zprávě rozlišují samostatnými částkami.",
            "Maximální pokuta 500 000 Kč.",
          ],
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Platí ještě stará EET?",
      a: "Ne. Stará EET byla pozastavena v březnu 2020 a zrušena k 1. 1. 2023. EET 2.0 je nový zákon účinný od 1. 1. 2027.",
    },
    {
      q: "Můžu použít starou EET pokladnu?",
      a: "Jen pokud výrobce pokladnu aktualizuje na nové rozhraní EET 2.0. Staré pokladny posílaly jiný formát zprávy a pracovaly s kódy FIK a BKP, které už neexistují.",
    },
    {
      q: "Co je POK?",
      a: "Potvrzovací kód, který Finanční správa vrátí na každou přijatou datovou zprávu. Nahrazuje FIK ze staré EET. Podle technické dokumentace jde o jedinečný řetězec, který potvrzuje, že tržba byla zaevidována.",
    },
    {
      q: "Je EET 2.0 přísnější, nebo mírnější?",
      a: "Obojí. Rozsah je širší (karty, QR kódy, všechny obory), administrativa menší (bez účtenky, méně údajů, nová státní aplikace MOJE eet zdarma) a sankce mírnější v tom, že odpadlo zavírání provozoven.",
    },
  ],
  sources: [
    SOURCES.prezident,
    SOURCES.mfPredstavuje,
    SOURCES.vyvojari,
    SOURCES.srovnani,
    SOURCES.pokuty,
    SOURCES.usoudEet,
    SOURCES.fsZruseni2023,
    SOURCES.businessinfoEet1,
  ],
  related: ["eet-2-0-kompletni-pruvodce", "kontaktni-platba", "musim-vydavat-uctenku"],
  published: "2026-10-01",
  updated: "2026-10-01",
  reviewedBy: null,
};
