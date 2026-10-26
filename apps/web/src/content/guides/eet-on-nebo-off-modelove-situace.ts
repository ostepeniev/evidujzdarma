import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";
import { calculateEetOff, type EetOffInput } from "@/lib/eet-off";

/**
 * S5-SLUŽBY (26. 10. 2026): modelové situace EET ON / EET OFF. Čísla počítá stejná funkce jako kalkulačka
 * (lib/eet-off.ts), takže se s ní nikdy nerozejdou. Koncept – noindex do odborné revize (Ф9).
 */
type Situation = { who: string; story: string; input: EetOffInput };

const BASE: EetOffInput = { band: 1, income: 600_000, minutesPerDay: 0, workDaysPerMonth: 21, hourlyRate: 300, toolsMonthly: 0, hardwareOneOff: 0, startMonth: 1 };

export const SITUATIONS: readonly Situation[] = [
  {
    who: "Kadeřnice v salonu",
    story: "6 klientek denně, platí hotově nebo kartou, 21 pracovních dní. Účtenka v mobilu zabere asi 20 vteřin, tedy 2 minuty denně; hodina práce za 400 Kč.",
    input: { ...BASE, income: 700_000, minutesPerDay: 2, hourlyRate: 400 },
  },
  {
    who: "Stánek s medem na trzích",
    story: "8 trhů měsíčně, asi 40 prodejů za trh. Při 15 vteřinách na prodej je to 10 minut evidence za trh; hodina za 300 Kč.",
    input: { ...BASE, income: 400_000, minutesPerDay: 10, workDaysPerMonth: 8 },
  },
  {
    who: "Instalatér placený u zákazníka",
    story: "Většinu zakázek fakturuje převodem (to se neeviduje), ale 2 zákazníci denně platí hotově na místě – 1 minuta na účtenku; hodina za 500 Kč.",
    input: { ...BASE, income: 900_000, minutesPerDay: 2, hourlyRate: 500 },
  },
  {
    who: "Lektorka jógy",
    story: "Kurzy se platí převodem předem, na místě zaplatí jen pár lidí – zhruba 1 minuta evidence za 8 lekcí v měsíci; hodina za 350 Kč.",
    input: { ...BASE, income: 450_000, minutesPerDay: 1, workDaysPerMonth: 8, hourlyRate: 350 },
  },
  {
    who: "Malý obchod bez chytrého telefonu",
    story: "Majitel by kvůli evidenci kupoval tablet a tiskárnu za 9 000 Kč a každý prodej by zadával ručně – asi 15 minut denně, 22 dní v měsíci; hodina za 250 Kč.",
    input: { ...BASE, income: 800_000, minutesPerDay: 15, workDaysPerMonth: 22, hourlyRate: 250, hardwareOneOff: 9_000 },
  },
];

function verdictLabel(v: "eet-off" | "evidence" | "tie"): string {
  return v === "evidence" ? "Evidovat (EET ON)" : v === "eet-off" ? "EET OFF" : "Vychází nastejno";
}

export function situationRows(): string[][] {
  return SITUATIONS.map((s) => {
    const r = calculateEetOff(s.input);
    if (!r.eligible) throw new Error(`Modelová situace „${s.who}“ nesplňuje podmínky EET OFF`);
    return [s.who, formatKc(r.evidenceYearly), formatKc(r.surchargeYearly), verdictLabel(r.verdict)];
  });
}

const surchargeYearly = FACTS.eetOff.surchargeYearly;

