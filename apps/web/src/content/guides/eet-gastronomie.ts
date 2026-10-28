import { FACTS, SOURCES, formatKc, timelineAt } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

const DIS = timelineAt("2026-11-01");

/**
 * S1 (15. 10. 2026): návod pro gastro – v audit chyběl (M3). Koncept před odbornou revizí (Ф9): reviewedBy null = noindex.
 * Rozvoz bez výslovného stanoviska FS = „zatím není jisté“ + doporučení probrat s účetní.
 * S6-FS (28. 10. 2026): spropitné podle prezentace MF a FS pro vývojáře (SOURCES.seminarVyvojari, slajdy „Spropitné“
 * a „Osvobození spropitného v ZDP“).
 */
export const eetGastronomie: Guide = {
  slug: "eet-gastronomie",
  category: "obory",
  title: "EET 2.0 v gastronomii: restaurace, kavárny a bistra",
  h1: "EET 2.0 v gastronomii",
  description:
    "Restaurace, kavárna, bistro i food truck evidují od 1. 1. 2027 platby hostů na místě. Stravenky, spropitné, rozvoz, závodní jídelna a účtenka v EET 2.0.",
  lead:
    "Restaurace, kavárny, bistra a food trucky evidují od **1. 1. 2027** všechny platby, které host zaplatí na místě: hotově, kartou, QR kódem i stravenkou. Neevidují se objednávky zaplacené předem online a obědy pro vlastní zaměstnance. Účtenku vydáváte jen tehdy, když o ni host požádá.",
  summary: [
    "Hotovost, karta, QR platba i stravenka zaplacené na místě se evidují.",
    "Rozvoz zaplacený předem přes web nebo aplikaci se neeviduje, platba kurýrovi při předání ano.",
    "Jídla pro vlastní zaměstnance a školní stravování zákon z evidence vyjímá (§ 12).",
    "Restaurace je stálá provozovna, food truck mobilní provozovna nebo dopravní prostředek.",
    "Bez signálu prodáváte dál – tržbu odešlete nejpozději do 48 hodin.",
  ],
  sections: [
    {
      id: "co-se-eviduje",
      heading: "Co se v restauraci eviduje a co ne",
      blocks: [
        {
          table: {
            head: ["Situace", "Eviduje se?"],
            rows: [
              ["Host platí u stolu nebo u baru hotově, kartou nebo QR kódem", "**Ano**"],
              ["Host platí papírovou stravenkou nebo stravenkovou kartou", "**Ano**"],
              ["Hosté platí každý zvlášť", "**Ano**, každá platba zvlášť"],
              ["Jídlo s sebou zaplacené u pultu", "**Ano**"],
              ["Rozvoz: kurýr převezme hotovost nebo platbu kartou u dveří", "**Ano**"],
              ["Rozvoz nebo „vyzvednutí“ zaplacené předem na webu či v aplikaci", "Ne"],
              ["Firemní akce nebo catering zaplacený převodem na fakturu", "Ne"],
              ["Obědy pro vlastní zaměstnance", "Ne (§ 12)"],
            ],
            caption: "Rozhoduje, zda host platí při osobním kontaktu nebo ve vaší provozovně, ne způsob platby.",
          },
        },
        { p: FACTS.evidenced.prepayments },
        {
          p: "Datová zpráva neobsahuje položky, sazby DPH ani způsob platby – jen celkovou částku, datum, evidenční jednotku a pořadové číslo. Hraniční případy rozebírá návod [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "jednotky",
      heading: "Restaurace, zahrádka, food truck: evidenční jednotky",
      blocks: [
        { p: FACTS.units.summary },
        {
          ul: [
            "Restaurace, kavárna nebo bistro je **stálá provozovna**. Zahrádka nebo terasa patří k ní.",
            "Zákon dovoluje oznámit i **samostatnou funkční část** provozovny, třeba bar a restauraci pod jednou střechou zvlášť.",
            "Food truck nebo stánek na festivalu je **mobilní provozovna**; vůz, ze kterého prodáváte, může být i **dopravním prostředkem**.",
            "Rozvoz vlastním kurýrem: platby, které kurýr převezme u zákazníka, patří k jednotce, ze které rozvážíte. Jak přesně je oznámit, Finanční správa zatím podrobně nepopsala.",
          ],
        },
        { p: `Jednotky oznamujete v DIS+ od **${DIS.dateLabel}**. ${FACTS.units.change}` },
        { note: FACTS.units.allUnits, tone: "warn" },
        { cta: "jednotky" },
      ],
    },
    {
      id: "stravenky",
      heading: "Stravenky a poukazy",
      blocks: [
        {
          p: "Platba papírovou stravenkou nebo poukázkou, kterou vydala jiná firma, je běžná evidovaná platba – eviduje se v den, kdy ji host u vás uplatní. Stravenková karta se v terminálu chová jako platební karta a eviduje se také.",
        },
        {
          p: "Jinak je to u vlastního **dárkového poukazu** na konkrétní jídlo nebo menu: eviduje se jen jeho prodej, samotné uplatnění poukazu už ne.",
        },
      ],
    },
    {
      id: "spropitne",
      heading: "Spropitné",
      blocks: [
        {
          p: "Ministerstvo financí a Finanční správa v prezentaci k EET 2.0 vysvětlují, že u spropitného rozhoduje, **čí je to příjem**. Když je spropitné příjmem z podnikání – host ho dává restauraci nebo číšníkovi, který je OSVČ –, je evidovanou tržbou a eviduje ho ten, komu spropitné patří. Když je příjmem zaměstnance (číšníka, kuchaře), evidenci nepodléhá. Evidovat ho ale lze dobrovolně, například kvůli osvobození na straně zaměstnance.",
        },
        {
          p: "Pokladna, která spropitné zadané u platby kartou eviduje spolu s platbou, tak postupuje správně v obou případech: u spropitného podniku nebo OSVČ je to povinné, u spropitného zaměstnanců dobrovolné.",
        },
        { h3: "Osvobození spropitného zaměstnanců od daně" },
        {
          stats: [
            { value: "7 %", label: "měsíčních tržeb restaurace", note: "strop pro všechny zaměstnance dohromady" },
            { value: "70 000 Kč", label: "osvobozené spropitné při tržbách 1 000 000 Kč", note: "příklad Ministerstva financí" },
          ],
        },
        {
          p: "Zákon č. 180/2026 Sb. zároveň od 1. 1. 2027 mění daň z příjmů: **spropitné ze stravovacích služeb**, které dostane zaměstnanec, je osvobozené až do **7 %** měsíčních příjmů podniku ze stravovacích služeb (rozpočítaných na zaměstnance, kteří spropitné dostali). Za plátce tohoto příjmu se považuje zaměstnavatel.",
        },
        {
          ul: [
            "**Jen zaměstnanci.** Spropitné majitele ani OSVČ osvobozené není.",
            "**Jen tam, kde se jí na místě.** Neplatí pro stánky, food trucky ani prodej přes okénko („take away“).",
            "**Limit pro celý podnik.** 7 % z měsíčních tržeb restaurace platí pro všechny zaměstnance dohromady, ne pro každého číšníka zvlášť. Při tržbách 1 000 000 Kč za měsíc může být osvobozeno až 70 000 Kč spropitného; zbytek se zdaní běžně.",
            "**Jen dobrovolné spropitné.** Neplatí pro povinné poplatky typu couvert ani pro servisní přirážku.",
            "**Hotovost i karta.** Nezáleží na tom, zda host nechá spropitné v hotovosti, nebo ho připíše k platbě kartou – i když projde přes účet provozovny.",
            "**Přehled o spropitném.** Restaurace jako plátce musí mít přehled o tom, kolik spropitného zaměstnanci dostali.",
          ],
        },
        {
          note: "Jak spropitné účtovat, zdanit a rozdělovat mezi zaměstnance, proberte s účetní nebo daňovým poradcem.",
          tone: "info",
        },
      ],
    },
    {
      id: "rozvoz",
      heading: "Rozvoz a objednávky přes aplikace",
      blocks: [
        {
          ul: [
            "Objednávka zaplacená předem přes web, aplikaci nebo platební bránu je **vzdálená platba** – neeviduje se.",
            "Vlastní kurýr převezme hotovost nebo platbu kartou u zákazníka – to je **kontaktní platba** a evidujete ji vy.",
            "Kurýr rozvozové platformy převezme hotovost: kdo tržbu eviduje, záleží na smlouvě s platformou – zda jedná vaším jménem, nebo svým jménem na váš účet.",
          ],
        },
        {
          p: "Pro poslední případ zákon počítá s **nepřímým zastoupením** (§ 9) a s **pověřením** jiného podnikatele (§ 10). Jak funguje pověření, popisuje návod [Tržba za jiného v EET 2.0](/navody/trzba-za-jineho). Smluvní podmínky platformy si ověřte u ní.",
        },
      ],
    },
    {
      id: "vyjimky",
      heading: "Závodní jídelna, školní stravování, automaty",
      blocks: [
        {
          ul: [
            "**Jídla pro vlastní zaměstnance** – tržby ze vztahu souvisejícího s pracovněprávním vztahem k vám se neevidují (§ 12 odst. 1 písm. b). Hosté zvenku, kteří v jídelně platí, se ale evidují.",
            "**Školní jídelny** – stravování dětí, žáků a studentů, které poskytuje škola nebo školské zařízení, se neeviduje (§ 12 odst. 1 písm. c).",
            "**Prodejní automat** na kávu nebo občerstvení, který je samostatnou provozovnou, se neeviduje (§ 13 odst. 2).",
          ],
        },
        { p: FACTS.whoMust.occasional },
      ],
    },
    {
      id: "provoz",
      heading: "Provoz: více pokladen, výpadek signálu, účtenka",
      blocks: [
        { p: FACTS.certificate.summary },
        { p: FACTS.offline.summary },
        {
          p: "Prakticky: při výpadku Wi-Fi nebo mobilních dat obsluhujte dál, pokladna tržby uloží a odešle je, jakmile se připojí. Pokladnu po výpadku nezavírejte a neodinstalovávejte, dokud nejsou všechny tržby odeslané. Podrobně v návodu [EET bez internetu](/navody/eet-bez-internetu).",
        },
        { h3: "Účtenka" },
        { p: FACTS.receipt.summary },
        { p: FACTS.confirmation.onReceipt },
        { h3: "EET OFF pro malé paušalisty" },
        {
          p: `Fyzická osoba v ${FACTS.eetOff.band}. pásmu paušálního režimu s příjmy ze samostatné činnosti do ${formatKc(FACTS.eetOff.incomeLimit)} ročně může místo evidence platit přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně. Oznámení pro rok 2027 podáte do **${FACTS.eetOff.deadline}**.`,
        },
        { cta: "eet-off" },
      ],
    },
  ],
  faq: [
    {
      q: "Eviduje se platba stravenkou?",
      a: "Ano. Platba stravenkou nebo poukázkou vydanou jinou firmou je běžná evidovaná platba, stravenková karta se eviduje jako platba kartou.",
    },
    {
      q: "Eviduje se rozvoz jídla?",
      a: "Objednávka zaplacená předem online se neeviduje. Platbu, kterou při předání převezme váš kurýr, evidujete. U kurýrů platforem záleží na smlouvě – viz návod Tržba za jiného.",
    },
    {
      q: "Musím evidovat obědy pro své zaměstnance?",
      a: "Ne. Tržby ze vztahu souvisejícího s pracovněprávním vztahem k vám zákon z evidence vyjímá (§ 12). Platby hostů zvenku ale evidujete.",
    },
    {
      q: "Eviduje se spropitné?",
      a: "Záleží na tom, čí je to příjem. Spropitné pro restauraci nebo pro číšníka, který je OSVČ, je evidovanou tržbou. Spropitné, které je příjmem zaměstnance, evidenci nepodléhá, evidovat ho ale lze dobrovolně. Daňové zacházení proberte s účetní.",
    },
    { q: "Musím hostům vydávat účtenky?", a: FACTS.receipt.summary },
    {
      q: "Co když v restauraci vypadne internet?",
      a: FACTS.offline.summary,
    },
  ],
  howTo: {
    name: "Jak připravit restauraci na EET 2.0",
    description: "Od oznámení provozovny v DIS+ po první evidovanou tržbu.",
    steps: [
      { name: "Přihlaste se v DIS+", text: `Od ${DIS.dateLabel} se v DIS+ na portálu MOJE daně přihlaste k evidenci tržeb.` },
      { name: "Oznamte provozovny", text: "Oznamte restauraci, případně samostatné části, food truck nebo stánek jako evidenční jednotky." },
      { name: "Vygenerujte certifikát", text: "Pokladní certifikát vygenerujete zdarma v DIS+ a nahrajete ho do všech pokladen." },
      { name: "Proškolte obsluhu", text: "Ukažte obsluze, co se eviduje (stravenky ano, obědy zaměstnanců ne) a co dělat při výpadku signálu." },
      { name: "Evidujte od 1. 1. 2027", text: "Každou platbu hosta na místě evidujte nejpozději při jejím přijetí, při výpadku do 48 hodin." },
    ],
  },
  sources: [
    SOURCES.zakonUplne,
    SOURCES.sbirka,
    SOURCES.kdoMusi,
    SOURCES.seminarVyvojari,
    SOURCES.jakZacit,
    SOURCES.prakticke,
    SOURCES.fsFaq,
    SOURCES.eetOff,
    SOURCES.prezident,
    SOURCES.zos,
    SOURCES.zdp,
  ],
  related: ["spropitne-a-eet", "kontaktni-platba", "trzba-za-jineho", "eet-bez-internetu"],
  published: "2026-10-15",
  updated: "2026-10-28",
  changelog: [
    {
      date: "2026-10-28",
      text: "Spropitné doplněno podle prezentace Ministerstva financí a Finanční správy: kdy se eviduje a za jakých podmínek je u zaměstnanců osvobozené.",
    },
    { date: "2026-10-17", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-15", text: "Koncept návodu – před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
