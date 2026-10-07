import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

const p26 = FACTS.pausal[2026];
const p27 = FACTS.pausal[2027];
const s = FACTS.eetOff.surchargeMonthly;

export const eetAPausalniDan: Guide = {
  slug: "eet-a-pausalni-dan",
  category: "povinnosti",
  title: "EET 2.0 a paušální daň: co platí pro paušalisty",
  h1: "EET a paušální daň: musí paušalisté evidovat?",
  description:
    "Paušalisté musí od 1. 1. 2027 evidovat tržby jako ostatní. Výjimkou je EET OFF v 1. pásmu za 1 400 Kč měsíčně. Přehled záloh 2027, lhůta 11. 1. a rozhodování.",
  lead: `Ano. Paušální režim vás evidence tržeb nezbavuje – kdo přijímá platby osobně, eviduje od **1. 1. 2027** jako ostatní. Jedinou výjimkou je **EET OFF** pro 1. pásmo s příjmy do 1 mil. Kč: přirážka **${formatKc(s)} měsíčně**, takže záloha v 1. pásmu vyjde předběžně na ${formatKc(p27.band1 + s)}. Rozhodnout se musíte do **${FACTS.eetOff.deadline}**.`,
  summary: [
    "Paušální daň a EET jsou dvě samostatné věci – paušalista eviduje kontaktní platby jako každý jiný podnikatel.",
    `EET OFF je jen pro 1. pásmo a příjmy do 1 mil. Kč: přirážka ${formatKc(s)} měsíčně k paušální záloze.`,
    "Ve 2. a 3. pásmu se evidenci vyhnout nelze (pokud kontaktní platby přijímáte).",
    `Lhůta pro vstup do paušálního režimu i pro EET OFF na rok 2027: ${FACTS.eetOff.deadline}.`,
    "Výše paušálních záloh pro rok 2027 je zatím předběžná.",
  ],
  sections: [
    {
      id: "zakladni-vztah",
      heading: "Paušální daň a EET spolu (skoro) nesouvisí",
      blocks: [
        {
          p: "Paušální režim zjednodušuje placení daně z příjmů a pojistného: platíte jednu měsíční zálohu a nepodáváte daňové přiznání ani přehledy pro pojišťovny. **Evidence tržeb je ale jiná povinnost** podle jiného zákona. Rozhoduje o ní to, zda přijímáte kontaktní platby – hotovost, kartu nebo QR kód na místě –, ne způsob, jakým platíte daň.",
        },
        { p: FACTS.whoMust.summary },
        {
          p: "Jediné místo, kde se oba systémy potkávají, je **EET OFF** – dobrovolná přirážka k paušální záloze, kterou si paušalista v 1. pásmu „koupí“ osvobození od evidence.",
        },
      ],
    },
    {
      id: "zalohy-2027",
      heading: "Paušální zálohy 2026 a 2027 a přirážka EET OFF",
      blocks: [
        {
          table: {
            head: ["Pásmo", "Záloha 2026", "Záloha 2027 (předběžně)", "S EET OFF 2027"],
            rows: [
              ["1. pásmo", formatKc(p26.band1), formatKc(p27.band1), formatKc(p27.band1 + s)],
              ["2. pásmo", formatKc(p26.band2), formatKc(p27.band2), "EET OFF nelze"],
              ["3. pásmo", formatKc(p26.band3), formatKc(p27.band3), "EET OFF nelze"],
            ],
            caption: `Měsíční částky. Záloha v 1. pásmu pro rok 2026 je uvedena po snížení, o kterém v roce 2026 informovala Finanční správa. Přirážka EET OFF ${formatKc(s)} je pevná.`,
          },
        },
        {
          note: "Částky pro rok 2027 vycházejí z oznámených parametrů a zatím je Finanční správa definitivně nezveřejnila. Po vydání oficiálních údajů tabulku aktualizujeme.",
          tone: "warn",
        },
      ],
    },
    {
      id: "kdo-muze-eet-off",
      heading: "Kdo z paušalistů může zvolit EET OFF",
      blocks: [
        { p: FACTS.eetOff.summary },
        {
          ul: [
            "jste v **1. pásmu** (nebo do něj od roku 2027 vstupujete či přecházíte),",
            "vaše **příjmy ze samostatné činnosti za předchozí rok nepřesáhly 1 mil. Kč** – bez ohledu na druh činnosti,",
            "včas podáte oznámení (do 11. 1. 2027).",
          ],
        },
        { h3: "Pravidla EET OFF během roku" },
        {
          ul: [
            FACTS.eetOff.naturalOnly,
            `${FACTS.eetOff.binding} Za celý rok zaplatíte přirážku ${formatKc(FACTS.eetOff.surchargeYearly)}.`,
            FACTS.eetOff.midYear,
            FACTS.eetOff.overLimit,
            FACTS.eetOff.exit,
          ],
        },
        {
          p: "Pozor: do 1. pásma se lze za určitých podmínek dostat i s příjmy do 1,5 nebo 2 mil. Kč (podle podílu příjmů s 80% nebo 60% výdajovým paušálem). Na EET OFF ale takový paušalista nedosáhne – strop pro přirážku je pevně **1 mil. Kč**.",
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "rozhodovani",
      heading: "Jak se rozhodnout do 11. ledna 2027",
      blocks: [
        {
          table: {
            head: ["Vaše situace", "Co zvážit"],
            rows: [
              ["V paušálu, 1. pásmo, příjmy do 1 mil. Kč", "Evidence zdarma (MOJE eet, komerční pokladna), nebo EET OFF za " + formatKc(s * 12) + " ročně."],
              ["V paušálu, 1. pásmo, příjmy 1–2 mil. Kč", "EET OFF nelze – pokud přijímáte kontaktní platby, budete evidovat."],
              ["V paušálu, 2. nebo 3. pásmo", "EET OFF nelze; evidujete kontaktní platby."],
              ["Mimo paušál, zvažujete vstup", "Paušální režim i přirážku můžete zvolit v jednom oznámení do 11. 1. 2027 – pokud splníte podmínky."],
              ["Platby jen převodem na fakturu", "Evidovat nemusíte nic, EET OFF je zbytečný."],
            ],
          },
        },
        {
          p: "Pro výpočet použijte [kalkulačku EET OFF](/kalkulacka-eet-off) a podrobnosti najdete v návodu [EET OFF: vyplatí se?](/navody/eet-off).",
        },
      ],
    },
    {
      id: "lhuty",
      heading: "Lhůty: paušální režim i EET OFF do 10. dne roku",
      blocks: [
        {
          p: "Do paušálního režimu se vstupuje (a mění se pásmo) oznámením do 10. ledna. Stejná lhůta platí pro přihlášení k přirážce EET OFF. V roce 2027 připadá 10. leden na neděli, proto lhůta končí v **pondělí 11. 1. 2027**.",
        },
        { p: FACTS.eetOff.howTo },
        {
          p: "Kdo do paušálu teprve vstupuje, uvede přihlášení k přirážce přímo v oznámení o vstupu do paušálního režimu. Kdo v něm už je, podá samostatné oznámení o přihlášení k přirážce (nebo ho spojí s oznámením o změně pásma).",
        },
      ],
    },
    {
      id: "tipy",
      heading: "Praktické tipy pro paušalisty",
      blocks: [
        {
          ul: [
            "**Přehled z pokladny není celkový příjem.** EET zachytí jen kontaktní platby, ne převody na fakturu. Limit příjmů pro paušál hlídejte z celého příjmu.",
            "**Ani v EET OFF nezapomeňte na doklad.** Na žádost zákazníka ho vydáváte podle zákona o ochraně spotřebitele – viz [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)",
            `**Rozhodnutí platí celý rok.** EET OFF se v průběhu roku nemění; zvažte, jak se vaše podnikání v roce 2027 vyvine. ${FACTS.eetOff.overLimit}`,
            "**Kdo EET OFF nezvolí, eviduje od 1. 1. 2027.** „Pilotní“ leden není zákonná výjimka – pokladnu si vyzkoušejte v prosinci 2026.",
          ],
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Jsem paušalista. Musím evidovat tržby?",
      a: "Ano, pokud přijímáte platby osobně (hotově, kartou, QR kódem na místě). Paušální režim od evidence neosvobozuje. Výjimkou je EET OFF v 1. pásmu s příjmy do 1 mil. Kč.",
    },
    {
      q: "Kolik budu platit s EET OFF?",
      a: `V 1. pásmu předběžně ${formatKc(p27.band1)} paušální zálohy plus ${formatKc(s)} přirážky, tedy ${formatKc(p27.band1 + s)} měsíčně. Částka zálohy pro rok 2027 ještě není definitivní.`,
    },
    {
      q: "Jsem ve 2. pásmu. Můžu EET OFF?",
      a: "Ne. EET OFF je jen pro 1. pásmo paušálního režimu a příjmy ze samostatné činnosti do 1 mil. Kč za předchozí rok.",
    },
    {
      q: "Můžu do paušálu vstoupit a zároveň zvolit EET OFF?",
      a: "Ano, pokud splníte podmínky paušálního režimu i EET OFF. Přihlášení k přirážce uvedete přímo v oznámení o vstupu do paušálního režimu, pro rok 2027 do 11. 1. 2027.",
    },
    {
      q: "Co když mi příjmy během roku přesáhnou 1 mil. Kč?",
      a: FACTS.eetOff.overLimit,
    },
    {
      q: "Začínám podnikat v průběhu roku. Platím přirážku za celý rok?",
      a: `Ne. ${FACTS.eetOff.midYear}`,
    },
  ],
  sources: [
    SOURCES.eetOff,
    SOURCES.eetOffJak,
    SOURCES.pausal2026,
    SOURCES.pausal2027,
    SOURCES.fsPausalFaq,
    SOURCES.fsPausalLhuta,
    SOURCES.kdoMusi,
    SOURCES.harmonogram,
  ],
  related: ["eet-off", "koho-se-eet-tyka", "eet-2-0-kompletni-pruvodce"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: paušalisté bez EET OFF evidují od 1. 1. 2027, ne od 1. 2. 2027. Doplněna pravidla EET OFF během roku (zahájení podnikání, překročení 1 mil. Kč, odhlášení).",
    },
  ],
  reviewedBy: REVIEWER.name,
};
