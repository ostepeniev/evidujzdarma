import { FACTS } from "../facts";
import type { HelpArticle } from "./types";

/**
 * Prodej a platby: components/pos/register-screen.tsx (účet, sleva), payment-sheet.tsx (způsoby platby, rozdělená platba,
 * QR, spropitné), setup-app.tsx (katalog). Poukazy podle PAYMENT_LABEL a textů v okně Platba (R5.10, R6.7).
 */
export const PRODEJ: readonly HelpArticle[] = [
  {
    slug: "prvni-prodej",
    topic: "prodej",
    title: "První prodej v pokladně krok za krokem",
    description:
      "Jak v pokladně EvidujZdarma prodat: rychlá tlačítka nebo částka na klávesnici, množství, sleva v procentech či korunách, platba a účtenka pro zákazníka.",
    lead: "Prodej začíná na obrazovce **Prodej**. Vlevo zadáváte položky, vpravo vidíte **Účet** s celkovou částkou. Tržba se uloží až po potvrzení platby.",
    steps: [
      { name: "Přihlaste se", text: "Pokud pokladnu používá víc lidí, objeví se „Kdo bude prodávat?“. Klepněte na své jméno a zadejte PIN." },
      {
        name: "Přidejte položky",
        text: "Klepněte na rychlé tlačítko zboží, nebo naťukejte částku na klávesnici, případně vyplňte **Název (nepovinné)**, a klepněte na **+ Přidat částku**. Položka bez názvu se jmenuje „Položka“.",
      },
      { name: "Upravte množství", text: "Tlačítky **−** a **+** u položky měníte počet kusů. Stejné zboží přidané znovu se jen přičte." },
      {
        name: "Přidejte slevu (nepovinné)",
        text: "Klepněte na **Přidat slevu**, zvolte **Procenta** nebo **Částka**, vyberte nabízenou hodnotu nebo ji napište a dejte **Použít**. Tlačítko **Bez slevy** slevu zruší.",
      },
      {
        name: "Zaplaťte",
        text: "Klepněte na **Zaplatit**, zvolte způsob platby a potvrďte tlačítkem **Zaplaceno – … Kč**. Ukáže se účtenka; další prodej začnete tlačítkem **Nová tržba**.",
      },
    ],
    sections: [
      {
        id: "dobre-vedet",
        heading: "Dobré vědět",
        blocks: [
          {
            ul: [
              "**Zrušit účet** pod tlačítkem Zaplatit jen vyprázdní rozpracovaný nákup – nic se neeviduje.",
              "U plátce DPH má částka zadaná na klávesnici sazbu 21 %. Zboží s jinou sazbou si dejte do [katalogu](/napoveda/katalog-rychla-tlacitka).",
              "Sleva se na účtence ukáže jako samostatný řádek „Sleva“.",
              "Bez rizika si prodej vyzkoušíte v [ukázce pokladny](/ukazka).",
            ],
          },
        ],
      },
    ],
    related: ["zpusoby-platby", "katalog-rychla-tlacitka", "tisk-uctenky", "vratka"],
    guides: ["musim-vydavat-uctenku"],
    updated: "2026-10-17",
  },
  {
    slug: "katalog-rychla-tlacitka",
    topic: "prodej",
    title: "Katalog zboží a rychlá tlačítka",
    description:
      "Jak v pokladně EvidujZdarma nastavit rychlá tlačítka: název, cena a sazba DPH. Prodej jedním klepnutím, mazání položek a kdy se změny v pokladně projeví.",
    lead: "Nejčastější zboží a služby si uložte jako rychlá tlačítka. Prodej pak stačí jedním klepnutím a obsluha nemusí cenu pamatovat ani psát.",
    steps: [
      { name: "Otevřete katalog", text: "V **Nastavení pokladny** sjeďte ke kroku **Rychlá tlačítka (katalog)**." },
      {
        name: "Vyplňte položku",
        text: "Zadejte **Název položky** (například „Střih pánský“) a **Cena Kč**. Plátce DPH vybere ještě sazbu 21 %, 12 % nebo 0 %.",
      },
      { name: "Přidejte ji", text: "Klepněte na **+ Přidat**. Položka se zařadí na konec seznamu." },
      { name: "Prodávejte", text: "V pokladně se tlačítka ukážou nad klávesnicí na obrazovce **Prodej**. Každé klepnutí přidá do účtu jeden kus." },
    ],
    sections: [
      {
        id: "zmeny",
        heading: "Změny a mazání",
        blocks: [
          {
            p: "Tlačítkem **Upravit** změníte název, cenu, sazbu DPH, kategorii i kód / EAN a uložíte **Uložit změny**. Když zrušíte zaškrtnutí **Rychlé tlačítko v pokladně**, položka v katalogu zůstane, ale pokladna ji nenabídne. **Smazat** položku odstraní. Ve velkém katalogu pokladna hledá podle názvu, kategorie i kódu.",
          },
          {
            p: "Pokladna si nastavení načte, když se do ní vrátíte z jiné karty nebo aplikace, a jinak nejméně jednou za 5 minut. Katalog má uložený v zařízení, takže tlačítka fungují i bez signálu.",
          },
        ],
      },
    ],
    related: ["prvni-prodej", "zpusoby-platby", "pokladni-a-pin"],
    updated: "2026-10-17",
  },
  {
    slug: "zpusoby-platby",
    topic: "prodej",
    title: "Způsoby platby a spropitné",
    description:
      "Které způsoby platby pokladna EvidujZdarma nabízí – hotovost, karta, QR, stravenka, kredit a dárkový poukaz – jak vrátit hotovost a jak zadat spropitné.",
    lead: "Po klepnutí na **Zaplatit** se otevře okno **Platba** s částkou **K úhradě**. Způsob platby zvolíte jedním ze šesti tlačítek: **Hotovost**, **Karta**, **QR**, **Stravenka**, **Kredit** a **Dárkový**.",
    steps: [
      {
        name: "Hotovost",
        text: "Pod **Přijato** klepněte na nabízenou částku, nebo ji naťukejte. Pokladna ukáže, kolik vrátit („Vrátit“). Je-li přijato méně, upozorní: „Přijatá částka je nižší než cena.“",
      },
      {
        name: "Karta",
        text: "Platbu proveďte na svém platebním terminálu – pokladna terminál neovládá. Do pole **Spropitné (nepovinné)** můžete zapsat spropitné.",
      },
      {
        name: "QR, stravenka, kredit, poukaz",
        text: "Postup popisují články [QR platba v pokladně](/napoveda/qr-platba) a [Stravenky, kredit, dárkové poukazy a zálohy](/napoveda/poukazy-kredit-zalohy).",
      },
      { name: "Potvrďte", text: "Klepněte na **Zaplaceno – … Kč**. Tržba se uloží a pokladna ji odešle." },
    ],
    sections: [
      {
        id: "spropitne",
        heading: "Spropitné",
        blocks: [
          {
            p: "Spropitné pokladna nabízí jen u platby kartou. Na účtence je řádek „Mezisoučet“ a „Spropitné“, v přehledu dne samostatná částka. Při vratce se spropitné nevrací.",
          },
        ],
      },
      {
        id: "co-se-eviduje",
        heading: "Co se eviduje",
        blocks: [{ p: `${FACTS.evidenced.summary} Podrobně v návodu [Kontaktní platba](/navody/kontaktni-platba).` }],
      },
    ],
    related: ["qr-platba", "rozdelena-platba", "poukazy-kredit-zalohy"],
    guides: ["kontaktni-platba"],
    updated: "2026-10-17",
  },
  {
    slug: "qr-platba",
    topic: "prodej",
    title: "QR platba v pokladně",
    description:
      "Jak přijmout QR platbu v pokladně EvidujZdarma: číslo účtu v nastavení, QR kód s částkou na displeji a potvrzení platby až po připsání peněz na účet.",
    lead: "QR platba je platba z bankovní aplikace zákazníka na váš účet. Pokladna ukáže QR kód s přesnou částkou, zákazník ho naskenuje a platbu potvrdí ve své bance.",
    steps: [
      {
        name: "Doplňte číslo účtu",
        text: "V kroku **Firma** vyplňte **Číslo účtu pro QR platby** – ve tvaru 123456789/0100 nebo jako IBAN – a klepněte na **Uložit změny**.",
      },
      { name: "Zvolte QR", text: "V okně **Platba** klepněte na **QR**. Pokladna vytvoří QR kód přímo v zařízení, takže to jde i bez signálu." },
      {
        name: "Nechte zákazníka zaplatit",
        text: "Zákazník naskenuje kód v bankovní aplikaci. Každý doklad má vlastní variabilní symbol odvozený z čísla dokladu a ve zprávě pro příjemce je číslo dokladu a název firmy – platbu na výpisu snadno spárujete s účtenkou.",
      },
      { name: "Potvrďte po připsání", text: "Na **Zaplaceno – … Kč** klepněte až ve chvíli, kdy vám platba přišla na účet." },
    ],
    sections: [
      {
        id: "kdyz-se-qr-neukaze",
        heading: "Když se QR kód neukáže",
        blocks: [
          {
            p: "Hláška „Pro QR platbu doplňte číslo účtu v nastavení pokladny.“ znamená, že číslo účtu chybí. Po uložení si ho pokladna načte, jakmile se do ní vrátíte.",
          },
        ],
      },
      {
        id: "evidence",
        heading: "Evidence",
        blocks: [
          {
            p: `${FACTS.evidenced.summary} ${FACTS.evidenced.notEvidenced} QR kód pro platbu faktury vytvoříte v [generátoru QR platby](/qr-platba).`,
          },
        ],
      },
    ],
    related: ["zpusoby-platby", "firma-a-ares", "rozdelena-platba"],
    guides: ["kontaktni-platba"],
    updated: "2026-10-17",
  },
  {
    slug: "rozdelena-platba",
    topic: "prodej",
    title: "Rozdělená platba: zákazník platí víc způsoby",
    description:
      "Jak v pokladně EvidujZdarma rozdělit platbu – například část dárkovým poukazem a zbytek hotově nebo kartou. Nejvýš pět způsobů platby na jednu tržbu.",
    lead: "Když zákazník zaplatí část poukazem a zbytek hotově, nebo část kartou a zbytek v hotovosti, rozdělte platbu. Vznikne jedna tržba s několika způsoby platby.",
    steps: [
      { name: "Zvolte první způsob", text: "V okně **Platba** klepněte na způsob, kterým zákazník platí první část – například **Dárkový**." },
      {
        name: "Zadejte část",
        text: "Klepněte na **Rozdělit platbu – zákazník platí víc způsoby**, napište částku do pole **Část placená způsobem …** a klepněte na **Přidat**.",
      },
      {
        name: "Doplaťte zbytek",
        text: "Pokladna ukáže **Zbývá doplatit**. Zvolte způsob pro zbytek, například **Hotovost**, a potvrďte **Zaplaceno – … Kč**.",
      },
    ],
    sections: [
      {
        id: "pravidla",
        heading: "Pravidla",
        blocks: [
          {
            ul: [
              "Jedna tržba může mít nejvýš 5 způsobů platby.",
              "Část musí být větší než 0 a menší než zbývající částka.",
              "Přidanou část odeberete křížkem × vedle její částky.",
              "Spropitné zadáte, jen když zbytek platí zákazník kartou.",
              "Vratka takové tržby vrací stejnými způsoby a ve stejném poměru – viz [Vratka a storno](/napoveda/vratka).",
            ],
          },
        ],
      },
    ],
    related: ["zpusoby-platby", "poukazy-kredit-zalohy", "vratka"],
    updated: "2026-10-17",
  },
  {
    slug: "poukazy-kredit-zalohy",
    topic: "prodej",
    title: "Stravenky, kredit, dárkové poukazy a zálohy",
    description:
      "Jak v pokladně EvidujZdarma účtovat stravenky, čerpání kreditu, dárkové poukazy a zálohy s doplatkem, a které z těchto plateb se v EET 2.0 evidují.",
    lead: "Pro poukazy má pokladna tři tlačítka: **Stravenka**, **Kredit** a **Dárkový**. Liší se tím, zda se platba eviduje. Dobití kreditu zadáte na obrazovce **Prodej**. Záloha zvláštní tlačítko nemá – je to běžná tržba.",
    sections: [
      {
        id: "ktere-tlacitko",
        heading: "Které tlačítko zvolit",
        blocks: [
          {
            table: {
              head: ["Tlačítko", "Kdy ho použít", "Eviduje se?"],
              rows: [
                ["**Stravenka**", "Stravenka nebo poukázka vydaná jinou firmou.", "Ano, jako běžná platba."],
                ["**Kredit**", "Úhrada z dříve nabitého kreditu, čipu nebo předplacené karty.", "Ano, jako čerpání."],
                ["**Dárkový**", "Dárkový poukaz na konkrétní zboží nebo službu, který jste dříve prodali.", "Ne – evidoval se už prodej poukazu."],
              ],
            },
          },
          { p: "Samotný prodej dárkového poukazu naúčtujte jako běžnou položku zaplacenou hotově nebo kartou." },
        ],
      },
      {
        id: "doplatky",
        heading: "Záloha a doplatek, poukaz a doplatek",
        blocks: [
          { p: "Zálohu i doplatek naúčtujte jako dvě samostatné tržby a zaplaťte je běžně, hotově nebo kartou. Doplatek po záloze nepatří pod **Kredit**." },
          {
            p: "Doplácí-li zákazník k dárkovému poukazu rozdíl, [rozdělte platbu](/napoveda/rozdelena-platba): hodnotu poukazu pod **Dárkový**, zbytek hotově nebo kartou. Tržba zaplacená celá dárkovým poukazem má stav **Neeviduje se** a na účtence je „(uhrazeno poukazem, neeviduje se)“.",
          },
        ],
      },
      {
        id: "co-plati",
        heading: "Co platí podle Finanční správy",
        blocks: [
          { p: FACTS.evidenced.prepayments },
        ],
      },
      {
        id: "dobiti-kreditu",
        heading: "Dobití kreditu",
        blocks: [
          {
            p: "Naťukejte částku, zaškrtněte **Dobití kreditu (čip, předplacená karta)** a klepněte na **+ Přidat dobití kreditu**. Zákazník ho zaplatí hotově nebo kartou – **Kredit** a **Dárkový** pokladna u dobití nenabídne. Do datové zprávy jde částka i jako určená k pozdějšímu čerpání.",
          },
          {
            note: "Na dokladu má dobití kreditu sazbu DPH 0 %. Jak dobití a čerpání kreditu zachytit v DPH, ověřte se svou účetní.",
            tone: "warn",
          },
        ],
      },
    ],
    related: ["rozdelena-platba", "zpusoby-platby", "stav-trzby"],
    guides: ["kontaktni-platba"],
    updated: "2026-10-17",
  },
];
