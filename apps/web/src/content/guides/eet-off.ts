import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";

const surcharge = FACTS.eetOff.surchargeMonthly;
const band1 = FACTS.pausal[2027].band1;
const band1With = band1 + surcharge;

export const eetOff: Guide = {
  slug: "eet-off",
  category: "povinnosti",
  title: "EET OFF 2027: vyplatí se přirážka 1 400 Kč?",
  h1: "EET OFF: vyplatí se přirážka místo evidence?",
  description:
    "EET OFF: paušalista v 1. pásmu s příjmy do 1 mil. Kč zaplatí 1 400 Kč měsíčně navíc a tržby neeviduje. Kdo může, lhůta 11. 1. 2027 a kdy se to vyplatí.",
  lead: `EET OFF je dobrovolná výjimka: OSVČ v **1. pásmu paušálního režimu** s příjmy do **1 mil. Kč** ročně zaplatí k paušální záloze přirážku **${formatKc(surcharge)} měsíčně** (${formatKc(FACTS.eetOff.surchargeYearly)} ročně) a tržby neeviduje. Pro rok 2027 se musíte přihlásit **do ${FACTS.eetOff.deadline}**. Pozdní oznámení je neúčinné.`,
  summary: [
    `Přirážka ${formatKc(surcharge)} měsíčně, tedy ${formatKc(FACTS.eetOff.surchargeYearly)} za rok.`,
    "Jen fyzické osoby v 1. pásmu paušálního režimu s příjmy ze samostatné činnosti za předchozí rok do 1 mil. Kč.",
    `Lhůta pro rok 2027: ${FACTS.eetOff.deadline} (10. 1. připadá na neděli). Pozdě podané oznámení neplatí.`,
    `S předběžnou paušální zálohou ${formatKc(band1)} by měsíční platba v 1. pásmu činila ${formatKc(band1With)}.`,
    "Režim platí celý kalendářní rok, změnit ho lze až od dalšího roku.",
  ],
  sections: [
    {
      id: "co-je-eet-off",
      heading: "Co je EET OFF",
      blocks: [
        { p: FACTS.eetOff.summary },
        {
          p: "Jde o „vykoupení se“ z evidence. Kdo se k přirážce přihlásí, nemusí v daném roce evidovat žádné tržby – nepotřebuje pokladní certifikát, evidenční jednotky ani pokladnu. Platí jen vyšší měsíční paušální zálohu.",
        },
        {
          note: `Starší články zmiňují i částku 1 500 Kč. Rozhodující je údaj z eet.gov.cz: přirážka činí **${formatKc(surcharge)} měsíčně** a platí se spolu s paušální zálohou.`,
        },
      ],
    },
    {
      id: "kdo-muze",
      heading: "Kdo se může přihlásit",
      blocks: [
        {
          p: "Podle Finanční správy musí být splněny všechny podmínky:",
        },
        {
          ul: [
            "jste **fyzická osoba** (OSVČ) – firmy a s. r. o. EET OFF využít nemohou,",
            "jste v **1. pásmu paušálního režimu** (nebo do něj od nového roku vstupujete či přecházíte z vyššího pásma),",
            "vaše **příjmy ze samostatné činnosti za předchozí rok nepřesáhly 1 mil. Kč** – bez ohledu na to, jaké procento paušálních výdajů se na ně vztahuje.",
          ],
        },
        {
          p: "Pozor na rozdíl mezi limity: do 1. pásma paušálního režimu se za určitých podmínek vejdete i s vyššími příjmy (až 1,5 nebo 2 mil. Kč podle druhu činnosti). Pro EET OFF ale platí pevný strop **1 mil. Kč** pro všechny.",
        },
        {
          p: `Přihlásit se může i ten, kdo činnost během roku teprve zahajuje a současně vstupuje do 1. pásma – v takovém případě se lze přihlásit i v průběhu roku. ${FACTS.eetOff.midYear} Podrobnosti k paušálnímu režimu najdete v návodu [EET a paušální daň](/navody/eet-a-pausalni-dan).`,
        },
      ],
    },
    {
      id: "kolik-to-stoji",
      heading: "Kolik vás EET OFF stojí",
      blocks: [
        {
          table: {
            head: ["", "Bez EET OFF", "S EET OFF"],
            rows: [
              ["Měsíční paušální záloha v 1. pásmu (2027, předběžně)", formatKc(band1), formatKc(band1With)],
              ["Ročně", formatKc(band1 * 12), formatKc(band1With * 12)],
              ["Evidence tržeb", "Ano, od 1. 1. 2027", "Ne"],
              ["Pokladna, certifikát, evidenční jednotky", "Potřebujete", "Nepotřebujete"],
            ],
            caption: `Výše paušální zálohy pro rok 2027 je předběžná (pro 2026 činí v 1. pásmu ${formatKc(FACTS.pausal[2026].band1)}). Přirážka ${formatKc(surcharge)} je pevná.`,
          },
        },
        {
          note: "Částka paušální zálohy na rok 2027 zatím není definitivně publikovaná Finanční správou – vychází z oznámených parametrů. Po zveřejnění oficiálních částek tabulku aktualizujeme.",
          tone: "warn",
        },
      ],
    },
    {
      id: "kdy-se-vyplati",
      heading: "Kdy se EET OFF vyplatí a kdy ne",
      blocks: [
        {
          p: `Otázka nezní „kolik mám tržeb“, ale „kolik mě stojí evidence“. Pokladní aplikace dnes existují zdarma – státní MOJE eet i komerční řešení včetně naší pokladny. Rozhodujete tedy hlavně mezi ${formatKc(FACTS.eetOff.surchargeYearly)} ročně a vlastním časem a pohodlím.`,
        },
        { h3: "EET OFF dává smysl, když…" },
        {
          ul: [
            "přijímáte platby na místech **bez spolehlivého signálu** a nechcete řešit dodatečné odesílání,",
            "prodáváte **sezónně nebo nárazově** (trhy, jarmarky) a nechcete kvůli pár akcím zavádět pokladnu,",
            "nemáte chytrý telefon nebo vám práce s aplikacemi nevyhovuje,",
            "chcete mít jistotu, že vám nehrozí pokuta za chybu v evidenci.",
          ],
        },
        { h3: "EET OFF se spíš nevyplatí, když…" },
        {
          ul: [
            "už používáte platební terminál nebo pokladnu a evidence vás stojí pár vteřin na tržbu,",
            "většina vašich tržeb přichází převodem na fakturu – ty se neevidují vůbec, takže evidovat byste měli málo,",
            "očekáváte, že příjmy v roce 2027 výrazně porostou (s vyššími příjmy můžete z 1. pásma vypadnout),",
            `${formatKc(FACTS.eetOff.surchargeYearly)} ročně je pro vás citelná částka.`,
          ],
        },
        {
          p: "Spočítejte si to v naší [kalkulačce EET OFF](/kalkulacka-eet-off) – porovná přirážku s náklady na evidenci ve vaší situaci.",
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "jak-se-prihlasit",
      heading: "Jak a kdy se přihlásit",
      blocks: [
        { p: FACTS.eetOff.howTo },
        {
          ol: [
            "**Jste už v 1. pásmu paušálního režimu:** podejte správci daně *Oznámení o přihlášení k přirážce*.",
            "**Do paušálního režimu teprve vstupujete:** přihlášení k přirážce uvedete přímo v *Oznámení o vstupu do paušálního režimu*.",
            "**Přecházíte z vyššího pásma do 1. pásma:** přirážku uvedete v *Oznámení o změně pásma*.",
          ],
        },
        {
          p: `Pro rok 2027 je poslední den **${FACTS.eetOff.deadline}**. Oznámení se podává správci daně (finančnímu úřadu), nejpohodlněji elektronicky přes portál MOJE daně. Kdo lhůtu propásne, musí v roce 2027 evidovat – přihlášení vzniká vždy od začátku roku (výjimkou je zahájení činnosti během roku).`,
        },
      ],
    },
    {
      id: "zmeny-behem-roku",
      heading: "Co když se situace během roku změní",
      blocks: [
        {
          p: `${FACTS.eetOff.binding} Pokud vystoupíte z paušálního režimu nebo z 1. pásma, EET OFF tím také končí.`,
        },
        {
          table: {
            head: ["Situace", "Co platí"],
            rows: [
              ["Chcete z EET OFF odejít", `${FACTS.eetOff.exit} Evidovat pak budete od tohoto nového roku.`],
              ["Příjmy během roku přesáhnou 1 mil. Kč", FACTS.eetOff.overLimit],
              ["Začínáte podnikat v průběhu roku", FACTS.eetOff.midYear],
              ["Jste s. r. o. nebo jiná právnická osoba", `${FACTS.eetOff.naturalOnly} Firma ho zvolit nemůže.`],
            ],
            caption: `Přirážka ${formatKc(surcharge)} měsíčně, tedy ${formatKc(FACTS.eetOff.surchargeYearly)} za celý rok.`,
          },
        },
        {
          note: "I v režimu EET OFF musíte zákazníkovi na požádání vydat doklad podle zákona o ochraně spotřebitele. Viz [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Kolik stojí EET OFF?",
      a: `Přirážka činí ${formatKc(surcharge)} měsíčně, tedy ${formatKc(FACTS.eetOff.surchargeYearly)} ročně, a platí se spolu s paušální zálohou.`,
    },
    {
      q: "Do kdy se musím přihlásit k EET OFF?",
      a: `Pro rok 2027 do ${FACTS.eetOff.deadline}. Lhůta je 10. den zdaňovacího období, a protože 10. 1. 2027 je neděle, posouvá se na pondělí 11. 1. Pozdní oznámení je neúčinné.`,
    },
    {
      q: "Může EET OFF využít s. r. o. nebo OSVČ mimo paušální režim?",
      a: "Ne. Režim je jen pro fyzické osoby, a to v 1. pásmu paušálního režimu s příjmy ze samostatné činnosti do 1 mil. Kč. Ostatní mohou evidenci uniknout jen tehdy, když nepřijímají kontaktní platby nebo mají vyjmutou činnost – viz [Koho se EET týká](/navody/koho-se-eet-tyka).",
    },
    {
      q: "Mám příjmy 1,3 mil. Kč a jsem v 1. pásmu. Můžu EET OFF?",
      a: "Ne. I když se do 1. pásma paušálního režimu vejdete díky vyššímu limitu pro některé činnosti, pro EET OFF platí strop 1 mil. Kč příjmů ze samostatné činnosti za předchozí rok.",
    },
    {
      q: "Můžu se z EET OFF během roku odhlásit?",
      a: `Ne. ${FACTS.eetOff.binding} ${FACTS.eetOff.exit}`,
    },
    {
      q: "Co když mi příjmy během roku přesáhnou 1 mil. Kč?",
      a: FACTS.eetOff.overLimit,
    },
    {
      q: "Začínám podnikat v průběhu roku. Od kdy platím přirážku?",
      a: `${FACTS.eetOff.midYear} Přihlásit se můžete, pokud současně vstupujete do 1. pásma paušálního režimu.`,
    },
  ],
  sources: [SOURCES.eetOff, SOURCES.eetOffJak, SOURCES.pausal2026, SOURCES.pausal2027, SOURCES.fsPausalFaq, SOURCES.mfPredstavuje],
  related: ["eet-a-pausalni-dan", "koho-se-eet-tyka", "eet-2-0-kompletni-pruvodce"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: evidence bez EET OFF platí od 1. 1. 2027, ne od 1. 2. 2027. Doplněna pravidla pro zahájení podnikání v průběhu roku, překročení 1 mil. Kč a odhlášení.",
    },
  ],
  reviewedBy: null,
};
