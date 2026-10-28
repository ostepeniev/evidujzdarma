import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

/**
 * S1 (15. 10. 2026): cluster návod ke stornu a vrácení (§ 8 zákona č. 180/2026 Sb.).
 * 17. 10. 2026 prošel odbornou revizí (Helena Jeřábková) – index, sitemap, llms.txt, MCP. Vrácení převodem k hotovostní tržbě = „zatím není jisté“.
 */
export const stornoAVraceniEet: Guide = {
  slug: "storno-a-vraceni-eet",
  category: "prakticke",
  title: "Storno a vrácení peněz v EET 2.0: jak na to",
  h1: "Storno, vrácení zboží a oprava tržby v EET 2.0",
  description:
    "Vrácení zboží, reklamace nebo překlep v částce: od 1. 1. 2027 se vracená tržba eviduje jako záporná (§ 8). Kdy stornovat, co s nezaplaceným účtem a s převodem.",
  lead:
    "Když od **1. 1. 2027** vracíte zákazníkovi peníze za evidovanou tržbu nebo opravujete chybnou částku, evidujete to stejně jako tržbu, jen se **zápornou částkou** (§ 8 zákona o evidenci tržeb). Prodej, který zákazník ještě nezaplatil, se neeviduje, takže ho není co stornovat.",
  summary: [
    "Vrácení evidované tržby nebo její části se eviduje jako záporná tržba (§ 8).",
    "Oprava chybné částky: storno a nová tržba se správnou částkou, nebo jedna rozdílová tržba – vždy s aktuálním datem a časem.",
    "Nezaplacený a zrušený účet se neeviduje – tržba vzniká až platbou.",
    "Storno se eviduje stejně jako tržba: při vrácení, bez signálu nejpozději do 48 hodin.",
    "Vrácení převodem k tržbě přijaté hotově Finanční správa zatím podrobně nepopsala.",
  ],
  sections: [
    {
      id: "co-rika-zakon",
      heading: "Co říká zákon",
      blocks: [
        {
          p: "Paragraf 8 zákona č. 180/2026 Sb. je krátký: vrací-li se evidovaná tržba nebo její část nebo provádí-li se její oprava, postupuje se obdobně jako při evidenci tržby, jen se tržba eviduje jako **záporná**. Pro storno tedy platí stejná pravidla jako pro prodej – stejná pokladna, stejný certifikát, stejná lhůta.",
        },
        {
          p: "Ministerstvo financí a Finanční správa v prezentaci k EET 2.0 upřesňují, že storno ani oprava se na původní tržbu neváží. Storno je zpráva se zápornou částkou. Chybnou tržbu opravíte buď stornem a novou zprávou se správnou částkou, nebo jednou „rozdílovou“ zprávou. Obojí se posílá s **aktuálním datem a časem**, ne s datem a časem původní tržby, a vždy s novým identifikátorem zprávy (UUID).",
        },
        { p: FACTS.offline.summary },
      ],
    },
    {
      id: "situace",
      heading: "Běžné situace",
      blocks: [
        {
          table: {
            head: ["Situace", "Co evidovat"],
            rows: [
              ["Zákazník vrátí zboží a dostane peníze zpět hotově", "Zápornou tržbu ve výši vrácené částky"],
              ["Reklamace s vrácením části ceny", "Zápornou tržbu ve výši vrácené části"],
              ["Vrácení peněz na kartu přes terminál v provozovně", "Zápornou tržbu ve výši vrácené částky"],
              ["Pokladní namarkovala 1 500 Kč místo 150 Kč a zákazník zaplatil správně", "Storno chybné tržby a novou tržbu 150 Kč, nebo jednu rozdílovou tržbu −1 350 Kč"],
              ["Účet se zrušil dřív, než zákazník zaplatil", "Nic – tržba vzniká až platbou"],
              ["Výměna zboží za jiné za stejnou cenu", "Nic, pokud se neplatí ani nevrací peníze"],
            ],
            caption: "Rozhoduje, zda a kolik peněz se skutečně vrací nebo přijímá.",
          },
        },
        {
          note: "Vracíte-li peníze převodem na účet k tržbě, kterou zákazník kdysi zaplatil hotově, Finanční správa zatím podrobně nepopsala, jak takové vrácení evidovat. Doporučujeme to probrat s účetní; návod doplníme, až výklad vyjde.",
          tone: "warn",
        },
      ],
    },
    {
      id: "zalohy-poukazy",
      heading: "Zálohy, kredit a dárkové poukazy",
      blocks: [
        { p: FACTS.evidenced.prepayments },
        {
          p: "Vrací-li se záloha nebo nevyčerpaný kredit, který se při zaplacení evidoval, jde o vrácení evidované tržby – postupuje se podle § 8. Jak zacházet s kaucemi u ubytování, popisuje návod [EET 2.0 u ubytování](/navody/eet-ubytovani).",
        },
      ],
    },
    {
      id: "doklad",
      heading: "Doklad o vrácení",
      blocks: [
        { p: FACTS.receipt.summary },
        { p: FACTS.confirmation.summary },
      ],
    },
  ],
  faq: [
    {
      q: "Jak v EET 2.0 evidovat vrácení zboží?",
      a: "Jako zápornou tržbu ve výši vrácené částky (§ 8 zákona o evidenci tržeb). Eviduje se stejně jako běžná tržba.",
    },
    {
      q: "Pokladní se překlepla v částce. Co teď?",
      a: "Chybnou tržbu stornujte (záporná tržba ve stejné výši) a zaevidujte novou se správnou částkou. Podle Finanční správy můžete poslat i jednu „rozdílovou“ zprávu na rozdíl mezi chybnou a správnou částkou. V obou případech s aktuálním datem a časem, ne s datem původní tržby.",
    },
    {
      q: "Musím evidovat zrušený účet, který zákazník nezaplatil?",
      a: "Ne. Evidovanou tržbou je platba; dokud zákazník nezaplatí, není co evidovat ani stornovat.",
    },
    {
      q: "Co když při vrácení nejde signál?",
      a: FACTS.offline.summary,
    },
    {
      q: "Jak evidovat vrácení převodem na účet?",
      a: "Pokud vracíte převodem tržbu přijatou hotově nebo kartou na místě, Finanční správa zatím podrobně nepopsala, jak postupovat. Doporučujeme poradit se s účetní.",
    },
  ],
  howTo: {
    name: "Jak stornovat tržbu v EET 2.0",
    description: "Vrácení zboží nebo oprava chybné částky krok za krokem.",
    steps: [
      { name: "Najděte původní tržbu", text: "V pokladně dohledejte tržbu, ke které se vrácení nebo oprava vztahuje." },
      { name: "Zaevidujte zápornou tržbu", text: "Vraťte peníze a zaevidujte zápornou tržbu ve výši vrácené částky." },
      { name: "U opravy zaevidujte správnou částku", text: "Byla-li chyba v částce, zaevidujte po stornu novou tržbu se správnou částkou." },
      { name: "Zkontrolujte odeslání", text: "Ověřte, že storno odešlo; bez signálu nejpozději do 48 hodin." },
    ],
  },
  sources: [SOURCES.zakonUplne, SOURCES.sbirka, SOURCES.seminarVyvojari, SOURCES.prakticke, SOURCES.zos],
  related: ["kontaktni-platba", "musim-vydavat-uctenku", "eet-bez-internetu", "eet-ubytovani"],
  published: "2026-10-15",
  updated: "2026-10-28",
  changelog: [
    {
      date: "2026-10-28",
      text: "Doplněno podle prezentace Ministerstva financí a Finanční správy: storno se neváže na původní tržbu, posílá se s aktuálním datem a opravu lze poslat i jednou rozdílovou zprávou.",
    },
    { date: "2026-10-17", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-15", text: "Koncept návodu – před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
