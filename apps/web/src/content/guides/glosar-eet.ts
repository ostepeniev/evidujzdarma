import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";

export const glosarEet: Guide = {
  slug: "glosar-eet",
  category: "zaklady",
  title: "Glosář EET 2.0: POK, EIČ, DIS+, EET OFF a další pojmy",
  h1: "Glosář EET 2.0",
  description:
    "Srozumitelný slovník pojmů EET 2.0: POK, evidenční jednotka, EIČ, DIS+, MOJE eet, pokladní certifikát, EET OFF, pilotní a ostrý provoz, Playground a další.",
  lead:
    "Glosář vysvětluje přes 30 pojmů nové evidence tržeb – od **POK** a **evidenční jednotky** po **EET OFF** a **Playground**. Zákon o evidenci tržeb je účinný od **1. 1. 2027**, ostrý provoz začíná **1. 2. 2027**. Definice jsou zjednodušené pro podnikatele; u technických pojmů uvádíme i název pole v datové zprávě.",
  summary: [
    "POK (potvrzovací kód) nahrazuje kódy FIK, BKP a PKP ze staré EET.",
    "Evidenční jednotka je provozovna, stánek, automat, web, vozidlo – nebo podnikatel sám.",
    "DIS+ je daňová informační schránka na portálu MOJE daně, kde se k EET přihlašujete.",
    `EET OFF je dobrovolná přirážka ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně místo evidence pro paušalisty v 1. pásmu.`,
  ],
  sections: [
    {
      id: "zakon-a-terminy",
      heading: "Zákon, termíny a režimy",
      blocks: [
        { h3: "EET 2.0" },
        {
          p: `Neoficiální název nové evidence tržeb podle zákona o evidenci tržeb (${FACTS.law.printNo}), který prezident podepsal ${FACTS.law.signedOn}. Zákon je účinný od ${FACTS.law.effectiveFrom}. Přehled v [kompletním průvodci](/navody/eet-2-0-kompletni-pruvodce).`,
        },
        { h3: "Pilotní provoz" },
        {
          p: "Leden 2027 – první měsíc účinnosti zákona, kdy podle harmonogramu Finanční správy probíhá dobrovolný pilotní provoz. Je určen k vyzkoušení pokladen a nastavení; Finanční správa se v něm chce soustředit na metodickou podporu. Zda je pilot zakotven přímo v zákoně, jsme zatím neověřili.",
        },
        { h3: "Ostrý provoz" },
        {
          p: "Od **1. 2. 2027** musí poplatníci evidovat tržby naplno a s plnou odpovědností za případná porušení.",
        },
        { h3: "EET OFF" },
        { p: FACTS.eetOff.summary },
        { h3: "Přirážka (k paušální záloze)" },
        {
          p: `Částka ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně, kterou poplatník v režimu EET OFF platí navíc k paušální záloze. K přirážce se hlásí oznámením do 10. dne zdaňovacího období – pro rok 2027 do ${FACTS.eetOff.deadline}. Viz [EET OFF: vyplatí se?](/navody/eet-off)`,
        },
        { h3: "Paušální režim" },
        {
          p: "Zjednodušený režim placení daně z příjmů a pojistného pro OSVČ jednou měsíční zálohou, rozdělený do tří pásem. Evidence tržeb se na paušalisty vztahuje stejně jako na ostatní, s výjimkou EET OFF. Viz [EET a paušální daň](/navody/eet-a-pausalni-dan).",
        },
        { h3: "Harmonogram" },
        {
          p: "Časový plán spuštění EET 2.0 od Finanční správy: 1. 11. 2026 funkce v DIS+, 1. 12. 2026 aplikace MOJE eet, 1. 1. 2027 účinnost a pilotní provoz, 11. 1. 2027 lhůta pro EET OFF, 1. 2. 2027 ostrý provoz.",
        },
      ],
    },
    {
      id: "co-a-kdo",
      heading: "Kdo a co se eviduje",
      blocks: [
        { h3: "Poplatník" },
        {
          p: "Poplatník daně z příjmů – fyzická osoba (OSVČ) nebo právnická osoba –, který přijímá evidované tržby, a proto má povinnost je evidovat. Viz [Koho se EET týká](/navody/koho-se-eet-tyka).",
        },
        { h3: "Evidovaná tržba" },
        {
          p: "Platba za zboží nebo službu v rámci podnikání, kterou zákon podřizuje evidenci – v EET 2.0 jde o kontaktní platby, pokud nespadají pod výjimku.",
        },
        { h3: "Kontaktní platba" },
        {
          p: "Platba přijatá při osobním kontaktu se zákazníkem nebo v souvislosti s objednáním či převzetím zboží a služby v provozovně – hotovost, karta, QR kód, poukázka, šek, virtuální aktiva. Neeviduje se platební brána e-shopu ani převod na fakturu. Viz [Kontaktní platba](/navody/kontaktni-platba).",
        },
        { h3: "Vyjmutá činnost" },
        {
          p: "Činnost, jejíž tržby zákon z evidence vyjímá – například část dopravy, poštovní služby, hazardní hry nebo dodávky energií. Výjimka platí jen pro danou činnost, ne pro celého podnikatele.",
        },
        { h3: "Záloha určená k čerpání a čerpání" },
        {
          p: "U záloh, dárkových poukazů a dobíjení kreditu se eviduje přijetí platby určené k pozdějšímu čerpání i samotné čerpání, jako samostatné částky. V datové zprávě jim odpovídají pole **urceno_cerp_zuct** a **cerp_zuct**.",
        },
        { h3: "Pověření (tržba za jiného)" },
        {
          p: "Poplatník, kterému tržba plyne (pověřující), může evidencí pověřit jiného poplatníka (pověřeného). Datová zpráva pak obsahuje identifikaci pověřujícího v poli **eic_poverujiciho**. Viz [Tržba za jiného](/navody/trzba-za-jineho).",
        },
        { h3: "Nepřímé zastoupení" },
        {
          p: "Situace, kdy někdo jedná vlastním jménem na cizí účet (například komisní prodej). Podle rozborů zákona ji EET 2.0 řeší odděleně od pověření; podrobnou metodiku Finanční správa zatím nevydala.",
        },
      ],
    },
    {
      id: "dis-a-certifikaty",
      heading: "DIS+, certifikáty a aplikace",
      blocks: [
        { h3: "MOJE daně" },
        {
          p: "Portál Finanční správy pro elektronickou komunikaci s finančním úřadem. Jeho součástí je DIS+.",
        },
        { h3: "DIS+ (Daňová informační schránka plus)" },
        {
          p: "Online prostředí na portálu MOJE daně, kde se od **1. 11. 2026** přihlásíte k evidenci tržeb, oznámíte evidenční jednotky a vygenerujete pokladní certifikát. Viz [Jak aktivovat DIS+](/navody/jak-aktivovat-dis-a-certifikat).",
        },
        { h3: "Evidenční jednotka" },
        { p: FACTS.units.summary },
        { h3: "ID evidenční jednotky" },
        {
          p: "Neměnné číslo, které DIS+ přidělí jednotce při jejím založení. Posílá se v každé datové zprávě (pole **id_jednotky**). Nezaměňujte ho s IČP (číslem provozovny z živnostenského rejstříku). Viz [Evidenční jednotka](/navody/evidencni-jednotka).",
        },
        { h3: "Pokladní certifikát" },
        { p: FACTS.certificate.summary },
        { h3: "Certifikační autorita EET" },
        {
          p: "Složka Finanční správy, která pokladní certifikáty vydává. Pro EET 2.0 jde o certifikační autoritu EET v2.0; certifikáty ze staré EET neplatí.",
        },
        { h3: "Správa pokladních certifikátů EET" },
        {
          p: "Aplikace dostupná přes DIS+, ve které certifikát vygenerujete (zvolíte heslo k soukromému klíči) a stáhnete jako soubor .p12.",
        },
        { h3: "EIČ" },
        {
          p: "Identifikátor poplatníka v evidenci tržeb (v datové zprávě pole **eic_popl**, ve staré EET se pole jmenovalo dic_popl). Podle dokumentace certifikační autority jím je DIČ, případně rodné číslo nebo jiné číslo přidělené správcem daně. EIČ je zapsané i v pokladním certifikátu – proto certifikát patří poplatníkovi.",
        },
        { h3: "MOJE eet" },
        { p: FACTS.mojeEet.summary },
        { h3: "Pokladna (pokladní zařízení)" },
        {
          p: "Software nebo zařízení, které tržby odesílá – mobilní aplikace, webová pokladna, tablet nebo klasická pokladna. Každé pokladní zařízení má v datové zprávě vlastní označení (pole **id_pokl**, nejvýše 20 znaků).",
        },
      ],
    },
    {
      id: "datova-zprava",
      heading: "Datová zpráva a odpověď",
      blocks: [
        { h3: "Datová zpráva" },
        {
          p: "Zpráva o jedné evidované tržbě, kterou pokladna odešle Finanční správě. Obsahuje mimo jiné EIČ poplatníka, ID evidenční jednotky, označení pokladny, pořadové číslo, datum a čas tržby a celkovou částku, případně částky záloh a čerpání. Neobsahuje rozpis DPH, způsob platby ani položky.",
        },
        { h3: "POK (potvrzovací kód)" },
        {
          p: `${FACTS.confirmation.summary} Nahrazuje FIK ze staré EET. Technicky jde podle dokumentace o UUID doplněné o pomlčku a dva hexadecimální znaky.`,
        },
        { h3: "Pořadové číslo" },
        {
          p: "Číslo tržby, které přiděluje pokladna (pole **porad_cis**, nejvýše 25 znaků). Při opakovaném odeslání téže tržby zůstává stejné.",
        },
        { h3: "Datum tržby a datum odeslání" },
        {
          p: "Datová zpráva rozlišuje okamžik přijetí platby (pole **dat_trzby**) a okamžik odeslání zprávy (**dat_odesl**). Při výpadku spojení se mohou lišit až o 48 hodin.",
        },
        { h3: "První zaslání" },
        {
          p: "Příznak v hlavičce zprávy (**prvni_zaslani**), který říká, zda pokladna zprávu posílá poprvé, nebo ji opakuje – například po výpadku spojení.",
        },
        { h3: "Pravidlo 48 hodin" },
        {
          p: `${FACTS.offline.summary} Viz [EET bez internetu](/navody/eet-bez-internetu).`,
        },
        { h3: "Ověřovací režim" },
        {
          p: "Příznak v hlavičce datové zprávy (**overeni**), kterým pokladna žádá jen o kontrolu správnosti zprávy, nikoli o skutečnou evidenci tržby. Slouží k testování pokladny; běžné tržby se v něm neposílají.",
        },
        { h3: "Playground (EET2 Playground)" },
        {
          p: "Testovací prostředí Finanční správy pro vývojáře pokladen, zpřístupněné v létě 2026. Zprávy odeslané do Playgroundu nejsou evidencí tržeb. Dokumentace je na [eet.gov.cz pro vývojáře](https://eet.gov.cz/pro-vyvojare/).",
        },
        { h3: "SOAP, XSD, WSDL" },
        {
          p: "Technické standardy rozhraní EET 2.0 pro vývojáře: komunikace probíhá výhradně přes webovou službu SOAP, struktura zprávy je popsaná schématem XSD a služba popisem WSDL. Zprávy se podepisují pokladním certifikátem.",
        },
      ],
    },
    {
      id: "stara-eet",
      heading: "Pojmy ze staré EET, které už neplatí",
      blocks: [
        {
          table: {
            head: ["Pojem", "Co znamenal", "V EET 2.0"],
            rows: [
              ["FIK", "Fiskální identifikační kód od Finanční správy na účtence", "Zrušen, nahrazuje ho POK"],
              ["BKP", "Bezpečnostní kód poplatníka na účtence", "Zrušen"],
              ["PKP", "Podpisový kód poplatníka (offline účtenka)", "Zrušen"],
              ["Účtenka EET", "Povinný doklad s kódy FIK a BKP", "Nepovinná; doklad jen na žádost zákazníka"],
              ["Provozovna (id_provoz)", "Místo, kde se tržby evidovaly", "Nahrazena evidenční jednotkou (id_jednotky)"],
              ["Informační oznámení", "Povinná cedulka v provozovně", "Podle rozborů zákona odpadá"],
            ],
          },
        },
        {
          p: "Podrobné srovnání najdete v článku [EET 2.0 vs stará EET](/navody/eet-2-0-vs-eet-1-0).",
        },
        { cta: "kviz" },
      ],
    },
  ],
  faq: [
    {
      q: "Co znamená POK?",
      a: "Potvrzovací kód. Finanční správa ho vrátí na každou přijatou datovou zprávu o tržbě a potvrzuje jím, že tržba byla zaevidována. Nahrazuje FIK ze staré EET.",
    },
    {
      q: "Co je EIČ?",
      a: "Identifikátor poplatníka v evidenci tržeb – typicky DIČ, případně rodné číslo nebo jiné číslo přidělené správcem daně. Je uvedený v pokladním certifikátu i v každé datové zprávě.",
    },
    {
      q: "Jaký je rozdíl mezi pilotním a ostrým provozem?",
      a: "Pilotní provoz v lednu 2027 je podle Finanční správy dobrovolný a slouží k vyzkoušení pokladen. Ostrý provoz od 1. 2. 2027 znamená plnou povinnost evidovat.",
    },
    {
      q: "Co je DIS+?",
      a: "Daňová informační schránka plus na portálu MOJE daně. Od 1. 11. 2026 v ní najdete funkce EET 2.0: přihlášení k evidenci, evidenční jednotky a pokladní certifikáty.",
    },
  ],
  sources: [
    SOURCES.harmonogram,
    SOURCES.jakZacit,
    SOURCES.prakticke,
    SOURCES.vyvojari,
    SOURCES.fsPlayground,
    SOURCES.caeetPostupy,
    SOURCES.eetOff,
    SOURCES.mojeEet,
    SOURCES.prezident,
  ],
  related: ["eet-2-0-kompletni-pruvodce", "eet-2-0-vs-eet-1-0", "evidencni-jednotka"],
  published: "2026-10-01",
  updated: "2026-10-01",
  reviewedBy: null,
};
