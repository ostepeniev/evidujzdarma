/**
 * S4 (23. 10. 2026): stránky „EET pro …“ pro obory s nejvíc kliky z Googlu (eet pro kadeřnice, eet pro bistro,
 * eet restaurace) – rychlá kontrola (otázky → co pro vás platí → plán → předregistrace).
 *
 * Fakta jen z revidovaných návodů eet-kadernictvi-kosmetika a eet-gastronomie (Helena Jeřábková, účetní) a z FACTS.
 * Nic právně nového – kdo chce víc, jde do návodu. Funkce pokladny jen podle nápovědy (content/napoveda/*).
 * O pokladně do 2. 11. 2026 budoucí čas (isClosed("/pokladna")); popisy funkcí bez času jako na úvodní stránce.
 */
import { FACTS, formatKc, timelineAt } from "./facts";
import { getGuide } from "./guides";
import type { IndustrySlug } from "./industries";
import { LANDING_FAQ } from "./landing";
import { isClosed } from "@/lib/launch";

export type CheckTone = "yes" | "maybe" | "no" | "info";

export interface CheckAnswer {
  tone: CheckTone;
  /** **tučně** a [text](odkaz) – RichText */
  text: string;
}

export interface CheckQuestion {
  id: string;
  q: string;
  hint?: string;
  yes?: CheckAnswer;
  no?: CheckAnswer;
  /** odpověď Ne = evidence se vás nejspíš netýká (první otázka) */
  gate?: boolean;
  /** odpověď Ano = do plánu přidat krok EET OFF */
  eetOff?: boolean;
}

export interface OborLanding {
  slug: string;
  industry: IndustrySlug;
  guideSlug: string;
  /** krátký název do drobečkové navigace a odkazů */
  short: string;
  /** „Pokladna pro …“ – tlačítko v katalogu a v návodu */
  posLabel: string;
  /** do nadpisů: „pro váš salon“ / „pro vaše bistro“ … */
  forYour: string;
  title: string;
  description: () => string;
  h1: string;
  lead: string;
  chips: readonly string[];
  pains: readonly { title: string; text: string }[];
  questions: readonly CheckQuestion[];
  features: readonly { title: string; text: string }[];
  fit: { title: string; text: string };
  /** indexy otázek z FAQ návodu (návod prošel revizí) */
  guideFaq: readonly number[];
  /** odkazy dole na stránce; `kind` = štítek karty (výchozí „Nástroj“) */
  tools: readonly { href: string; label: string; text: string; kind?: "Nástroj" | "Návod" | "Služba" }[];
  /** obor v katalogu firem – jen u oborů, které katalog má */
  catalog?: { href: string; label: string };
  /**
   * S12 (22. 11. 2026): vlastní otázky stránky navíc k otázkám z návodu (stejná pravidla: fakta z FACTS a z revidovaných
   * návodů, nejisté = „ověřte“ s odkazem na eet.gov.cz).
   */
  extraFaq?: readonly { q: string; a: string }[];
  /**
   * S12: text stránky ještě neprošel odbornou revizí (Ф8, Ф12) – noindex, mimo sitemap, llms.txt, patičku, katalog
   * a bannery v návodech. Po revizi stačí pole smazat (nebo GUIDES_INDEX_UNREVIEWED=1 jako u návodů).
   */
  pendingReview?: true;
  modified: string;
}

const DIS = timelineAt("2026-11-01");
export const POS_LAUNCH_LABEL = "2. 11. 2026";
const OFF = FACTS.eetOff;

/** Produktové otázky z úvodní stránky (doslovně – jedno místo). */
export const PRODUCT_FAQ = LANDING_FAQ.filter((f) => f.q === "Je pokladna EvidujZdarma opravdu zdarma?" || f.q === "Jste státní aplikace?");

const eetOffYes = (who: string): CheckAnswer => ({
  tone: "maybe",
  text: `${who} může místo evidence zvolit **EET OFF**: přirážku ${formatKc(OFF.surchargeMonthly)} měsíčně (${formatKc(OFF.surchargeYearly)} ročně) k paušální dani. Oznámení se podává do **${OFF.deadline}** a volba platí na celý rok. S pokladnou zdarma rozhoduje hlavně čas – spočítejte si to v [kalkulačce EET OFF](/kalkulacka-eet-off).`,
});
const eetOffNo: CheckAnswer = {
  tone: "info",
  text: `EET OFF je jen pro fyzické osoby v 1. pásmu paušálního režimu s příjmy do ${formatKc(OFF.incomeLimit)} ročně. Platby na místě tedy budete evidovat.`,
};
const notCovered = (who: string): CheckAnswer => ({
  tone: "no",
  text: `Když vám ${who} platí jen převodem na fakturu nebo předem online přes platební bránu, jde o vzdálené platby a ty se neevidují. Evidence se vás pak nejspíš netýká – jistotu dá [kvíz Musím evidovat?](/musim-evidovat).`,
});

