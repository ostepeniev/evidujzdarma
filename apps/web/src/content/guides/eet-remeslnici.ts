import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const eetRemeslnici: Guide = {
  slug: "eet-remeslnici",
  category: "obory",
  title: "EET 2.0 pro řemeslníky a služby mimo provozovnu",
  h1: "EET pro řemeslníky a služby mimo provozovnu",
  description:
    "Instalatér, elektrikář, malíř, masér nebo lektor u klienta: kdy od 1. 1. 2027 evidovat tržbu v EET 2.0, kdy stačí faktura a co se zálohou na materiál.",
  lead:
    "Řemeslník eviduje od **1. 1. 2027** jen to, co mu zákazník zaplatí na místě – hotově, kartou do mobilního terminálu nebo QR kódem z jeho telefonu. Faktura uhrazená převodem se neeviduje. Kdo nemá provozovnu, uvede v DIS+ jako evidenční jednotku sám sebe. Bez signálu má na odeslání **48 hodin**.",
  summary: [
    "Platba u zákazníka hotově, kartou nebo QR kódem se eviduje; faktura uhrazená převodem ne.",
    "Bez provozovny je evidenční jednotkou podnikatel sám – jedna jednotka pro všechny zakázky.",
    "Záloha na materiál zaplacená na místě se eviduje jako běžná platba, doplatek při vyúčtování také.",
    "V místech bez signálu (sklep, novostavba) lze tržbu odeslat dodatečně, nejpozději do 48 hodin.",
    `Malí paušalisté se mohou evidenci vyhnout přes EET OFF za ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně.`,
  ],
  sections: [
    {
      id: "kdy-evidovat",
      heading: "Kdy řemeslník eviduje a kdy ne",
      blocks: [
        {
          p: "Pro řemeslníky a služby u klienta (instalatér, elektrikář, malíř, zahradník, opravář spotřebičů, masér, fotograf, lektor, doučování…) platí stejné pravidlo jako pro všechny: eviduje se **kontaktní platba** – peníze přijaté při osobním kontaktu se zákazníkem. Nezáleží na tom, zda je zákazník občan, nebo firma.",
        },
        {
          table: {
            head: ["Situace", "Evidovat?"],
            rows: [
              ["Po opravě zákazník zaplatí hotově", "**Ano**"],
              ["Zákazník zaplatí kartou do vašeho mobilního terminálu", "**Ano**"],
              ["Zákazník naskenuje QR kód z vašeho telefonu a hned zaplatí", "**Ano**"],
              ["Vystavíte fakturu, zákazník ji za týden uhradí převodem", "Ne"],
              ["Zákazník zaplatí QR kód z faktury doma večer", "Ne"],
              ["Firma (B2B) vám na stavbě zaplatí hotově", "**Ano**"],
            ],
            caption: "Rozhoduje okolnost platby, ne zda vystavujete fakturu.",
          },
        },
        {
          note: "Faktura sama o sobě evidenci nevylučuje. Pokud k faktuře zákazník zaplatí na místě hotově nebo kartou, tržbu evidujete. Neevidujete jen platby, které zákazník posílá vzdáleně.",
          tone: "warn",
        },
      ],
    },
    {
      id: "jednotka",
      heading: "Evidenční jednotka: vy sami",
      blocks: [
        {
          p: "Řemeslník, který jezdí za zákazníky, nemá kamennou provozovnu, kde by přijímal platby. V DIS+ proto uvede jako evidenční jednotku **sám sebe**. Jedna jednotka pokryje všechny zakázky, ať pracujete kdekoli.",
        },
        {
          p: "Pokud máte i dílnu nebo prodejnu, kam za vámi zákazníci chodí platit, oznámíte ji jako stálou provozovnu. Podrobnosti v návodu [Evidenční jednotka](/navody/evidencni-jednotka) a orientační počet jednotek zjistí [průvodce evidenčními jednotkami](/evidencni-jednotky).",
        },
      ],
    },
    {
      id: "zalohy",
      heading: "Zálohy na materiál",
      blocks: [
        { p: FACTS.evidenced.prepayments },
        {
          table: {
            head: ["Krok", "Co evidovat"],
            rows: [
              ["Zákazník vám při prohlídce dá 5 000 Kč hotově na materiál", "Tržba 5 000 Kč"],
              ["Po dokončení vyúčtujete 12 000 Kč, zákazník doplatí 7 000 Kč hotově", "Tržba 7 000 Kč"],
              ["Záloha 5 000 Kč přišla převodem na účet", "Neevidujete; evidujete jen doplatek zaplacený na místě"],
            ],
            caption: "Ilustrační příklad. Záloha a doplatek jsou dvě samostatné běžné platby, v datové zprávě se nijak nepropojují.",
          },
        },
      ],
    },
    {
      id: "signal",
      heading: "Práce bez signálu",
      blocks: [
        {
          p: `Sklepy, novostavby, chaty, vesnice s pokrytím „na jednu čárku“ – řemeslníci narážejí na výpadky signálu často. ${FACTS.offline.summary}`,
        },
        {
          p: "Pokladna musí umět tržbu bez signálu uložit a odeslat ji, jakmile se spojení obnoví. Státní aplikace MOJE eet podle zveřejněných informací potřebuje připojení k internetu; pokladna EvidujZdarma tržby bez signálu ukládá do fronty a odešle je automaticky. Více v návodu [EET bez internetu](/navody/eet-bez-internetu).",
        },
        { cta: "registrace" },
      ],
    },
    {
      id: "stavby-a-subdodavky",
      heading: "Stavby, subdodávky a spolupráce s jinými řemeslníky",
      blocks: [
        {
          p: "Mezi firmami se většinou platí fakturou a převodem – takové platby se neevidují. Evidenci ale nevylučuje to, že je zákazník podnikatel: když vám stavbyvedoucí nebo jiný řemeslník zaplatí na stavbě hotově, jde o kontaktní platbu a evidujete ji.",
        },
        {
          p: "Pokud na zakázce spolupracujete s kolegou a peníze od zákazníka vybírá jen jeden z vás, ujasněte si, čí je to tržba. Buď ji celou eviduje ten, kdo zakázku fakturuje zákazníkovi (a kolegovi pak zaplatí na fakturu), nebo může jeden evidovat za druhého v pověření – viz [Tržba za jiného](/navody/trzba-za-jineho).",
        },
      ],
    },
    {
      id: "jak-zacit",
      heading: "Jak se připravit",
      blocks: [
        {
          ol: [
            "Projděte, jak vám zákazníci platí. Pokud jen převodem na fakturu, evidovat nemusíte nic.",
            "Pokud jste OSVČ v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč a hotovost berete jen výjimečně, zvažte [EET OFF](/navody/eet-off) – rozhodnutí do **11. 1. 2027**.",
            "Od **1. 11. 2026** se přihlaste v DIS+, oznamte jednotku (sebe) a vygenerujte certifikát – [postup](/navody/jak-aktivovat-dis-a-certifikat).",
            "Nainstalujte si pokladnu do mobilu a v prosinci 2026 ji vyzkoušejte v testovacím režimu. Od 1. 1. 2027 už evidujete naostro – „pilotní“ leden není zákonná výjimka.",
            "Rozmyslete si, jaké platby budete přijímat: hotovost, karta i QR kód na místě se evidují stejně, faktura s pozdější úhradou převodem ne.",
          ],
        },
        {
          p: "Pro rychlé QR kódy pro platbu na účet můžete využít náš [nástroj QR platba](/qr-platba).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Jsem instalatér a vystavuji faktury. Musím evidovat?",
      a: "Jen platby, které od zákazníka přijmete na místě (hotově, kartou, QR kódem z vašeho telefonu). Faktury uhrazené převodem z účtu se neevidují.",
    },
    {
      q: "Nemám provozovnu. Co uvedu jako evidenční jednotku?",
      a: "Sám sebe. Podnikatel bez provozovny uvede v DIS+ jako evidenční jednotku vlastní osobu – jedna jednotka pro všechny zakázky.",
    },
    {
      q: "Zákazník mi dal zálohu na materiál v hotovosti. Eviduje se?",
      a: "Ano, jako běžnou platbu. Doplatek při vyúčtování pak evidujete jako další samostatnou platbu.",
    },
    {
      q: "Co když u zákazníka není signál?",
      a: "Prodejte normálně a tržbu odešlete, jakmile se spojení obnoví – nejpozději do 48 hodin od přijetí platby.",
    },
    {
      q: "Platí to i pro maséry, lektory a fotografy?",
      a: "Ano. Pravidla jsou stejná pro všechny služby poskytované mimo provozovnu: evidujete platby přijaté osobně, ne převody na fakturu.",
    },
  ],
  sources: [SOURCES.mfPredstavuje, SOURCES.kdoMusi, SOURCES.danovkyKontaktni, SOURCES.jakZacit, SOURCES.prakticke, SOURCES.eetOff, SOURCES.mojeEet, SOURCES.seminarVyvojari],
  related: ["kontaktni-platba", "eet-bez-internetu", "evidencni-jednotka"],
  published: "2026-10-01",
  updated: "2026-10-03",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-03", text: "Opraveno podle semináře Finanční správy pro vývojáře: záloha a doplatek jsou dvě běžné platby, dárkový poukaz se eviduje jen při prodeji (jeho uplatnění není platbou) a částku určenou k čerpání a čerpání uvádí pokladna jen u kreditu." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, ne od 1. 2. 2027; test pokladny doporučujeme v prosinci 2026 místo lednového pilotního provozu.",
    },
  ],
  reviewedBy: REVIEWER.name,
};
