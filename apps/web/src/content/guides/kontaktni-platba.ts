import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

export const kontaktniPlatba: Guide = {
  slug: "kontaktni-platba",
  category: "povinnosti",
  title: "Kontaktní platba v EET 2.0: co se eviduje a co ne",
  h1: "Kontaktní platba: co se v EET 2.0 eviduje a co ne",
  description:
    "Hotovost, karta, QR kód, převod, záloha, poukaz: které platby se od 1. 1. 2027 evidují v EET 2.0 a které ne. Přehledná tabulka a hraniční případy.",
  lead:
    "V EET 2.0 se od **1. 1. 2027** eviduje každá **kontaktní platba** – peníze přijaté při osobním kontaktu se zákazníkem nebo v provozovně: hotovost, karta, QR kód, poukázka, šek i kryptoměny. Neeviduje se platba přes bránu e-shopu ani převod na fakturu. U záloh a poukazů se eviduje přijetí i čerpání zvlášť.",
  summary: [
    "Rozhoduje okolnost platby (osobní kontakt, provozovna), ne platební prostředek.",
    "Eviduje se hotovost, platební karta, QR kód, poukázka, šek i virtuální aktiva.",
    "Neeviduje se platební brána e-shopu, QR kód na webu a bankovní převod na základě faktury.",
    "Zálohy, dárkové poukazy a dobití kreditu se evidují dvakrát – při přijetí i při čerpání, jako samostatné částky.",
  ],
  sections: [
    {
      id: "co-je-kontaktni-platba",
      heading: "Co je kontaktní platba",
      blocks: [
        {
          p: "Stará EET (2016–2020) se po zásahu Ústavního soudu v roce 2018 týkala jen hotovosti a podobných prostředků, platby kartou z ní vypadly. EET 2.0 stojí na novém pojmu **kontaktní platba**: je to platba uskutečněná při osobním kontaktu s podnikatelem, nebo v souvislosti s objednáním či převzetím zboží a služby v jeho provozovně. Platební prostředek sám o sobě nerozhoduje – podstatné je, **kde a za jakých okolností** zákazník platí.",
        },
        { p: FACTS.evidenced.summary },
        { p: FACTS.evidenced.notEvidenced },
        {
          note: "Jednoduchý test: Stojí zákazník u vás (v provozovně, u stánku, u sebe doma při vaší návštěvě) a v tu chvíli platí? Pak jde o kontaktní platbu a evidujete ji – ať platí hotově, kartou nebo QR kódem.",
        },
      ],
    },
    {
      id: "prehled",
      heading: "Přehled: co se eviduje a co ne",
      blocks: [
        {
          table: {
            head: ["Způsob platby", "Eviduje se?", "Poznámka"],
            rows: [
              ["Hotovost na místě", "**Ano**", "Základní případ."],
              ["Platební karta přes terminál (i mobil, hodinky)", "**Ano**", "Stará EET karty evidovala jen do roku 2018."],
              ["QR kód na pokladně, zákazník platí hned z mobilu", "**Ano**", "Rozhoduje místo a okamžik platby, ne QR kód."],
              ["Poukázka, stravenka, šek", "**Ano**", "Patří mezi evidované platební prostředky."],
              ["Virtuální aktiva (kryptoměny) na místě", "**Ano**", "Výslovně uvedeno ministerstvem financí."],
              ["Platební brána e-shopu, zboží jen vyzvednete na prodejně", "Ne", "Zaplaceno vzdáleně předem."],
              ["Zákazník platí až při převzetí na prodejně nebo výdejním místě", "**Ano**", "Bez ohledu na způsob platby."],
              ["QR kód na webu nebo ve faktuře zaplacený z domova", "Ne", "Vzdálená platba."],
              ["Bankovní převod na základě faktury", "Ne", "Typické u B2B a řemeslníků."],
              ["Dobírka vybraná dopravcem", "Ne", "Podle dostupných výkladů; peníze přijdou převodem od dopravce."],
            ],
            caption: "Stav k 1. 10. 2026 podle informací ministerstva financí a Finanční správy.",
          },
        },
        { cta: "qr" },
      ],
    },
    {
      id: "qr-a-prevod",
      heading: "QR platba a převod: kde je hranice",
      blocks: [
        {
          p: "QR platba je ve skutečnosti okamžitý bankovní převod. EET 2.0 ji proto neposuzuje podle technologie, ale podle situace. Když zákazník stojí u pokladny, naskenuje QR kód a platbu odešle z mobilního bankovnictví, jde o kontaktní platbu a evidujete ji. Když stejný QR kód najde ve faktuře a zaplatí z domova o tři dny později, evidovat nebudete.",
        },
        {
          p: "Hraniční jsou situace typu „pošlu vám to hned teď na účet“ bez QR kódu, přímo při vaší návštěvě. Podle výkladu Finanční správy může být i převod kontaktní platbou, pokud k němu dochází při osobním kontaktu. Podrobnou metodiku k těmto případům Finanční správa k 1. 10. 2026 nezveřejnila.",
        },
        {
          note: "Řemeslník, který dokončí práci a vystaví fakturu se splatností 14 dní, převod neeviduje. Pokud ale zákazník zaplatí na místě kartou, hotově nebo QR kódem z vaší pokladny, evidujete. Více v návodu [EET pro řemeslníky](/navody/eet-remeslnici).",
          tone: "warn",
        },
      ],
    },
    {
      id: "zalohy-a-poukazy",
      heading: "Zálohy, dárkové poukazy a kredit",
      blocks: [
        { p: FACTS.evidenced.prepayments },
        {
          p: "V datové zprávě jsou na to dvě samostatná pole: částka **určená k pozdějšímu čerpání** (přijatá záloha, prodaný poukaz, dobitý kredit) a částka, která je **čerpáním** dříve zaplacené zálohy. Pokladna je musí umět odeslat odděleně.",
        },
        {
          table: {
            head: ["Situace", "Co odeslat"],
            rows: [
              ["Zákazník u vás koupí dárkový poukaz za 1 000 Kč (hotově)", "Tržba 1 000 Kč jako částka určená k čerpání"],
              ["Obdarovaný poukaz uplatní na službu za 1 000 Kč", "Tržba s čerpáním 1 000 Kč (zaplaceno poukazem)"],
              ["Host penzionu zaplatí na místě zálohu 2 000 Kč kartou", "Tržba 2 000 Kč jako částka určená k čerpání"],
              ["Záloha převodem na účet dva týdny předem", "Neeviduje se (vzdálená platba)"],
            ],
            caption: "Ilustrační příklady. Jak správně zaúčtovat čerpání zálohy přijaté převodem, zatím Finanční správa podrobně nepopsala.",
          },
        },
        {
          p: "Detaily pro jednotlivé obory – například zálohy a kauce u ubytování – rozebíráme v návodu [EET u ubytování](/navody/eet-ubytovani). Úplné vratné kauce (jistoty) zákon podle dostupných informací výslovně neřeší; postup zatím ověřte u daňového poradce.",
        },
      ],
    },
    {
      id: "co-nejsou-trzby",
      heading: "Co do EET nepatří vůbec",
      blocks: [
        {
          ul: [
            "Příjmy, které nejsou z podnikání: mzda, nájem, dividendy, ostatní (příležitostné) příjmy podle § 10 ZDP (viz [Koho se EET týká](/navody/koho-se-eet-tyka)).",
            "Tržby z vyjmutých činností (například poštovní služby nebo hazardní hry).",
            "Platby, které podnikatel přijímá vzdáleně – brána, převod na fakturu, platba z domova.",
            "Tržby podnikatele v režimu [EET OFF](/navody/eet-off).",
          ],
        },
        {
          note: `Malé tržby z podnikání z evidence automaticky nevypadávají. ${FACTS.whoMust.occasional}`,
          tone: "warn",
        },
        {
          p: "Pokud si nejste jisti, zda váš konkrétní případ evidovat, projděte si [kvíz Musím evidovat?](/musim-evidovat).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Eviduje se platba kartou?",
      a: "Ano, pokud zákazník platí osobně na místě (terminál, mobil, hodinky). Stará EET platby kartou evidovala jen do roku 2018, kdy tuto povinnost zrušil Ústavní soud; EET 2.0 je do evidence vrací.",
    },
    {
      q: "Eviduje se QR platba?",
      a: "Ano, pokud zákazník QR kód naskenuje a zaplatí přímo u vás (v provozovně, u stánku, při vaší návštěvě). QR kód na webu nebo ve faktuře zaplacený z domova se neeviduje. QR kód pro platbu vám vygeneruje náš [nástroj QR platba](/qr-platba).",
    },
    {
      q: "E-shop: musím evidovat, když si zákazník zboží vyzvedne na prodejně?",
      a: "Pokud už zaplatil přes platební bránu nebo převodem předem, ne. Pokud platí až při vyzvednutí (hotově, kartou, QR), jde o kontaktní platbu a evidujete ji.",
    },
    {
      q: "Musí se v EET 2.0 odesílat, jak zákazník zaplatil?",
      a: "Ne. Podle zveřejněné technické dokumentace datová zpráva neobsahuje způsob platby, sazby DPH ani položky – jen celkovou částku, datum, evidenční jednotku a pořadové číslo, případně částky záloh a čerpání.",
    },
    {
      q: "Evidují se stravenky?",
      a: "Stravenka je poukázka, a platba poukázkou při osobním kontaktu se podle ministerstva financí eviduje. Jak přesně rozlišit papírové a elektronické stravenky, Finanční správa zatím podrobně nevysvětlila.",
    },
  ],
  sources: [
    SOURCES.mfPredstavuje,
    SOURCES.kdoMusi,
    SOURCES.fsVladaSchvalila,
    SOURCES.danovkyKontaktni,
    SOURCES.vyvojari,
    SOURCES.srovnani,
    SOURCES.usoudEet,
    SOURCES.podnikatelDetail,
    SOURCES.psp,
  ],
  related: ["koho-se-eet-tyka", "eet-ubytovani", "eet-remeslnici"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: kontaktní platby se evidují od 1. 1. 2027, ne od 1. 2. 2027. Doplněno, že hranice 50 000 Kč pro příležitostné tržby v zákoně není.",
    },
  ],
  reviewedBy: null,
};