const KADERNICE: OborLanding = {
  slug: "kadernice",
  industry: "kadernictvi-a-kosmetika",
  guideSlug: "eet-kadernictvi-kosmetika",
  short: "EET pro kadeřnice",
  posLabel: "Pokladna pro kadeřnictví zdarma",
  forYour: "pro váš salon",
  title: "EET pro kadeřnice 2027: co evidovat a pokladna zdarma",
  description: () =>
    `Kadeřnictví, kosmetika i barbershop: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – poukazy, pronájem křesla, EET OFF – ${isClosed("/pokladna") ? "a předregistrujete pokladnu zdarma" : "a začnete evidovat zdarma"}.`,
  h1: "EET pro kadeřnice, kosmetičky a barbery",
  lead: "Od **1. 1. 2027** evidujete každou platbu klientky na místě – hotovost, kartu i QR kód, služby i prodej kosmetiky. Odpovězte na pět krátkých otázek a hned uvidíte, co z toho platí pro váš salon a co udělat od 1. listopadu.",
  chips: ["Salon", "Pronájem křesla", "Mobilní kadeřnice", "Kosmetika a nehty"],
  pains: [
    { title: "Eviduje se i karta a QR", text: "Nejen hotovost: každá platba klientky na místě – kartou i QR kódem – se od 1. 1. 2027 eviduje." },
    { title: "Poukaz jen při prodeji", text: "Dárkový poukaz evidujete, když ho prodáte. Při jeho uplatnění evidujete jen případný doplatek." },
    { title: "Pronajaté křeslo = vlastní evidence", text: "Kadeřnice na pronajatém křesle eviduje své tržby sama – ve své pokladně a se svým certifikátem." },
    { title: "Účtenka jen na požádání", text: "EET 2.0 účtenku nepřikazuje. Když o ni klientka požádá, vydáte doklad – podle běžného výkladu i elektronicky." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám klientky na místě – hotově, kartou nebo QR kódem?",
      gate: true,
      yes: {
        tone: "yes",
        text: "Tyto platby od **1. 1. 2027** evidujete – služby (střih, barvení, manikúra, ošetření) i prodej kosmetiky. Záloha zaplacená předem online přes platební bránu rezervačního systému se neeviduje.",
      },
      no: notCovered("klientky"),
    },
    {
      id: "pausal",
      q: "Jste OSVČ v 1. pásmu paušální daně s příjmy do 1 mil. Kč ročně?",
      hint: "Pokud si nejste jistá, odpovězte Ne.",
      eetOff: true,
      yes: eetOffYes("Kadeřnice nebo kosmetička v 1. pásmu paušálu"),
      no: eetOffNo,
    },
    {
      id: "kreslo",
      q: "Pracujete na pronajatém křesle, nebo křesla v salonu pronajímáte?",
      yes: {
        tone: "info",
        text: "Každá OSVČ eviduje své tržby **sama** – ve vlastní pokladně a se svým pokladním certifikátem. Platí-li všichni klienti u jednoho pultu do jedné kasy, je potřeba dohoda o [pověření](/navody/trzba-za-jineho), nebo služby prodává majitelka salonu jako své. Nejjednodušší je, když má každá kadeřnice vlastní pokladnu v mobilu a klienti platí přímo jí.",
      },
    },
    {
      id: "poukazy",
      q: "Prodáváte dárkové poukazy?",
      yes: {
        tone: "info",
        text: "Poukaz evidujete jen **při prodeji** na místě. Když ho obdarovaná uplatní, evidujete jen případný doplatek – samotné uplatnění poukazu není platbou. Poukaz koupený online přes platební bránu se neeviduje ani při prodeji.",
      },
    },
    {
      id: "mobilni",
      q: "Jezdíte za klientkami domů, do domovů seniorů nebo na svatby?",
      yes: {
        tone: "info",
        text: `Bez provozovny uvedete v DIS+ jako evidenční jednotku **sama sebe**. U klientky bez signálu prodáváte dál a tržbu odešlete nejpozději do ${FACTS.offline.hours} hodin – viz [EET bez internetu](/navody/eet-bez-internetu).`,
      },
    },
  ],
  features: [
    { title: "Pokladna v mobilu", text: "Stačí telefon, tablet nebo počítač, který už máte. Platbu kartou provedete na svém terminálu jako dosud." },
    { title: "Střih na jedno klepnutí", text: "Služby a kosmetiku si uložíte jako rychlá tlačítka s cenou. Prodej je hotový za pár vteřin, tlačítka fungují i bez signálu." },
    { title: "Poukazy a spropitné", text: "Tlačítko Dárkový pro uplatněný poukaz, rozdělená platba pro doplatek a pole pro spropitné u platby kartou." },
    { title: "Každá kadeřnice svůj PIN", text: "Až 5 uživatelů zdarma, každý s vlastním PINem. Vy vidíte všechny tržby a denní přehled." },
    { title: "I bez signálu", text: "U klientky doma prodáváte dál – pokladna tržby uloží a odešle je sama, jakmile se připojí." },
    { title: "Účtenka do mobilu", text: "Když o ni klientka požádá: e-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Rezervace termínů ani věrnostní program nemáme – na to vám dál poslouží váš rezervační systém. EvidujZdarma ho doplní o evidenci tržeb zdarma.",
  },
  guideFaq: [0, 1, 2, 3, 4],
  tools: [
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
    { href: "/kalkulacka-spropitne", label: "Kalkulačka spropitného", text: "Kolik dát nebo dostat spropitné." },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/musim-evidovat", label: "Kvíz: Musím evidovat?", text: "Šest otázek, jasná odpověď." },
  ],
  catalog: { href: "/obor/kadernictvi-a-kosmetika/kraj/karlovarsky", label: "Kadeřnictví a kosmetika v Karlovarském kraji" },
  modified: "2026-10-23",
};

const BISTRO: OborLanding = {
  slug: "bistro",
  industry: "restaurace-a-kavarny",
  guideSlug: "eet-gastronomie",
  short: "EET pro bistro",
  posLabel: "Pokladna pro bistro zdarma",
  forYour: "pro vaše bistro",
  title: "EET pro bistro a kavárnu: co evidovat a pokladna zdarma",
  description: () =>
    `Bistro, kavárna i food truck: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – stravenky, rozvoz, festivaly, EET OFF – ${isClosed("/pokladna") ? "a předregistrujete pokladnu zdarma" : "a začnete evidovat zdarma"}.`,
  h1: "EET pro bistro, kavárnu a food truck",
  lead: "Od **1. 1. 2027** evidujete každou platbu hosta na místě – hotovost, kartu, QR kód i stravenku, také jídlo s sebou. Odpovězte na pět krátkých otázek a uvidíte, co platí pro váš podnik a co udělat od 1. listopadu.",
  chips: ["Bistro", "Kavárna", "Food truck", "Jídlo s sebou"],
  pains: [
    { title: "Stravenky se evidují", text: "Papírová stravenka i stravenková karta jsou běžná evidovaná platba – v den, kdy je host u vás uplatní." },
    { title: "Online předem ne", text: "Objednávka zaplacená předem přes web nebo aplikaci se neeviduje. Platbu kurýrovi u dveří evidujete." },
    { title: "Food truck je jednotka", text: "Vůz nebo stánek na festivalu je mobilní provozovna – oznámíte ho v DIS+ jako evidenční jednotku." },
    { title: "Bez signálu prodáváte dál", text: `Při výpadku spojení obsluhujete dál a tržbu odešlete nejpozději do ${FACTS.offline.hours} hodin.` },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám hosté u pultu nebo u okénka – hotově, kartou, QR kódem či stravenkou?",
      gate: true,
      yes: { tone: "yes", text: "Každou takovou platbu od **1. 1. 2027** evidujete – i jídlo s sebou a stravenky. Platí-li hosté každý zvlášť, eviduje se každá platba zvlášť." },
      no: notCovered("hosté"),
    },
    {
      id: "online",
      q: "Berete objednávky předem přes web nebo rozvozovou aplikaci?",
      yes: {
        tone: "info",
        text: "Objednávka zaplacená předem online je vzdálená platba a **neeviduje se**. Platbu, kterou při předání převezme váš kurýr, evidujete. U kurýrů rozvozových platforem záleží na smlouvě s platformou – viz [Tržba za jiného](/navody/trzba-za-jineho).",
      },
    },
    {
      id: "food-truck",
      q: "Prodáváte i z food trucku nebo na festivalech?",
      yes: {
        tone: "info",
        text: `Food truck nebo stánek je **mobilní provozovna**, vůz, ze kterého prodáváte, může být i dopravním prostředkem. Oznámíte ho v DIS+ jako evidenční jednotku – od ${DIS.dateLabel}. Bez signálu prodáváte dál a tržby odešlete do ${FACTS.offline.hours} hodin.`,
      },
    },
    {
      id: "zamestnanci",
      q: "Vaříte i pro vlastní zaměstnance?",
      yes: { tone: "info", text: "Jídla pro vlastní zaměstnance se **neevidují** (§ 12). Platby hostů zvenku ale evidujete." },
    },
    {
      id: "pausal",
      q: "Jste OSVČ v 1. pásmu paušální daně s příjmy do 1 mil. Kč ročně?",
      hint: "Pokud si nejste jistí, odpovězte Ne.",
      eetOff: true,
      yes: eetOffYes("Fyzická osoba v 1. pásmu paušálu"),
      no: eetOffNo,
    },
  ],
  features: [
    { title: "Káva na jedno klepnutí", text: "Espresso, polévku nebo menu si uložíte jako rychlá tlačítka s cenou. Tlačítka fungují i bez signálu." },
    { title: "Stravenky i doplatek", text: "Hotovost, karta, QR, stravenka. Když host doplácí ke stravence hotově, platbu rozdělíte." },
    { title: "Směna s PINem", text: "Až 5 uživatelů zdarma, každý s vlastním PINem. Vy vidíte všechny tržby a denní přehled." },
    { title: "Uzávěrka a hotovost", text: "Denní uzávěrka, vklad a výběr hotovosti z kasy a export pro účetní." },
    { title: "I bez signálu", text: "Ve food trucku na festivalu prodáváte dál – pokladna tržby odešle sama, jakmile se připojí." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Bony do kuchyně, sklad surovin a napojení na rozvozové aplikace nemáme – na to jsou placené gastro pokladny. EvidujZdarma je pro podniky, kde host platí hned u pultu nebo u okénka.",
  },
  guideFaq: [0, 1, 2, 4, 5],
  tools: [
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
    { href: "/kalkulacka-spropitne", label: "Kalkulačka spropitného", text: "Kolik dát nebo dostat spropitné." },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/musim-evidovat", label: "Kvíz: Musím evidovat?", text: "Šest otázek, jasná odpověď." },
  ],
  catalog: { href: "/obor/restaurace-a-kavarny/kraj/karlovarsky", label: "Restaurace a kavárny v Karlovarském kraji" },
  modified: "2026-10-23",
};

const RESTAURACE: OborLanding = {
  slug: "restaurace",
  industry: "restaurace-a-kavarny",
  guideSlug: "eet-gastronomie",
  short: "EET pro restaurace",
  posLabel: "Pokladna pro restaurace zdarma",
  forYour: "pro vaši restauraci",
  title: "EET pro restaurace 2027: co evidovat a pokladna zdarma",
  description: () =>
    `Restaurace a hospody: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – stravenky, spropitné, zahrádka, catering – ${isClosed("/pokladna") ? "a předregistrujete pokladnu zdarma" : "a začnete evidovat zdarma"}.`,
  h1: "EET pro restaurace",
  lead: "Od **1. 1. 2027** evidujete každou platbu hosta u stolu i u baru – hotovost, kartu, QR kód i stravenku. Odpovězte na pět krátkých otázek a uvidíte, co platí pro vaši restauraci a co udělat od 1. listopadu.",
  chips: ["Restaurace", "Hospoda", "Bar", "Zahrádka"],
  pains: [
    { title: "Každý host zvlášť", text: "Když hosté platí každý sám, eviduje se každá platba zvlášť." },
    { title: "Spropitné: osvobození až 7 %", text: "Od 1. 1. 2027 je spropitné zaměstnanců osvobozené až do 7 % měsíčních tržeb restaurace – jen tam, kde hosté jedí na místě." },
    { title: "Zahrádka patří k provozovně", text: "Bar a restauraci pod jednou střechou můžete oznámit jako samostatné funkční části." },
    { title: "Obědy zaměstnanců ne", text: "Jídla pro vlastní zaměstnance zákon z evidence vyjímá (§ 12). Hosté zvenku se evidují." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí hosté u stolu nebo u baru hotově, kartou, QR kódem či stravenkou?",
      gate: true,
      yes: { tone: "yes", text: "Evidujete každou takovou platbu od **1. 1. 2027**. Platí-li hosté každý zvlášť, eviduje se každá platba zvlášť." },
      no: notCovered("hosté"),
    },
    {
      id: "spropitne",
      q: "Nechávají vám hosté spropitné na kartě?",
      yes: {
        tone: "info",
        text: "Záleží na tom, čí je spropitné příjem. Spropitné pro restauraci nebo pro číšníka, který je OSVČ, je evidovanou tržbou. Spropitné, které je příjmem zaměstnance, evidenci nepodléhá, evidovat ho ale lze dobrovolně – pokladna ho tak může evidovat spolu s platbou kartou. Od **1. 1. 2027** je spropitné zaměstnanců osvobozené od daně až do **7 %** měsíčních tržeb restaurace (jen u jídla na místě, ne u take away). Daňové zacházení proberte s účetní.",
      },
    },
    {
      id: "jednotky",
      q: "Máte bar a restauraci pod jednou střechou, zahrádku nebo víc provozoven?",
      yes: {
        tone: "info",
        text: `Zahrádka nebo terasa patří k provozovně. Bar a restauraci můžete oznámit jako **samostatné funkční části**. Každou evidenční jednotku oznámíte v DIS+ od ${DIS.dateLabel} – pomůže [průvodce evidenčními jednotkami](/evidencni-jednotky).`,
      },
    },
    {
      id: "akce",
      q: "Pořádáte firemní akce nebo catering na fakturu?",
      yes: {
        tone: "info",
        text: "Akce nebo catering zaplacený převodem na fakturu se **neeviduje**. Záloha a doplatek zaplacené na místě jsou dvě běžné evidované platby.",
      },
    },
    {
      id: "zamestnanci",
      q: "Vaříte obědy pro vlastní zaměstnance?",
      yes: { tone: "info", text: "Jídla pro vlastní zaměstnance se **neevidují** (§ 12). Platby hostů zvenku ale evidujete." },
    },
  ],
  features: [
    { title: "Až 5 obsluh zdarma", text: "Každá obsluha s vlastním PINem. Vy vidíte všechny tržby a denní přehled." },
    { title: "Bar i sál", text: "Pokladnu otevřete na více zařízeních. Jeden pokladní certifikát z DIS+ použijete pro všechny." },
    { title: "Stravenky a spropitné", text: "Stravenka, karta, hotovost i QR. Spropitné zapíšete u platby kartou, doplatek ke stravence rozdělenou platbou." },
    { title: "I bez signálu", text: "Když v plném provozu vypadne Wi-Fi, obsluhujete dál – pokladna tržby odešle sama, jakmile se připojí." },
    { title: "Uzávěrka a export", text: "Denní uzávěrka, vklad a výběr hotovosti, export tržeb a pokladní kniha pro účetní." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Pro koho EvidujZdarma (ne)stačí",
    text: "Otevřené účty u stolů, bony do kuchyně a sklad nemáme. Když je denně potřebujete, zůstaňte u své gastro pokladny a EET 2.0 si nechte nastavit od jejího dodavatele – [srovnání cen](/prechod-z-jine-pokladny). EvidujZdarma se hodí pro menší restaurace a hospody, kde se platí na jeden účet u baru nebo u stolu.",
  },
  guideFaq: [0, 3, 2, 4, 5],
  tools: [
    { href: "/kalkulacka-spropitne", label: "Kalkulačka spropitného", text: "Kolik dát nebo dostat spropitné." },
    { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami", text: "Které jednotky oznámit v DIS+." },
    { href: "/prechod-z-jine-pokladny", label: "Přechod z jiné pokladny", text: "Ceny pokladen a kalkulačka úspory." },
    { href: "/musim-evidovat", label: "Kvíz: Musím evidovat?", text: "Šest otázek, jasná odpověď." },
  ],
  catalog: { href: "/obor/restaurace-a-kavarny/kraj/karlovarsky", label: "Restaurace a kavárny v Karlovarském kraji" },
  modified: "2026-10-23",
};


/* ---------------------------------------------------------------------------------------------------------------
 * S12 (22. 11. 2026): další obory z Google Search Console („eet pro veterináře“, „eet fitcentra“, „eet pro taxi“…).
 * Stejná šablona a stejná pravidla jako výše: fakta jen z FACTS a z revidovaných návodů (koho-se-eet-tyka,
 * kontaktni-platba, eet-ubytovani, eet-trhy-stanky, eet-eshop-dobirka, eet-gastronomie, eet-kadernictvi-kosmetika,
 * evidencni-jednotka, trzba-za-jineho); co zákon ani FS zatím jednoznačně neříkají, je „ověřte“ s odkazem na eet.gov.cz.
 * Texty stránek jsou nové, proto `pendingReview` – noindex, dokud je neprojde odbornice (Ф8, Ф12).
 * --------------------------------------------------------------------------------------------------------------- */

const pausalQuestion = (who: string): CheckQuestion => ({
  id: "pausal",
  q: "Jste OSVČ v 1. pásmu paušální daně s příjmy do 1 mil. Kč ročně?",
  hint: "Pokud si nejste jistí, odpovězte Ne.",
  eetOff: true,
  yes: eetOffYes(who),
  no: eetOffNo,
});
const tail = () => (isClosed("/pokladna") ? "a předregistrujete pokladnu zdarma" : "a začnete evidovat zdarma");
const ofl = FACTS.offline.hours;

const VETERINARI: OborLanding = {
  slug: "veterinari",
  industry: "jine",
  guideSlug: "koho-se-eet-tyka",
  short: "EET pro veterináře",
  posLabel: "Pokladna pro veterinární ordinaci zdarma",
  forYour: "pro vaši ordinaci",
  title: "EET pro veterináře 2027: co evidovat a pokladna zdarma",
  description: () => `Veterinární ordinace i výjezdy: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – ošetření, krmiva, faktury, EET OFF – ${tail()}.`,
  h1: "EET pro veterináře a veterinární ordinace",
  lead: "Od **1. 1. 2027** evidujete platby, které majitelé zvířat zaplatí v ordinaci nebo při výjezdu – hotově, kartou i QR kódem. Patří sem ošetření i krmivo nebo přípravky, které u vás koupí. Pět otázek ukáže, co z toho platí pro vaši ordinaci.",
  chips: ["Ordinace", "Výjezdy k chovatelům", "Prodej krmiv", "Klinika s více lékaři"],
  pains: [
    { title: "Veterina výjimku nemá", text: "Veterinární péče mezi činnostmi vyjmutými z evidence (§ 11–13) není. Rozhoduje způsob platby, ne obor." },
    { title: "Diagnóza do EET nejde", text: "Datová zpráva obsahuje celkovou částku, datum, evidenční jednotku a pořadové číslo – ne položky ani to, co jste zvířeti dělali." },
    { title: "Faktura převodem ne", text: "Chovatelé a zemědělské podniky, kteří platí převodem na fakturu, do evidence nespadají." },
    { title: "Výjezd bez signálu", text: `Na dvoře u chovatele přijmete platbu i bez signálu. Tržbu odešlete nejpozději do ${ofl} hodin.` },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám majitelé zvířat v ordinaci nebo při výjezdu hotově, kartou či QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete – vyšetření, očkování, zákroky i krmivo nebo přípravky, které u vás majitel koupí. Eviduje se celá částka, kterou majitel na místě zaplatí." },
      no: notCovered("chovatelé"),
    },
    {
      id: "faktury",
      q: "Fakturujete farmám nebo chovatelům, kteří platí převodem?",
      yes: { tone: "info", text: "Faktura uhrazená převodem z účtu se **neeviduje**. Když ale chovatel zaplatí přímo u vás nebo na dvoře kartou či QR kódem z vašeho telefonu, jde o kontaktní platbu a evidujete ji." },
    },
    {
      id: "vyjezdy",
      q: "Jezdíte za zvířaty k chovatelům a na farmy?",
      yes: { tone: "info", text: `Platby z výjezdů evidujete stejně jako v ordinaci. Bez signálu prodáte normálně a tržbu odešlete do ${ofl} hodin. Kterou evidenční jednotku k výjezdům uvést, si ověřte v [průvodci evidenčními jednotkami](/evidencni-jednotky) nebo na [eet.gov.cz](https://eet.gov.cz).` },
    },
    {
      id: "lekari",
      q: "Pracuje u vás víc veterinářů?",
      yes: { tone: "info", text: "Jsou-li lékaři vaši zaměstnanci, evidujete všechny platby vy – jedna pokladna, každý s vlastním PINem. Spolupracující OSVČ, které si účtují samy, evidují své tržby samy, nebo se s nimi dohodnete na [pověření](/navody/trzba-za-jineho)." },
    },
    pausalQuestion("Veterinář v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Ošetření na jedno klepnutí", text: "Očkování, vyšetření i balení krmiva si uložíte jako tlačítka s cenou. Prodej je hotový za pár vteřin." },
    { title: "Každý lékař svůj PIN", text: "Až 5 uživatelů zdarma. Vy vidíte tržby všech a denní přehled ordinace." },
    { title: "Výjezd s telefonem", text: "Pokladna běží v mobilu. Na dvoře bez signálu prodáte a tržby se odešlou, jakmile se telefon připojí." },
    { title: "QR platba na přesnou částku", text: "Chovatel naskenuje QR kód z vašeho telefonu a zaplatí z účtu. Platbu na místě pokladna eviduje." },
    { title: "Doklad bez papíru", text: "Když o doklad majitel zvířete požádá, pošlete ho e-mailem nebo ukážete jako QR kód." },
    { title: "Export pro účetní", text: "Denní uzávěrka, pokladní kniha a export tržeb do CSV." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Karty pacientů, objednávání ani sklad léčiv nemáme – na to vám dál poslouží veterinární program. EvidujZdarma ho doplní o evidenci tržeb. Pokud má váš program vlastní pokladnu, zeptejte se dodavatele na EET 2.0, nebo ho napojte přes [EET API](/eet-api).",
  },
  guideFaq: [6, 3, 0],
  extraFaq: [
    {
      q: "Dozví se Finanční správa, co jsem zvířeti dělal?",
      a: "Ne. Podle zveřejněné technické dokumentace obsahuje datová zpráva jen celkovou částku, datum, evidenční jednotku a pořadové číslo – ne položky, způsob platby ani sazby DPH.",
    },
  ],
  tools: [
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami", text: "Ordinace, výjezdy – co oznámit v DIS+." },
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
  ],
  pendingReview: true,
  modified: "2026-11-22",
};

const WELLNESS: OborLanding = {
  slug: "wellness-a-fitness",
  industry: "wellness-a-sport",
  guideSlug: "kontaktni-platba",
  short: "EET pro wellness a fitness",
  posLabel: "Pokladna pro fitness a wellness zdarma",
  forYour: "pro vaše studio",
  title: "EET pro fitness, posilovny a wellness: co evidovat",
  description: () => `Posilovna, fitcentrum, masáže i sauna: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – vstupy, permanentky, kredit – ${tail()}.`,
  h1: "EET pro posilovny, fitcentra a wellness",
  lead: "Od **1. 1. 2027** evidujete platby na recepci – jednorázové vstupy, permanentky, masáže i nápoje a proteinové tyčinky. Členství zaplacené online předem se neeviduje. Pět otázek ukáže, co platí pro vaše studio.",
  chips: ["Posilovna", "Fitcentrum", "Masáže a sauna", "Jóga a lekce"],
  pains: [
    { title: "Recepce = evidence", text: "Vstup, lekce nebo masáž zaplacená na recepci hotově, kartou či QR kódem se eviduje." },
    { title: "Online předem ne", text: "Členství nebo lekce zaplacené přes platební bránu na webu či v aplikaci jsou vzdálené platby a neevidují se." },
    { title: "Kredit dvakrát", text: "Dobití kreditu na čip nebo kartu se eviduje a jeho čerpání také – s označením, že jde o čerpání." },
    { title: "Automat na nápoje ne", text: "Prodejní automaty zákon z evidence vyjímá. Nápoje a tyčinky z baru ale evidujete." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám klienti na recepci – hotově, kartou nebo QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete – vstupy, lekce, masáže, solárium i zboží z baru. Eviduje se každá platba zvlášť." },
      no: notCovered("klienti"),
    },
    {
      id: "kredit",
      q: "Dobíjejí si klienti kredit na čip nebo klubovou kartu?",
      yes: { tone: "info", text: "Evidují se **obě** platby: dobití kreditu i jeho pozdější čerpání. Datová zpráva u nich nese částku určenou k čerpání, resp. částku čerpání. Pokladna má pro to tlačítko **Kredit** a volbu **Dobití kreditu**." },
    },
    {
      id: "permanentky",
      q: "Prodáváte permanentky na určitý počet vstupů?",
      yes: { tone: "maybe", text: "Permanentku zaplacenou na recepci evidujete při prodeji. Zda pak evidovat jednotlivé vstupy, záleží na tom, jestli jde o kredit (jako výše), nebo o předplacenou konkrétní službu – u dárkového poukazu na konkrétní službu se eviduje jen prodej. Jak posoudit váš typ permanentky, ověřte na [eet.gov.cz](https://eet.gov.cz) nebo s účetní." },
    },
    {
      id: "trenri",
      q: "Pronajímáte prostor trenérům nebo masérům na živnostenský list?",
      yes: { tone: "info", text: "Trenér nebo masér jako OSVČ eviduje platby od svých klientů **sám**, ve své pokladně a se svým certifikátem. Platí-li klienti všechno u vaší recepce, je potřeba dohoda o [pověření](/navody/trzba-za-jineho). Nájem, který vám trenér platí převodem, se neeviduje." },
    },
    pausalQuestion("Trenér, masér nebo majitel malého studia v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Vstupy na tlačítka", text: "Jednorázový vstup, lekce, masáž nebo voda – rychlá tlačítka s cenou, i bez signálu." },
    { title: "Kredit a poukazy", text: "Tlačítka Kredit a Dárkový, dobití kreditu a rozdělená platba pro doplatek." },
    { title: "Recepce na směny", text: "Až 5 uživatelů zdarma, každý s vlastním PINem. Vy vidíte tržby všech." },
    { title: "Více míst zdarma", text: "Až 3 evidenční jednotky bez poplatku – třeba posilovna a studio jógy na druhé adrese." },
    { title: "Uzávěrka a hotovost", text: "Denní uzávěrka, vklad a výběr hotovosti z kasy, export pro účetní." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Rezervace lekcí, turnikety ani správu členství nemáme. Když je máte v rezervačním systému, nechte si je tam – EvidujZdarma doplní evidenci plateb na recepci. Napojení systému s vlastní pokladnou řeší [EET API](/eet-api).",
  },
  guideFaq: [0, 1, 3],
  extraFaq: [
    {
      q: "Eviduje se proteinová tyčinka nebo nápoj z recepce?",
      a: "Ano. Eviduje se každá platba přijatá na místě, za služby i za zboží. Výjimku má jen prodej z prodejního automatu.",
    },
    {
      q: "Klient má členství zaplacené online a na recepci si dokoupí masáž. Co evidovat?",
      a: "Jen masáž zaplacenou na místě. Členství zaplacené přes platební bránu je vzdálená platba a neeviduje se.",
    },
  ],
  tools: [
    { href: "/navody/trzba-za-jineho", label: "Tržba za jiného", text: "Trenéři a maséři na vlastní živnost.", kind: "Návod" },
    { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami", text: "Kolik jednotek oznámit v DIS+." },
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
  ],
  catalog: { href: "/obor/wellness-a-sport/kraj/karlovarsky", label: "Masáže, wellness a fitness v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const TAXI: OborLanding = {
  slug: "taxi",
  industry: "doprava-taxi",
  guideSlug: "koho-se-eet-tyka",
  short: "EET pro taxi",
  posLabel: "Pokladna pro taxi zdarma",
  forYour: "pro vaše taxi",
  title: "EET pro taxi 2027: co evidovat a pokladna v mobilu",
  description: () => `Taxikář i dispečink: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – platby ve voze, aplikace, více řidičů, EET OFF – ${tail()}.`,
  h1: "EET pro taxikáře a taxislužby",
  lead: "Od **1. 1. 2027** evidujete jízdy, které vám cestující zaplatí ve voze – hotově, kartou nebo QR kódem. Taxislužba výjimku nemá a evidenční jednotkou je vůz. Pět otázek ukáže, co platí pro vás.",
  chips: ["Taxikář na vlastní vůz", "Dispečink", "Letištní transfery", "Více řidičů"],
  pains: [
    { title: "Taxi výjimku nemá", text: "Zákon vyjímá vlaky, letadla a pravidelnou hromadnou dopravu. Taxislužbu ne." },
    { title: "Vůz je jednotka", text: "V DIS+ oznámíte vůz jako dopravní prostředek. Taxikář s jedním autem má jednu jednotku." },
    { title: "Online předem ne", text: "Jízda zaplacená předem přes platební bránu se neeviduje. Platba kartou nebo hotově ve voze ano." },
    { title: "Tunel bez signálu", text: `Bez signálu přijmete platbu normálně a tržbu odešlete nejpozději do ${ofl} hodin.` },
  ],
  questions: [
    {
      id: "ve-voze",
      q: "Platí vám cestující ve voze hotově, kartou nebo QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete. Do pokladny v telefonu zadáte částku za jízdu a pokladna tržbu odešle – i dodatečně, když zrovna není signál." },
      no: notCovered("cestující"),
    },
    {
      id: "aplikace",
      q: "Jezdíte i přes aplikaci zprostředkovatele, kde cestující platí v aplikaci?",
      yes: { tone: "maybe", text: "Platba zaplacená online přes platební bránu aplikace je vzdálená platba. Čí tržba to je a kdo ji případně eviduje, záleží na smlouvě se zprostředkovatelem – viz [Tržba za jiného](/navody/trzba-za-jineho). Jízdy, které vám cestující zaplatí přímo ve voze, evidujete vy. V nejasných případech ověřte postup na [eet.gov.cz](https://eet.gov.cz)." },
    },
    {
      id: "vozy",
      q: "Máte víc vozů nebo řidičů?",
      yes: { tone: "info", text: "Každý vůz je samostatná evidenční jednotka (dopravní prostředek). Jsou-li řidiči vaši zaměstnanci, evidujete jejich jízdy vy – každý řidič má v pokladně vlastní PIN. Řidič na vlastní živnost eviduje své tržby sám, nebo se dohodnete na [pověření](/navody/trzba-za-jineho)." },
    },
    {
      id: "faktury",
      q: "Vozíte firmy na fakturu?",
      yes: { tone: "info", text: "Jízda vyfakturovaná firmě a zaplacená převodem se **neeviduje**. Evidují se jen platby přijaté osobně ve voze." },
    },
    pausalQuestion("Taxikář v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Pokladna v telefonu", text: "Žádné zvláštní zařízení – stačí mobil, který máte v držáku. Částku za jízdu zadáte na číselníku." },
    { title: "Platba kartou dál po svém", text: "Kartu přijmete na svém terminálu jako dosud, v pokladně jen zvolíte Karta." },
    { title: "QR platba na místě", text: "Cestující naskenuje QR kód s přesnou částkou a zaplatí z účtu." },
    { title: "Bez signálu", text: "V tunelu nebo za městem pokladna tržby uloží a odešle je, jakmile se připojí." },
    { title: "Řidiči s vlastním PINem", text: "Až 5 uživatelů a 3 evidenční jednotky (vozy) zdarma, denní přehled za každý vůz." },
    { title: "Doklad o jízdě", text: "Když o něj cestující požádá: e-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Taxametr, dispečink ani navigaci nenahrazuje. Povinnosti, které pro taxislužbu stanoví jiné předpisy, EET 2.0 nemění – pokladna k nim přidává jen evidenci tržeb.",
  },
  guideFaq: [5, 3, 1],
  extraFaq: [
    {
      q: "Mám tři auta. Kolik evidenčních jednotek oznámím?",
      a: "Tři – každý vůz je samostatná evidenční jednotka (dopravní prostředek). V pokladně EvidujZdarma jsou 3 evidenční jednotky zdarma.",
    },
  ],
  tools: [
    { href: "/navody/evidencni-jednotka", label: "Evidenční jednotka", text: "Vůz jako dopravní prostředek v DIS+.", kind: "Návod" },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
  ],
  catalog: { href: "/obor/doprava-taxi/kraj/karlovarsky", label: "Taxi a přeprava osob v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const KOSMETIKA: OborLanding = {
  slug: "kosmeticky-salon",
  industry: "kadernictvi-a-kosmetika",
  guideSlug: "eet-kadernictvi-kosmetika",
  short: "EET pro kosmetický salon",
  posLabel: "Pokladna pro kosmetický salon zdarma",
  forYour: "pro váš salon",
  title: "EET pro kosmetický salon: co evidovat a pokladna zdarma",
  description: () => `Kosmetika, nehty i pedikúra: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – balíčky, prodej kosmetiky, poukazy – ${tail()}.`,
  h1: "EET pro kosmetické salony, nehtová studia a pedikúru",
  lead: "Od **1. 1. 2027** evidujete platby klientek v salonu – ošetření pleti, gelové nehty, pedikúru i krémy a séra, které u vás koupí. Záloha zaplacená online v rezervačním systému se neeviduje. Pět otázek ukáže, co platí pro váš salon.",
  chips: ["Kosmetika", "Nehtové studio", "Pedikúra", "Permanentní make-up"],
  pains: [
    { title: "Prodej kosmetiky taky", text: "Eviduje se celá platba na místě – za ošetření i za kosmetiku, kterou si klientka odnese domů." },
    { title: "Balíček ošetření", text: "Zaplacený balíček nebo poukaz evidujete při prodeji. Uplatnění dárkového poukazu platbou není." },
    { title: "Pronajaté místo", text: "Manikérka nebo pedikérka s vlastní živností eviduje své tržby sama, ve své pokladně." },
    { title: "Záloha online ne", text: "Záloha zaplacená přes platební bránu rezervačního systému je vzdálená platba." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám klientky v salonu hotově, kartou nebo QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete – ošetření i kosmetiku, kterou si klientka koupí. Platí-li klientka jedním placením obojí, jde o jednu tržbu." },
      no: notCovered("klientky"),
    },
    {
      id: "balicky",
      q: "Prodáváte balíčky ošetření nebo dárkové poukazy?",
      yes: { tone: "info", text: "Dárkový poukaz na konkrétní ošetření evidujete jen **při prodeji** na místě; jeho uplatnění není platbou. Doplatek nad hodnotu poukazu evidujete normálně. Jak posoudit předplacený balíček několika ošetření, si ověřte na [eet.gov.cz](https://eet.gov.cz) nebo s účetní." },
    },
    {
      id: "kreslo",
      q: "Pracují u vás manikérky nebo pedikérky na vlastní živnost?",
      yes: { tone: "info", text: "Každá OSVČ eviduje své tržby **sama** – ve vlastní pokladně a se svým certifikátem. Platí-li klientky všechno u jednoho pultu, je potřeba dohoda o [pověření](/navody/trzba-za-jineho), nebo služby prodáváte jako své." },
    },
    {
      id: "doma",
      q: "Jezdíte za klientkami domů nebo pracujete bez vlastního salonu?",
      yes: { tone: "info", text: `Bez provozovny uvedete v DIS+ jako evidenční jednotku **sama sebe**. U klientky bez signálu prodáte normálně a tržbu odešlete do ${ofl} hodin.` },
    },
    pausalQuestion("Kosmetička nebo manikérka v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Ošetření i produkty", text: "Ošetření a kosmetiku si uložíte jako tlačítka s cenou a na jeden doklad dáte obojí." },
    { title: "Poukaz a doplatek", text: "Tlačítko Dárkový pro uplatněný poukaz a rozdělená platba pro doplatek kartou nebo hotově." },
    { title: "Spropitné u karty", text: "Pole pro spropitné při platbě kartou, aby seděla uzávěrka." },
    { title: "Každá kolegyně svůj PIN", text: "Až 5 uživatelů zdarma. Vy vidíte všechny tržby salonu." },
    { title: "U klientky doma", text: "Pokladna v telefonu funguje i bez signálu a tržby odešle sama." },
    { title: "Účtenka do mobilu", text: "Když o ni klientka požádá: e-mailem nebo QR kódem na displeji." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Kalendář rezervací, karty klientek ani věrnostní body nemáme. Rezervační systém si nechte, EvidujZdarma k němu přidá evidenci tržeb zdarma.",
  },
  guideFaq: [5, 1, 2, 4],
  tools: [
    { href: "/eet-pro/kadernice", label: "EET pro kadeřnice", text: "Kadeřnictví a barbershopy – rychlá kontrola.", kind: "Návod" },
    { href: "/kalkulacka-spropitne", label: "Kalkulačka spropitného", text: "Kolik dát nebo dostat spropitné." },
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
  ],
  catalog: { href: "/obor/kadernictvi-a-kosmetika/kraj/karlovarsky", label: "Kadeřnictví a kosmetika v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const HOSPODA: OborLanding = {
  slug: "hospoda",
  industry: "restaurace-a-kavarny",
  guideSlug: "eet-gastronomie",
  short: "EET pro hospody",
  posLabel: "Pokladna pro hospodu zdarma",
  forYour: "pro vaši hospodu",
  title: "EET pro hospody a hostince: co evidovat a pokladna zdarma",
  description: () => `Hospoda, hostinec i vesnická kavárna: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – útrata, spropitné, sál, automaty – ${tail()}.`,
  h1: "EET pro hospody, hostince a kavárny",
  lead: "Od **1. 1. 2027** evidujete každou útratu, kterou host zaplatí u výčepu nebo u stolu – hotově, kartou, QR kódem i stravenkou. Tržba se eviduje ve chvíli, kdy host platí. Pět otázek ukáže, co platí pro vaši hospodu.",
  chips: ["Hospoda", "Hostinec", "Kavárna", "Sál a zábavy"],
  pains: [
    { title: "Eviduje se při placení", text: "Datová zpráva se odesílá nejpozději při přijetí platby – tedy když host útratu zaplatí." },
    { title: "Hrací automaty ne", text: "Hazardní hry zákon z evidence vyjímá. Pivo a jídlo u stolu vedle nich se eviduje." },
    { title: "Sál na fakturu ne", text: "Pronájem sálu nebo svatba zaplacená převodem na fakturu se neeviduje." },
    { title: "Výpadek Wi-Fi", text: `Při výpadku čepujete dál a tržby odešlete nejpozději do ${ofl} hodin.` },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí hosté u výčepu nebo u stolu hotově, kartou, QR kódem či stravenkou?",
      gate: true,
      yes: { tone: "yes", text: "Každou takovou platbu od **1. 1. 2027** evidujete. Platí-li hosté každý zvlášť, eviduje se každá platba zvlášť." },
      no: notCovered("hosté"),
    },
    {
      id: "spropitne",
      q: "Nechávají vám hosté spropitné?",
      yes: { tone: "info", text: "Záleží na tom, čí je spropitné příjem. Spropitné pro hospodu nebo pro výčepního, který je OSVČ, je evidovanou tržbou. Spropitné, které je příjmem zaměstnance, evidenci nepodléhá. Podrobnosti v návodu [Spropitné a EET](/navody/spropitne-a-eet); daňové zacházení proberte s účetní." },
    },
    {
      id: "automaty",
      q: "Máte v hospodě hrací nebo prodejní automaty?",
      yes: { tone: "info", text: "Hazardní hry a prodejní automaty zákon z evidence vyjímá (§ 12 a 13). Výjimka se týká jen automatu – útraty za pití a jídlo evidujete." },
    },
    {
      id: "sal",
      q: "Pronajímáte sál nebo pořádáte svatby a zábavy?",
      yes: { tone: "info", text: "Akce zaplacená převodem na fakturu se **neeviduje**. Záloha a doplatek zaplacené na místě jsou dvě běžné evidované platby. Vstupné vybírané u dveří evidujete." },
    },
    pausalQuestion("Hospodský na živnost v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Pivo na jedno klepnutí", text: "Desítka, dvanáctka, limonáda, utopenec – rychlá tlačítka s cenou, i bez signálu." },
    { title: "Stravenky a doplatek", text: "Stravenka, karta, hotovost i QR. Doplatek ke stravence rozdělíte." },
    { title: "Výčep a sál", text: "Pokladnu otevřete na více zařízeních. Jeden certifikát z DIS+ použijete pro všechny." },
    { title: "Směny s PINem", text: "Až 5 uživatelů zdarma, každý s vlastním PINem a denní přehled." },
    { title: "Uzávěrka a kasa", text: "Denní uzávěrka, vklad a výběr hotovosti, pokladní kniha a export pro účetní." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Pro koho EvidujZdarma (ne)stačí",
    text: "Útratu na čárku (otevřené účty u stolů), bony do kuchyně a sklad nemáme – útratu naťukáte, až host platí. Když otevřené účty denně potřebujete, zůstaňte u gastro pokladny a EET 2.0 si nechte nastavit od jejího dodavatele – [srovnání cen](/prechod-z-jine-pokladny).",
  },
  guideFaq: [0, 2, 5],
  extraFaq: [
    {
      q: "Štamgast platí útratu jednou za týden. Kdy ji evidovat?",
      a: "Když ji zaplatí. Datová zpráva se odesílá nejpozději při přijetí platby, takže se eviduje celá částka v den, kdy host platí.",
    },
  ],
  tools: [
    { href: "/kalkulacka-spropitne", label: "Kalkulačka spropitného", text: "Kolik dát nebo dostat spropitné." },
    { href: "/eet-pro/restaurace", label: "EET pro restaurace", text: "Zahrádka, catering, více provozoven.", kind: "Návod" },
    { href: "/prechod-z-jine-pokladny", label: "Přechod z jiné pokladny", text: "Ceny pokladen a kalkulačka úspory." },
  ],
  catalog: { href: "/obor/restaurace-a-kavarny/kraj/karlovarsky", label: "Restaurace a kavárny v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const REALITY: OborLanding = {
  slug: "realitni-kancelar",
  industry: "jine",
  guideSlug: "koho-se-eet-tyka",
  short: "EET pro realitní kanceláře",
  posLabel: "Pokladna pro realitní kancelář zdarma",
  forYour: "pro vaši kancelář",
  title: "EET pro realitní kanceláře a makléře: týká se vás?",
  description: () => `Realitní kancelář i makléř: zjistěte, zda se vás EET od 1. 1. 2027 týká – provize převodem, platby na pobočce, nájem – ${tail()}.`,
  h1: "EET pro realitní kanceláře a makléře",
  lead: "Většina realitních kanceláří dostává provizi převodem na fakturu – a ta se **neeviduje**. Evidence od **1. 1. 2027** se vás týká jen tehdy, když vám klient zaplatí osobně: na pobočce, při prohlídce nebo podpisu, hotově, kartou či QR kódem. Pět otázek ukáže, jak je to u vás.",
  chips: ["Realitní kancelář", "Makléř OSVČ", "Správa nemovitostí", "Pronájem bytů"],
  pains: [
    { title: "Faktura převodem ne", text: "Provize nebo odměna zaplacená převodem na fakturu je vzdálená platba a neeviduje se." },
    { title: "Platba na pobočce ano", text: "Když klient zaplatí na pobočce kartou nebo hotově, jde o kontaktní platbu a evidujete ji." },
    { title: "Nájem není tržba z podnikání", text: "Příjem z nájmu vlastního bytu pod EET nespadá." },
    { title: "Obor nerozhoduje", text: "Výjimku realitní činnost nemá. Rozhoduje jen to, jak vám klienti platí." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám klienti někdy osobně – hotově, kartou nebo QR kódem na místě?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete, i když jsou výjimečné – například odměna zaplacená kartou na pobočce nebo poplatek za služby převzatý hotově při podpisu." },
      no: notCovered("klienti"),
    },
    {
      id: "uschova",
      q: "Přijímáte od klientů peníze, které nejsou vaší odměnou – například do úschovy nebo jistotu pro pronajímatele?",
      yes: { tone: "maybe", text: "Evidují se tržby za vaše zboží a služby. Jak posoudit peníze, které jen převezmete pro někoho jiného, záleží na smlouvě – ověřte to s daňovým poradcem nebo na [eet.gov.cz](https://eet.gov.cz). Úschova přes advokáta, notáře nebo banku převodem vaši evidenci neovlivní." },
    },
    {
      id: "najem",
      q: "Pronajímáte i vlastní byty nebo nebytové prostory?",
      yes: { tone: "info", text: "Příjem z nájmu pod EET **nespadá**. Jiná situace je krátkodobé ubytování provozované jako živnost (apartmány se službami) – viz [EET u ubytování](/navody/eet-ubytovani)." },
    },
    {
      id: "makleri",
      q: "Spolupracují s vámi makléři na vlastní živnost?",
      yes: { tone: "info", text: "Makléř OSVČ eviduje platby, které sám přijme osobně. Platby, které přijímáte vy jako kancelář, evidujete vy. Pokud za sebe navzájem platby přijímáte, pomůže návod [Tržba za jiného](/navody/trzba-za-jineho)." },
    },
    pausalQuestion("Makléř v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Jen když je potřeba", text: "Pokladnu otevřete v telefonu jen ve chvíli, kdy klient platí osobně. Mezitím na ni nemusíte myslet." },
    { title: "QR platba na pobočce", text: "Klient naskenuje QR kód s přesnou částkou a zaplatí z účtu. Platbu na místě pokladna eviduje." },
    { title: "Více poboček", text: "Až 3 evidenční jednotky zdarma – třeba dvě pobočky a makléř v terénu." },
    { title: "Makléři s PINem", text: "Až 5 uživatelů zdarma, každý s vlastním PINem." },
    { title: "Doklad e-mailem", text: "Klientovi pošlete doklad e-mailem, když o něj požádá." },
    { title: "Faktura zdarma", text: "Pro odměny převodem stačí faktura – vystavíte ji v generátoru bez registrace." },
  ],
  fit: {
    title: "Kdy pokladnu nepotřebujete",
    text: "Platí-li vám všichni klienti převodem na fakturu, evidovat nemusíte nic a pokladnu nepotřebujete – ani naši. Stačí [faktura zdarma](/faktura-zdarma).",
  },
  guideFaq: [3, 4, 1, 0],
  tools: [
    { href: "/faktura-zdarma", label: "Faktura zdarma", text: "Generátor faktur bez registrace." },
    { href: "/musim-evidovat", label: "Kvíz: Musím evidovat?", text: "Šest otázek, jasná odpověď." },
    { href: "/navody/kontaktni-platba", label: "Kontaktní platba", text: "Co se eviduje a co ne.", kind: "Návod" },
  ],
  pendingReview: true,
  modified: "2026-11-22",
};

const SVOBODNA: OborLanding = {
  slug: "svobodna-povolani",
  industry: "jine",
  guideSlug: "koho-se-eet-tyka",
  short: "EET pro svobodná povolání",
  posLabel: "Pokladna pro svobodná povolání zdarma",
  forYour: "pro vaši praxi",
  title: "EET pro svobodná povolání: lékaři, advokáti, lektoři",
  description: () => `Lékař, advokát, lektor či fotograf: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – platby na místě, zálohy, faktury – ${tail()}.`,
  h1: "EET pro svobodná povolání",
  lead: "Od **1. 1. 2027** evidují i lékaři, advokáti, architekti, psychologové, tlumočníci, lektoři a fotografové – pokud jim klient zaplatí osobně hotově, kartou nebo QR kódem. Faktury hrazené převodem se neevidují. Pět otázek ukáže, co platí pro vaši praxi.",
  chips: ["Ordinace", "Advokátní kancelář", "Lektor a kouč", "Fotograf a tlumočník"],
  pains: [
    { title: "Profese výjimku nemá", text: "Zákon vyjímá konkrétní činnosti (doprava, pošta, banky…), ne svobodná povolání." },
    { title: "Faktura převodem ne", text: "Většina praxí fakturuje a klienti platí z účtu. Tyto platby se neevidují." },
    { title: "Platba na místě ano", text: "Kartou v ordinaci, hotově po konzultaci, QR kódem po focení – to se eviduje." },
    { title: "Obsah služby do EET nejde", text: "Datová zpráva nese celkovou částku, datum a evidenční jednotku – ne položky ani jméno klienta." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám klienti nebo pacienti osobně – hotově, kartou nebo QR kódem na místě?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete – i když jde jen o část vašich příjmů, třeba poplatky za služby, které nehradí pojišťovna, konzultaci zaplacenou kartou nebo lekci zaplacenou hotově." },
      no: notCovered("klienti"),
    },
    {
      id: "pojistovna",
      q: "Dostáváte část příjmů od zdravotních pojišťoven, státu nebo firem převodem?",
      yes: { tone: "info", text: "Platby převodem z účtu se **neevidují** – evidují se jen platby, které přijmete při osobním kontaktu." },
    },
    {
      id: "zalohy",
      q: "Berete od klientů zálohy na místě?",
      yes: { tone: "info", text: "Záloha zaplacená osobně se eviduje jako běžná platba a doplatek při vyúčtování jako další samostatná platba. Záloha poslaná převodem se neeviduje. Peníze, které jen převezmete pro někoho jiného (například do úschovy), posuďte s daňovým poradcem." },
    },
    {
      id: "bez-provozovny",
      q: "Pracujete u klientů nebo bez vlastní kanceláře?",
      yes: { tone: "info", text: `Bez provozovny uvedete v DIS+ jako evidenční jednotku **sami sebe** – jedna jednotka pro všechny zakázky. Bez signálu přijmete platbu normálně a tržbu odešlete do ${ofl} hodin.` },
    },
    pausalQuestion("Lektor, fotograf nebo jiná OSVČ v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Pokladna jen na pár plateb", text: "Telefon nebo počítač, který už máte. Pokladnu otevřete, jen když klient platí na místě." },
    { title: "QR platba místo terminálu", text: "Klient naskenuje QR kód s přesnou částkou a zaplatí z účtu – bez poplatků za terminál." },
    { title: "Kolegové s PINem", text: "Až 5 uživatelů zdarma. Každý kolega v praxi má vlastní PIN." },
    { title: "Záloha a doplatek", text: "Dvě samostatné tržby, jak to pravidla vyžadují." },
    { title: "Doklad e-mailem", text: "Když o doklad klient požádá, pošlete ho e-mailem nebo jako QR kód." },
    { title: "Export pro účetní", text: "Denní přehled, pokladní kniha a export tržeb do CSV." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Fakturaci, výkazy pro pojišťovny ani evidenci klientů nenahrazuje. Platí-li vám všichni převodem, pokladnu nepotřebujete – stačí [faktura zdarma](/faktura-zdarma).",
  },
  guideFaq: [3, 0, 1],
  extraFaq: [
    {
      q: "Jsem lékař. Eviduji i úhrady od zdravotní pojišťovny?",
      a: "Ne. Úhrady od pojišťoven přicházejí převodem a neevidují se. Evidujete jen platby, které vám pacient zaplatí osobně – hotově, kartou nebo QR kódem v ordinaci.",
    },
  ],
  tools: [
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
    { href: "/navody/kontaktni-platba", label: "Kontaktní platba", text: "Co se eviduje a co ne.", kind: "Návod" },
  ],
  pendingReview: true,
  modified: "2026-11-22",
};

const FARMY: OborLanding = {
  slug: "farmy-a-farmarske-trhy",
  industry: "farmari-a-vyrobci",
  guideSlug: "eet-trhy-stanky",
  short: "EET pro farmy a farmářské trhy",
  posLabel: "Pokladna pro farmu zdarma",
  forYour: "pro vaši farmu",
  title: "EET pro farmy a farmářské trhy: prodej ze dvora i na trhu",
  description: () => `Farma, biofarma i včelař: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – prodej ze dvora, trhy, bedýnky, EET OFF – ${tail()}.`,
  h1: "EET pro farmy, biofarmy a farmářské trhy",
  lead: "Od **1. 1. 2027** evidujete platby, které zákazníci zaplatí osobně – ve farmářském obchůdku, u stánku na trhu nebo při výdeji bedýnek. Platby převodem předem se neevidují. Pět otázek ukáže, co platí pro vaši farmu.",
  chips: ["Prodej ze dvora", "Farmářské trhy", "Bedýnky", "Biofarma"],
  pains: [
    { title: "Dvůr i trh", text: "Obchůdek na farmě je stálá provozovna, stánek na trzích mobilní provozovna – oznámíte obě." },
    { title: "Bio na tom nic nemění", text: "Certifikace ani velikost farmy o evidenci nerozhodují. Rozhoduje, jak zákazník platí." },
    { title: "Bedýnky převodem ne", text: "Bedýnka zaplacená předem převodem nebo na webu se neeviduje. Platba při výdeji ano." },
    { title: "Trh bez signálu", text: `Na trhu bez signálu prodáváte dál a tržby odešlete nejpozději do ${ofl} hodin.` },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám zákazníci osobně – na farmě, na trhu nebo při výdeji – hotově, kartou či QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete – mléko, maso, zelenina, med i vejce, i když prodáváte jen v sezóně. Pevnou hranici, pod kterou by se malý prodej neevidoval, zákon nestanoví." },
      no: notCovered("zákazníci"),
    },
    {
      id: "trhy",
      q: "Jezdíte se stánkem na farmářské trhy?",
      yes: { tone: "info", text: `Stánek oznámíte v DIS+ jako **mobilní provozovnu** – vedle obchůdku na farmě, pokud ho máte. Oznamují se všechny jednotky. Bez signálu prodáte normálně a tržby odešlete do ${ofl} hodin.` },
    },
    {
      id: "samoobsluha",
      q: "Máte samoobslužný stánek nebo pokladničku „na důvěru“ u cesty?",
      yes: { tone: "maybe", text: "Zákon vyjímá prodejní automaty a za určitých podmínek samoobslužná zařízení (§ 13 odst. 2–4), u kterých evidence není ani s přiměřenými náklady možná. Finanční správa k nim připravuje metodiku. Zda se výjimka vztahuje na váš stánek, zatím ověřte na [eet.gov.cz](https://eet.gov.cz)." },
    },
    {
      id: "bedynky",
      q: "Rozvážíte bedýnky nebo je zákazníci vyzvedávají?",
      yes: { tone: "info", text: "Bedýnka zaplacená předem převodem nebo platební bránou se **neeviduje** – vyzvednutí platbou není. Platí-li zákazník až při výdeji hotově, kartou nebo QR kódem, evidujete to." },
    },
    pausalQuestion("Farmář v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Produkty na tlačítka", text: "Litr mléka, kilo brambor, sklenice medu – tlačítka s cenou, i bez signálu." },
    { title: "Farma i trh zdarma", text: "Až 3 evidenční jednotky bez poplatku – obchůdek, stánek a třeba výdejní místo." },
    { title: "QR platba u stánku", text: "Zákazník naskenuje QR kód s přesnou částkou a zaplatí z účtu, bez terminálu." },
    { title: "Brigádníci s PINem", text: "Až 5 uživatelů zdarma. Na trhu prodává kdokoli z rodiny, každý se svým PINem." },
    { title: "Trh bez signálu", text: "Pokladna tržby uloží a odešle je, jakmile se telefon připojí, a hlídá lhůtu 48 hodin." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Váhu, sklad ani objednávky bedýnek nemáme. Cenu za vážené zboží naťukáte na číselníku. Ubytování na farmě řeší stránka [EET pro penziony a chaty](/eet-pro/ubytovani-na-horach).",
  },
  guideFaq: [4, 3, 1],
  extraFaq: [
    {
      q: "Prodávám přebytky ze zahrádky u plotu. Musím evidovat?",
      a: "Pokud nejde o podnikání, ale o ostatní (příležitostný) příjem podle § 10 zákona o daních z příjmů, pod EET nespadá. Prodej z farmy v rámci podnikání se eviduje, i když je malý. Kde je hranice, posuďte s účetní.",
    },
  ],
  tools: [
    { href: "/navody/eet-trhy-stanky", label: "EET na trzích a u stánků", text: "Stánek, food truck, sezónní prodej.", kind: "Návod" },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami", text: "Farma, stánek – co oznámit v DIS+." },
  ],
  catalog: { href: "/obor/farmari-a-vyrobci/kraj/karlovarsky", label: "Farmáři a výrobci v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const HORY: OborLanding = {
  slug: "ubytovani-na-horach",
  industry: "ubytovani",
  guideSlug: "eet-ubytovani",
  short: "EET pro penziony a chaty",
  posLabel: "Pokladna pro penzion zdarma",
  forYour: "pro váš penzion",
  title: "EET pro penziony a chaty na horách: co evidovat",
  description: () => `Penzion, horská chata i apartmány: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – recepce, zálohy, kauce, signál – ${tail()}.`,
  h1: "EET pro penziony, chaty a horské ubytování",
  lead: "Od **1. 1. 2027** evidujete platby hostů na místě – při příjezdu, odjezdu i za večeři, saunu nebo půjčení lyží. Ubytování zaplacené předem převodem nebo přes platformu online se neeviduje. Pět otázek ukáže, co platí pro váš penzion.",
  chips: ["Penzion", "Horská chata", "Apartmány", "Kemp a glamping"],
  pains: [
    { title: "Platba na recepci", text: "Hotovost, karta i QR kód při příjezdu nebo odjezdu se evidují. Převod a online platba předem ne." },
    { title: "Chata bez signálu", text: `Na horách bez signálu prodáte normálně a tržbu odešlete nejpozději do ${ofl} hodin.` },
    { title: "Kauce jen použitá", text: "Vratná kauce se při složení ani při vrácení neeviduje – jen částka, kterou z kauce složené na místě použijete." },
    { title: "Služby navíc", text: "Snídaně, večeře, sauna, parkování nebo půjčovna zaplacené na místě se evidují také." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám hosté na místě – hotově, kartou nebo QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete – ubytování doplacené při příjezdu, minibar, večeře, wellness i půjčení vybavení." },
      no: notCovered("hosté"),
    },
    {
      id: "platformy",
      q: "Berete rezervace přes rezervační portály nebo vlastní web?",
      yes: { tone: "info", text: "Zaplatil-li host online přes platformu a vy dostanete výplatu převodem, **neevidujete**. Pokud si host ubytování jen rezervoval a platí až u vás, evidujete. Záloha zaplacená na místě je běžná platba a doplatek také." },
    },
    {
      id: "signal",
      q: "Bývá u vás slabý nebo žádný signál?",
      yes: { tone: "info", text: `Prodáváte dál. Tržbu je potřeba odeslat bez zbytečného odkladu, nejpozději do **${ofl} hodin** – pokladna ji uloží a odešle sama, jakmile se připojí. Podrobně v návodu [EET bez internetu](/navody/eet-bez-internetu).` },
    },
    {
      id: "poplatek",
      q: "Vybíráte od hostů poplatek z pobytu?",
      yes: { tone: "maybe", text: "Zda se poplatek, který vybíráte pro obec, zahrnuje do evidované tržby, Finanční správa zatím jednoznačně nezveřejnila. Ověřte to na [eet.gov.cz](https://eet.gov.cz) nebo s daňovým poradcem." },
    },
    {
      id: "pms",
      q: "Používáte rezervační systém (PMS), ve kterém hosté platí?",
      yes: { tone: "info", text: "Pokud váš systém EET 2.0 neumí, může tržby posílat přes [EET API](/eet-api) – nebo platby na místě zadáte do pokladny EvidujZdarma v telefonu." },
    },
  ],
  features: [
    { title: "Recepce v telefonu", text: "Pokladna v mobilu nebo na počítači na recepci – bez zvláštního zařízení." },
    { title: "I bez signálu", text: "Na chatě bez signálu pokladna tržby uloží a odešle, jakmile se připojí. Lhůtu 48 hodin hlídá." },
    { title: "Záloha, doplatek, kauce", text: "Záloha a doplatek jako dvě tržby, rozdělená platba hotově a kartou." },
    { title: "Více budov zdarma", text: "Až 3 evidenční jednotky bez poplatku – penzion, chata a půjčovna." },
    { title: "Napojení PMS", text: "EET API pro rezervační systémy a PMS, které EET 2.0 samy neumí." },
    { title: "Účtenka e-mailem", text: "Host dostane doklad e-mailem nebo QR kódem, když o něj požádá." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Rezervace, kalendář obsazenosti ani knihu ubytovaných nemáme – na to máte PMS nebo rezervační systém. EvidujZdarma eviduje platby na místě, nebo tržby převezme z vašeho systému přes [EET API](/eet-api).",
  },
  guideFaq: [0, 1, 2, 3],
  tools: [
    { href: "/eet-api", label: "EET API pro PMS", text: "EET 2.0 do rezervačního systému.", kind: "Služba" },
    { href: "/navody/eet-bez-internetu", label: "EET bez internetu", text: "Co dělat, když na horách není signál.", kind: "Návod" },
    { href: "/evidencni-jednotky", label: "Průvodce evidenčními jednotkami", text: "Penzion, chata, půjčovna – co oznámit." },
  ],
  catalog: { href: "/obor/ubytovani/kraj/karlovarsky", label: "Ubytování v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const OBCHODY: OborLanding = {
  slug: "obchody-a-prodejny",
  industry: "maloobchod",
  guideSlug: "kontaktni-platba",
  short: "EET pro obchody",
  posLabel: "Pokladna pro obchod zdarma",
  forYour: "pro váš obchod",
  title: "EET pro obchody a prodejny 2027: co evidovat",
  description: () => `Prodejna, butik i obchod s e-shopem: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – karty, QR, poukazy, vratky – ${tail()}.`,
  h1: "EET pro obchody a prodejny",
  lead: "Od **1. 1. 2027** evidujete každý nákup zaplacený v prodejně – hotově, kartou, QR kódem i poukázkou. Objednávka zaplacená předem na e-shopu se neeviduje. Pět otázek ukáže, co platí pro váš obchod.",
  chips: ["Prodejna", "Butik", "Papírnictví a dárky", "Obchod s e-shopem"],
  pains: [
    { title: "Karta i QR", text: "Nejen hotovost: platba kartou i QR kódem v prodejně je kontaktní platba." },
    { title: "Dvě kasy = jedna jednotka", text: "Dvě pokladny v jedné prodejně jsou jedna evidenční jednotka, rozliší se označením pokladny." },
    { title: "Poukaz při prodeji", text: "Dárkový poukaz evidujete při prodeji. Uplatnění poukazu platbou není." },
    { title: "Vratka je záporná tržba", text: "Vrácení peněz zákazníkovi evidujete jako vratku k původnímu prodeji." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám zákazníci v prodejně hotově, kartou, QR kódem nebo poukázkou?",
      gate: true,
      yes: { tone: "yes", text: "Každý takový nákup od **1. 1. 2027** evidujete. Do datové zprávy jde celková částka – položky, sazby DPH ani způsob platby ne." },
      no: notCovered("zákazníci"),
    },
    {
      id: "pokladny",
      q: "Máte v jedné prodejně víc pokladen?",
      yes: { tone: "info", text: "Pořád jde o **jednu evidenční jednotku**; pokladny se rozliší označením pokladního zařízení. Jeden pokladní certifikát z DIS+ použijete pro všechny." },
    },
    {
      id: "eshop",
      q: "Prodáváte i přes e-shop s osobním odběrem v prodejně?",
      yes: { tone: "info", text: "Objednávka zaplacená předem přes platební bránu nebo převodem se **neeviduje** – vyzvednutí platbou není. Platí-li zákazník až v prodejně, evidujete. Podrobně v návodu [E-shop a dobírka](/navody/eet-eshop-dobirka)." },
    },
    {
      id: "vratky",
      q: "Vracíte zákazníkům peníze za vrácené zboží?",
      yes: { tone: "info", text: "Vrácení evidujete jako **vratku** (zápornou tržbu) – postup popisuje návod [Storno a vrácení](/navody/storno-a-vraceni-eet). Pokladna vratku dohledá i z jiné pokladny a nedovolí vrátit víc, než bylo zaplaceno." },
    },
    pausalQuestion("Majitel malého obchodu v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Zboží na tlačítka", text: "Nejprodávanější zboží jako rychlá tlačítka, zbytek naťukáte na číselníku." },
    { title: "Více pokladen", text: "Pokladnu otevřete na více zařízeních. Až 5 prodavačů zdarma, každý s PINem." },
    { title: "Vratky správně", text: "Vratka k původnímu dokladu, i částečná, i z jiné pokladny." },
    { title: "Poukazy a doplatek", text: "Tlačítko Dárkový pro uplatněný poukaz a rozdělená platba pro doplatek." },
    { title: "Uzávěrka a kasa", text: "Denní uzávěrka, vklad a výběr hotovosti, pokladní kniha a export pro účetní." },
    { title: "Účtenka papírově i digitálně", text: "Tisk na Bluetooth tiskárnu, e-mail nebo QR kód na displeji." },
  ],
  fit: {
    title: "Pro koho EvidujZdarma (ne)stačí",
    text: "Skladovou evidenci, napojení na váhu ani čtečku čárových kódů nemáme (čtečku připravujeme). Prodáváte-li stovky položek denně přes skener, zůstaňte u obchodní pokladny – [srovnání cen](/prechod-z-jine-pokladny).",
  },
  guideFaq: [0, 1, 2, 3],
  tools: [
    { href: "/navody/storno-a-vraceni-eet", label: "Storno a vrácení", text: "Vratka a oprava chybné tržby.", kind: "Návod" },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/prechod-z-jine-pokladny", label: "Přechod z jiné pokladny", text: "Ceny pokladen a import zboží." },
  ],
  catalog: { href: "/obor/maloobchod/kraj/karlovarsky", label: "Obchody, stánky a trhy v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const STANKY: OborLanding = {
  slug: "stanky-a-zmrzlina",
  industry: "maloobchod",
  guideSlug: "eet-trhy-stanky",
  short: "EET pro stánky a zmrzlinu",
  posLabel: "Pokladna pro stánek zdarma",
  forYour: "pro váš stánek",
  title: "EET pro stánky a zmrzlinu: sezónní prodej a pokladna",
  description: () => `Zmrzlina, okénko i trhy: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – sezónní prodej, brigádníci, festivaly – ${tail()}.`,
  h1: "EET pro stánky, zmrzlinu a sezónní prodej",
  lead: "Od **1. 1. 2027** evidujete každý kornout, langoš i suvenýr zaplacený u stánku – hotově, kartou nebo QR kódem. Zákon nemá výjimku pro sezónní ani malý prodej. Pět otázek ukáže, co platí pro váš stánek.",
  chips: ["Zmrzlina", "Okénko", "Festivaly a jarmarky", "Sezónní stánek"],
  pains: [
    { title: "Sezóna výjimkou není", text: "Prodáváte-li jen v létě nebo o víkendech, evidujete stejně. Pevnou hranici zákon nestanoví." },
    { title: "Stánek je jednotka", text: "Stánek, pojízdný vozík nebo zmrzlinový vůz oznámíte v DIS+ jako mobilní provozovnu." },
    { title: "Festival bez signálu", text: `Ve frontě prodáváte dál a tržby odešlete nejpozději do ${ofl} hodin.` },
    { title: "Účtenka jen na požádání", text: "EET 2.0 účtenku nepřikazuje. Kdo o ni požádá, dostane ji – i elektronicky." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám zákazníci u stánku nebo okénka hotově, kartou či QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Každou takovou platbu od **1. 1. 2027** evidujete, i když prodáváte jen pár měsíců v roce." },
      no: notCovered("zákazníci"),
    },
    {
      id: "okenko",
      q: "Prodáváte z okénka kavárny nebo cukrárny do ulice?",
      yes: { tone: "maybe", text: "Okénko, které je součástí vaší provozovny, obvykle patří k ní. Samostatný stánek jinde oznámíte jako další, mobilní provozovnu. Pokud si nejste jistí, jak okénko oznámit, pomůže [průvodce evidenčními jednotkami](/evidencni-jednotky) nebo [eet.gov.cz](https://eet.gov.cz)." },
    },
    {
      id: "brigadnici",
      q: "Prodávají u vás brigádníci?",
      yes: { tone: "info", text: "Tržby evidujete vy jako podnikatel – brigádník prodává ve vaší pokladně se svým PINem. Vlastní certifikát ani přihlášení do DIS+ nepotřebuje." },
    },
    {
      id: "festivaly",
      q: "Jezdíte na festivaly, jarmarky nebo trhy?",
      yes: { tone: "info", text: `Stánek je **mobilní provozovna** a oznamujete ho jednou, ne pro každou akci zvlášť. Bez signálu prodáváte dál; lhůta ${ofl} hodin běží od přijetí platby, proto pokladnu po akci co nejdřív připojte.` },
    },
    pausalQuestion("Stánkař v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Kopeček na klepnutí", text: "Kopeček, točená, ledová tříšť – tlačítka s cenou a prodej za pár vteřin." },
    { title: "Fronta bez čekání", text: "Prodej se kvůli spojení neblokuje, tržby se odešlou na pozadí." },
    { title: "Brigádníci s PINem", text: "Až 5 uživatelů zdarma. Vy vidíte tržby každé směny." },
    { title: "Stánek i provozovna", text: "Až 3 evidenční jednotky zdarma – cukrárna, stánek a festivalový vůz." },
    { title: "QR platba bez terminálu", text: "Zákazník naskenuje QR kód s přesnou částkou a zaplatí z účtu." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Sklad surovin ani výpočet receptur nemáme. Pro stánek, kde se platí hned u okénka, to obvykle nevadí.",
  },
  guideFaq: [1, 4, 2],
  extraFaq: [
    {
      q: "V zimě stánek zavírám. Musím jednotku v DIS+ odhlásit?",
      a: "Povinnost odhlásit jednotku na období bez tržeb jsme v zákoně ani v materiálech Finanční správy nenašli – ověřte si to na eet.gov.cz. Změny údajů jednotky (například nové místo) se oznamují v DIS+ před první tržbou po změně, nejpozději do 15 dnů.",
    },
  ],
  tools: [
    { href: "/navody/eet-trhy-stanky", label: "EET na trzích a u stánků", text: "Všechny situace podrobně, se zdroji.", kind: "Návod" },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
    { href: "/kalkulacka-eet-off", label: "Kalkulačka EET OFF", text: "Vyplatí se vám přirážka místo evidence?" },
  ],
  catalog: { href: "/obor/maloobchod/kraj/karlovarsky", label: "Obchody, stánky a trhy v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const RYCHLE: OborLanding = {
  slug: "rychle-obcerstveni",
  industry: "restaurace-a-kavarny",
  guideSlug: "eet-gastronomie",
  short: "EET pro rychlá občerstvení",
  posLabel: "Pokladna pro rychlé občerstvení zdarma",
  forYour: "pro vaše občerstvení",
  title: "EET pro rychlé občerstvení: kebab, pizza, jídlo s sebou",
  description: () => `Kebab, pizzerie i jídlo s sebou: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – stravenky, rozvoz, víc pokladen – ${tail()}.`,
  h1: "EET pro rychlá občerstvení a jídlo s sebou",
  lead: "Od **1. 1. 2027** evidujete každou platbu u pultu – hotovost, kartu, QR kód i stravenku, také jídlo s sebou a platbu kurýrovi u dveří. Objednávka zaplacená předem online se neeviduje. Pět otázek ukáže, co platí pro vaše občerstvení.",
  chips: ["Kebab a grill", "Pizzerie", "Jídlo s sebou", "Rozvoz"],
  pains: [
    { title: "S sebou se eviduje", text: "Jídlo s sebou zaplacené u pultu je běžná evidovaná platba." },
    { title: "Stravenky taky", text: "Stravenka i stravenková karta jsou evidovaná platba v den, kdy je host uplatní." },
    { title: "Rozvoz podle platby", text: "Online předem ne. Platba vašemu kurýrovi při předání ano." },
    { title: "Fronta se nezastaví", text: `Při výpadku spojení prodáváte dál a tržby odešlete nejpozději do ${ofl} hodin.` },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám zákazníci u pultu nebo okénka hotově, kartou, QR kódem či stravenkou?",
      gate: true,
      yes: { tone: "yes", text: "Každou takovou platbu od **1. 1. 2027** evidujete – i jídlo s sebou. Když host zaplatí část stravenkou a zbytek kartou, jde o jednu tržbu." },
      no: notCovered("zákazníci"),
    },
    {
      id: "rozvoz",
      q: "Rozvážíte jídlo nebo přijímáte objednávky přes aplikace?",
      yes: { tone: "info", text: "Objednávka zaplacená předem online je vzdálená platba a **neeviduje se**. Platbu, kterou převezme váš kurýr, evidujete. U kurýrů rozvozových platforem záleží na smlouvě s platformou – viz [Tržba za jiného](/navody/trzba-za-jineho)." },
    },
    {
      id: "pokladny",
      q: "Máte u pultu víc pokladen nebo objednávkový tablet?",
      yes: { tone: "info", text: "Víc pokladen v jedné provozovně je pořád **jedna evidenční jednotka**; rozliší se označením pokladního zařízení. Jeden certifikát z DIS+ použijete pro všechny." },
    },
    {
      id: "zamestnanci",
      q: "Dáváte jídlo i vlastním zaměstnancům?",
      yes: { tone: "info", text: "Jídla pro vlastní zaměstnance se **neevidují** (§ 12). Platby zákazníků evidujete." },
    },
    pausalQuestion("Provozovatel občerstvení v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Menu na tlačítka", text: "Kebab, pizza, hranolky, nápoje – rychlá tlačítka s cenou, i bez signálu." },
    { title: "Stravenka a doplatek", text: "Stravenka, karta, hotovost i QR. Doplatek ke stravence rozdělíte." },
    { title: "Dvě pokladny u pultu", text: "Pokladnu otevřete na více zařízeních, až 5 obsluh zdarma s vlastním PINem." },
    { title: "Fronta bez čekání", text: "Prodej se kvůli spojení neblokuje, tržby se odešlou na pozadí." },
    { title: "Uzávěrka a kasa", text: "Denní uzávěrka, vklad a výběr hotovosti a export pro účetní." },
    { title: "Účtenka na požádání", text: "E-mailem, QR kódem na displeji nebo z Bluetooth tiskárny." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Bony do kuchyně, objednávkový displej, sklad surovin ani napojení na rozvozové aplikace nemáme. EvidujZdarma se hodí tam, kde se objednává a platí najednou u pultu.",
  },
  guideFaq: [0, 1, 5, 2],
  tools: [
    { href: "/navody/trzba-za-jineho", label: "Tržba za jiného", text: "Kurýři a rozvozové platformy.", kind: "Návod" },
    { href: "/eet-pro/bistro", label: "EET pro bistro a kavárnu", text: "Food truck, festivaly, jídlo s sebou.", kind: "Návod" },
    { href: "/prechod-z-jine-pokladny", label: "Přechod z jiné pokladny", text: "Ceny pokladen a kalkulačka úspory." },
  ],
  catalog: { href: "/obor/restaurace-a-kavarny/kraj/karlovarsky", label: "Restaurace a kavárny v Karlovarském kraji" },
  pendingReview: true,
  modified: "2026-11-22",
};

const ESHOP: OborLanding = {
  slug: "eshop-vlastni-vyrobky",
  industry: "farmari-a-vyrobci",
  guideSlug: "eet-eshop-dobirka",
  short: "EET pro e-shop s vlastními výrobky",
  posLabel: "Pokladna pro e-shop s osobním odběrem zdarma",
  forYour: "pro váš e-shop",
  title: "EET pro e-shop s vlastními výrobky: osobní odběr a trhy",
  description: () => `E-shop s vlastními výrobky: za 30 vteřin zjistíte, co od 1. 1. 2027 evidovat – platební brána, osobní odběr, dobírka – ${tail()}.`,
  h1: "EET pro e-shop s vlastními výrobky",
  lead: "E-shop, kterému zákazníci platí jen na dálku – platební bránou nebo převodem –, evidovat **nemusí**. Od **1. 1. 2027** evidujete platby, které přijmete osobně: při osobním odběru, na jarmarku nebo ve vlastní dílně. Pět otázek ukáže, jak je to u vás.",
  chips: ["Šperky a keramika", "Kosmetika a mýdla", "Pečivo a dorty", "Osobní odběr"],
  pains: [
    { title: "Brána a převod ne", text: "Platba přes platební bránu, převod předem i QR kód zaplacený z domova se neevidují." },
    { title: "Osobní odběr podle platby", text: "Zaplaceno předem = neevidujete. Platba hotově nebo kartou při převzetí = evidujete." },
    { title: "Dobírka zatím nejasná", text: "Jak Finanční správa posoudí dobírku vybranou dopravcem, zatím výslovně nepotvrdila." },
    { title: "Web jako jednotka", text: "Kdo má aspoň jednu jednotku s evidovanými tržbami, oznamuje v DIS+ všechny – i e-shop." },
  ],
  questions: [
    {
      id: "na-miste",
      q: "Platí vám někdo osobně – při odběru, na trhu nebo v dílně – hotově, kartou či QR kódem?",
      gate: true,
      yes: { tone: "yes", text: "Tyto platby od **1. 1. 2027** evidujete. Objednávky zaplacené na dálku dál neevidujete." },
      no: notCovered("zákazníci"),
    },
    {
      id: "odber",
      q: "Nabízíte osobní odběr s platbou při převzetí?",
      yes: { tone: "info", text: "Platba hotově, kartou nebo QR kódem při převzetí je kontaktní platba a **evidujete ji**. Pokud zákazník zaplatil předem online a jen si zboží vyzvedne, neevidujete nic." },
    },
    {
      id: "dobirka",
      q: "Posíláte zboží na dobírku přes dopravce?",
      yes: { tone: "maybe", text: "Podle dostupných výkladů se dobírka vybraná dopravcem neeviduje, protože peníze přijdou převodem od dopravce. Finanční správa to ale zatím výslovně nepotvrdila – stav sledujte v návodu [E-shop a dobírka](/navody/eet-eshop-dobirka) a na [eet.gov.cz](https://eet.gov.cz)." },
    },
    {
      id: "jarmarky",
      q: "Prodáváte výrobky i na jarmarcích, trzích nebo v dílně?",
      yes: { tone: "info", text: `Stánek oznámíte v DIS+ jako **mobilní provozovnu**, dílnu s prodejem jako stálou. Oznamují se všechny jednotky, takže i e-shop. Bez signálu na trhu prodáváte dál a tržby odešlete do ${ofl} hodin.` },
    },
    pausalQuestion("Výrobce na živnost v 1. pásmu paušálu"),
  ],
  features: [
    { title: "Pokladna k e-shopu", text: "Na osobní odběr i jarmark stačí telefon. E-shop si necháte, jak je." },
    { title: "QR platba při odběru", text: "Zákazník naskenuje QR kód s přesnou částkou a zaplatí z účtu. Platbu na místě pokladna eviduje." },
    { title: "E-shop i stánek zdarma", text: "Až 3 evidenční jednotky bez poplatku – e-shop, dílna a stánek na trzích." },
    { title: "Jarmark bez signálu", text: "Pokladna tržby uloží a odešle, jakmile se připojí." },
    { title: "Napojení e-shopu", text: "Platby při osobním odběru může e-shop posílat přes EET API." },
    { title: "Doklad e-mailem", text: "Zákazníkovi pošlete doklad e-mailem, když o něj požádá." },
  ],
  fit: {
    title: "Co pokladna neumí",
    text: "Košík, sklad ani propojení s dopravci nemáme – e-shop zůstává váš. EvidujZdarma eviduje platby, které přijmete osobně, ručně v telefonu, nebo je převezme z e-shopu přes [EET API](/eet-api).",
  },
  guideFaq: [0, 2, 3, 4],
  tools: [
    { href: "/navody/eet-eshop-dobirka", label: "E-shop a dobírka", text: "Platební brána, osobní odběr, dobírka.", kind: "Návod" },
    { href: "/eet-api", label: "EET API", text: "Osobní odběr z e-shopu přímo do EET.", kind: "Služba" },
    { href: "/qr-platba", label: "QR platba", text: "QR kód pro platbu na účet během pár sekund." },
  ],
  pendingReview: true,
  modified: "2026-11-22",
};

export const OBOR_LANDINGS: readonly OborLanding[] = [
  KADERNICE,
  BISTRO,
  RESTAURACE,
  // S12 (22. 11. 2026): koncepty do revize
  VETERINARI,
  WELLNESS,
  TAXI,
  KOSMETIKA,
  HOSPODA,
  REALITY,
  SVOBODNA,
  FARMY,
  HORY,
  OBCHODY,
  STANKY,
  RYCHLE,
  ESHOP,
];

export const landingPath = (l: Pick<OborLanding, "slug">) => `/eet-pro/${l.slug}`;

export function getLanding(slug: string): OborLanding | undefined {
  return OBOR_LANDINGS.find((l) => l.slug === slug);
}

/** S12: stránka bez revize je noindex a není v sitemap, llms.txt ani v odkazech z katalogu a návodů (jako návody, Ф9). */
export function isLandingIndexable(l: OborLanding): boolean {
  return !l.pendingReview || process.env.GUIDES_INDEX_UNREVIEWED === "1";
}

/** Indexovatelné stránky „EET pro …“ – rozcestník /eet-pro, sitemap, llms.txt. */
export function indexableLandings(): OborLanding[] {
  return OBOR_LANDINGS.filter(isLandingIndexable);
}

/** Stránky „EET pro …“ oboru katalogu (kadeřnictví → 1, gastro → 2). Koncepty před revizí ne. */
export function landingsForIndustry(industry: string): OborLanding[] {
  return OBOR_LANDINGS.filter((l) => l.industry === industry && l.industry !== "jine" && isLandingIndexable(l));
}

/** Stránky „EET pro …“, které vycházejí z daného návodu (banner v návodu). Koncepty před revizí ne. */
export function landingsForGuide(guideSlug: string): OborLanding[] {
  return OBOR_LANDINGS.filter((l) => l.guideSlug === guideSlug && isLandingIndexable(l));
}

/** FAQ stránky: vybrané otázky z revidovaného návodu + vlastní otázky stránky (S12) + produktové otázky z úvodní stránky. */
export function landingFaq(l: OborLanding): { q: string; a: string }[] {
  const guide = getGuide(l.guideSlug);
  const fromGuide = guide?.faq ? l.guideFaq.map((i) => guide.faq![i]).filter((x): x is NonNullable<typeof x> => !!x) : [];
  return [...fromGuide.map((f) => ({ q: f.q, a: f.a })), ...(l.extraFaq ?? []), ...PRODUCT_FAQ.map((f) => ({ q: f.q, a: f.a }))];
}

/**
 * S12: stránky „EET pro …“ po revizi do sitemap (STATIC_PAGES) – první tři tam mají vlastní řádky s datem.
 * Koncept se v sitemap objeví sám, jakmile mu po revizi smažete `pendingReview`.
 */
export function reviewedS12LandingPages(): { path: string; title: string; priority: number; changeFrequency: "weekly"; modified: string }[] {
  const S4 = new Set(["kadernice", "bistro", "restaurace"]);
  return indexableLandings()
    .filter((l) => !S4.has(l.slug))
    .map((l) => ({ path: landingPath(l), title: l.h1, priority: 0.8, changeFrequency: "weekly" as const, modified: l.modified }));
}
