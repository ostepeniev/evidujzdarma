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
  slug: "kadernice" | "bistro" | "restaurace";
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
  tools: readonly { href: string; label: string; text: string }[];
  catalog: { href: string; label: string };
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
    { title: "Spropitné: osvobození až 7 %", text: "Od 1. 1. 2027 je spropitné zaměstnanců ze stravovacích služeb osvobozené až do 7 % měsíčních příjmů podniku z těchto služeb." },
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
        tone: "maybe",
        text: "Výslovné stanovisko Finanční správy ke spropitnému v EET 2.0 zatím není. Když host zaplatí kartou i se spropitným, pokladna pracuje s celkovou přijatou částkou. Od **1. 1. 2027** je spropitné zaměstnanců ze stravovacích služeb osvobozené až do **7 %** měsíčních příjmů podniku z těchto služeb. Postup proberte s účetní.",
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

export const OBOR_LANDINGS: readonly OborLanding[] = [KADERNICE, BISTRO, RESTAURACE];

export const landingPath = (l: Pick<OborLanding, "slug">) => `/eet-pro/${l.slug}`;

export function getLanding(slug: string): OborLanding | undefined {
  return OBOR_LANDINGS.find((l) => l.slug === slug);
}

/** Stránky „EET pro …“ oboru katalogu (kadeřnictví → 1, gastro → 2). */
export function landingsForIndustry(industry: string): OborLanding[] {
  return OBOR_LANDINGS.filter((l) => l.industry === industry);
}

/** Stránky „EET pro …“, které vycházejí z daného návodu (banner v návodu). */
export function landingsForGuide(guideSlug: string): OborLanding[] {
  return OBOR_LANDINGS.filter((l) => l.guideSlug === guideSlug);
}

/** FAQ stránky: vybrané otázky z revidovaného návodu + produktové otázky z úvodní stránky. */
export function landingFaq(l: OborLanding): { q: string; a: string }[] {
  const guide = getGuide(l.guideSlug);
  const fromGuide = guide?.faq ? l.guideFaq.map((i) => guide.faq![i]).filter((x): x is NonNullable<typeof x> => !!x) : [];
  return [...fromGuide.map((f) => ({ q: f.q, a: f.a })), ...PRODUCT_FAQ.map((f) => ({ q: f.q, a: f.a }))];
}