export const eetOnNeboOffModeloveSituace: Guide = {
  slug: "eet-on-nebo-off-modelove-situace",
  category: "povinnosti",
  title: "EET ON, nebo OFF? 5 modelových situací s čísly",
  h1: "EET ON, nebo EET OFF? Pět modelových situací",
  description:
    "Kadeřnice, stánek, instalatér, lektorka i obchod bez pokladny: na číslech ukazujeme, kdy se paušalistovi vyplatí evidovat tržby a kdy zvolit EET OFF.",
  lead: `Od **1. 1. 2027** si paušalista v 1. pásmu s příjmy do 1 milionu Kč vybírá: evidovat tržby, nebo platit přirážku **${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně** (${formatKc(surchargeYearly)} ročně). S pokladnou zdarma rozhoduje hlavně čas, který evidenci věnujete. Na pěti modelových situacích ukazujeme, kdy která volba vychází levněji.`,
  summary: [
    `EET OFF stojí ${formatKc(surchargeYearly)} ročně; smí ho zvolit jen fyzická osoba v 1. pásmu paušálního režimu s příjmy do 1 mil. Kč.`,
    "S pokladnou zdarma vychází evidence levněji téměř vždy, když vám nezabere víc než pár minut denně.",
    "EET OFF se vyplácí hlavně tam, kde byste evidenci dělali ručně nebo kvůli ní kupovali zařízení.",
    `Rozhodnutí platí na celý rok; přihlásit se k EET OFF je nutné do ${FACTS.eetOff.deadline}.`,
  ],
  sections: [
    {
      id: "jak-pocitame",
      heading: "Jak počítáme",
      blocks: [
        {
          p: `Porovnáváme dvě částky za rok. Na jedné straně přirážka EET OFF ${formatKc(surchargeYearly)}. Na druhé náklady evidence: čas, který jí denně věnujete, krát cena vaší hodiny, plus měsíční cena pokladny a případné zařízení rozpočítané na 3 roky. Stejně počítá naše [kalkulačka EET OFF](/kalkulacka-eet-off) – čísla níže z ní vycházejí.`,
        },
        {
          note: "Jde o modelové situace s odhadnutými čísly, ne o radu pro váš konkrétní případ. Výsledek se mění hlavně s tím, kolik minut denně vám evidence opravdu zabere.",
        },
      ],
    },
    {
      id: "situace",
      heading: "Pět modelových situací",
      blocks: [
        { ul: SITUATIONS.map((s) => `**${s.who}:** ${s.story}`) },
        {
          table: {
            head: ["Situace", "Evidence za rok", "EET OFF za rok", "Vychází lépe"],
            rows: situationRows(),
            caption: "Pokladna zdarma (0 Kč měsíčně), celý rok podnikání. Rozdíl do 1 200 Kč ročně považujeme za nerozhodný.",
          },
        },
        {
          p: "U čtyř z pěti situací vychází evidence levněji – často o víc než 10 000 Kč ročně. EET OFF vyhrává až tam, kde by evidence znamenala ruční zadávání a nákup zařízení.",
        },
      ],
    },
    {
      id: "co-cisla-neukazuji",
      heading: "Co čísla neukazují",
      blocks: [
        {
          ul: [
            "**Pohodlí a klid.** Kdo nechce řešit certifikát, pokladnu a signál, může EET OFF brát jako pojistku i za cenu pár tisíc navíc.",
            "**Signál.** Bez připojení se tržba odešle dodatečně – pokladna ji uloží a pošle, jakmile je spojení. Podrobně v návodu [EET bez internetu](/navody/eet-bez-internetu).",
            `**Celý rok.** ${FACTS.eetOff.binding}`,
            `**Růst příjmů.** ${FACTS.eetOff.overLimit}`,
            "**Platby převodem.** Bankovní převod na základě faktury se neeviduje – kdo bere hotovost a karty jen výjimečně, eviduje málo. Viz [Kontaktní platba](/navody/kontaktni-platba).",
          ],
        },
      ],
    },
    {
      id: "jak-se-rozhodnout",
      heading: "Jak se rozhodnout",
      blocks: [
        {
          p: `Spočítejte si svou situaci v [kalkulačce EET OFF](/kalkulacka-eet-off) a výsledek proberte se svou účetní nebo daňovým poradcem. Pokud zvolíte EET OFF, oznámení podejte do **${FACTS.eetOff.deadline}** – postup najdete v návodu [EET OFF](/navody/eet-off). Pokud budete evidovat, začněte od 1. 11. 2026 v DIS+ podle návodu [Jak aktivovat DIS+ a certifikát](/navody/jak-aktivovat-dis-a-certifikat).`,
        },
        { cta: "eet-off" },
      ],
    },
  ],
  faq: [
    {
      q: "Kdy se EET OFF vyplatí?",
      a: `Když by vás evidence stála víc než ${formatKc(surchargeYearly)} ročně – typicky při ručním zadávání každého prodeje nebo když byste kvůli evidenci kupovali zařízení. S pokladnou zdarma a pár minutami denně vychází evidence levněji.`,
    },
    {
      q: "Kolik minut evidence denně vyjde stejně jako přirážka?",
      a: "Při hodině za 300 Kč a 21 pracovních dnech v měsíci zhruba 13 minut denně. Přesně si to přepočítáte podle svých čísel v kalkulačce EET OFF.",
    },
    { q: "Může EET OFF zvolit i s. r. o.?", a: `Ne. ${FACTS.eetOff.naturalOnly}` },
    { q: "Do kdy se musím rozhodnout?", a: FACTS.eetOff.howTo },
    { q: "Můžu EET OFF během roku zrušit?", a: `Ne. ${FACTS.eetOff.binding} ${FACTS.eetOff.exit}` },
  ],
  howTo: {
    name: "Jak se rozhodnout mezi evidencí tržeb a EET OFF",
    description: "Ověřte, zda EET OFF smíte zvolit, odhadněte čas na evidenci a porovnejte obě varianty v kalkulačce.",
    steps: [
      { name: "Ověřte podmínky", text: "EET OFF smí zvolit jen fyzická osoba v 1. pásmu paušálního režimu s příjmy ze samostatné činnosti do 1 mil. Kč." },
      { name: "Odhadněte čas na evidenci", text: "Spočítejte, kolik kontaktních plateb denně přijímáte a kolik vteřin vám zabere jedna účtenka." },
      { name: "Porovnejte v kalkulačce", text: "Zadejte čísla do kalkulačky EET OFF a porovnejte roční náklady evidence s přirážkou." },
      { name: "Rozhodněte včas", text: `Výsledek proberte s účetní nebo daňovým poradcem; k EET OFF se přihlaste do ${FACTS.eetOff.deadline}.` },
    ],
  },
  sources: [SOURCES.eetOff, SOURCES.eetOffJak, SOURCES.pausal2027, SOURCES.kdoMusi],
  related: ["eet-off", "eet-a-pausalni-dan", "kontaktni-platba", "eet-bez-internetu"],
  published: "2026-10-26",
  updated: "2026-10-26",
  changelog: [{ date: "2026-10-26", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
