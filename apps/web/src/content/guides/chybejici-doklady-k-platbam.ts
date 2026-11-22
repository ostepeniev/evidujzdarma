import { SOURCES } from "../facts";
import type { Guide } from "./types";

/** S12 (22. 11. 2026): cluster „Doklady pro účetní bez chaosu“ – viz co-ucetni-potrebuje-kazdy-mesic.ts. Koncept do revize. */
export const chybejiciDokladyKPlatbam: Guide = {
  slug: "chybejici-doklady-k-platbam",
  category: "doklady",
  title: "Chybějící doklady k platbám: jak je dohledat rychle",
  h1: "Chybějící doklady k platbám: jak je dohledat a nezdržovat účetní",
  description:
    "Účetní se ptá na fakturu k platbě z výpisu? Kde chybějící doklad hledat, jak si o kopii říct dodavateli a jak nastavit postup, aby doklady příště nechyběly.",
  lead:
    "Když účetní pošle seznam plateb bez dokladu, nejrychleji je dohledáte podle **protistrany, částky a data** – v e-mailu, v zákaznickém účtu u dodavatele nebo v bankovnictví. Aby se seznam nehromadil, ukládejte doklad hned při platbě na jedno místo. Seznam chybějících dokladů není výtka, ale běžná součást práce účetní.",
  summary: [
    "Hledejte podle protistrany a částky: e-mail, zákaznický účet u dodavatele, přílohy v bankovnictví.",
    "Platby kartou online mají fakturu obvykle v účtu u obchodníka nebo v potvrzovacím e-mailu.",
    "Když doklad nemáte, požádejte dodavatele o kopii – je to běžný požadavek.",
    "Do budoucna: doklad uložit hned při platbě, jedna složka nebo adresa, pravidelná kontrola jednou týdně.",
  ],
  sections: [
    {
      id: "kde-hledat",
      heading: "Kde chybějící doklad hledat",
      blocks: [
        {
          table: {
            head: ["Typ platby", "Kde bývá doklad"],
            rows: [
              ["Platba kartou na internetu", "Potvrzovací e-mail objednávky, sekce Faktury v zákaznickém účtu"],
              ["Předplatné (software, telefon, energie)", "Klientská zóna dodavatele, měsíční e-mail s fakturou"],
              ["Platba kartou v obchodě", "Papírová účtenka; u některých obchodníků i v aplikaci nebo věrnostním účtu"],
              ["Převod na fakturu", "E-mail od dodavatele, datová schránka, papírová pošta"],
              ["Platba v cizí měně", "Účet u zahraničního dodavatele – faktura bývá v angličtině, s DIČ"],
            ],
          },
        },
        { p: "Pomáhá hledat v poště podle **částky** (například „1 240“ i „1240“), podle **názvu protistrany** z výpisu a podle **variabilního symbolu**, který bývá číslem faktury." },
      ],
    },
    {
      id: "kdyz-chybi",
      heading: "Když doklad opravdu nemáte",
      blocks: [
        {
          ol: [
            "Napište dodavateli a požádejte o kopii dokladu – stačí uvést datum, částku a číslo objednávky nebo variabilní symbol.",
            "Pokud dodavatel kopii poslat nemůže, řekněte to účetní včas. Ona ví, jak takovou platbu posoudit – dohadovat se o tom na konci roku je pro obě strany horší.",
            "Soukromou platbu z firemního účtu účetní také potřebuje znát – doklad k ní nebude, ale musí vědět, že nejde o výdaj podnikání.",
          ],
        },
        { note: "Výdaj bez dokladu se zpravidla nedá uplatnit jako daňový výdaj ani nárokovat odpočet DPH. Jak s konkrétní platbou naložit, rozhodne vaše účetní.", tone: "info" },
      ],
    },
    {
      id: "aby-nechybely",
      heading: "Jak nastavit postup, aby doklady nechyběly",
      blocks: [
        {
          ul: [
            "**Jedna adresa pro faktury** – dodavatelům dejte e-mail, který čte i účetní, nebo ho přeposílejte automaticky.",
            "**Fotka účtenky hned u pokladny** – papír se ztratí, fotka v telefonu ne.",
            "**Kontrola jednou týdně** – projděte nové platby na výpisu a odškrtněte, ke kterým doklad máte. Pět minut týdně ušetří hodinu na konci měsíce.",
            "**Pravidelné platby** – u předplatného si poznamenejte, kde se faktura stahuje, a stáhněte ji vždy ve stejný den.",
          ],
        },
        { p: "Postup krok za krokem popisuje návod [Párování plateb s doklady](/navody/parovani-plateb-s-doklady)." },
      ],
    },
  ],
  faq: [
    {
      q: "Účetní mi posílá seznam plateb bez dokladů. Je to normální?",
      a: "Ano. Účetní kontroluje, zda ke každé platbě na výpisu existuje doklad – seznam chybějících je běžný výstup její práce, ne výtka. Čím dřív doklady doplníte, tím méně práce to dá oběma.",
    },
    {
      q: "Stačí fotka účtenky?",
      a: "Pro účetní je fotka nebo sken obvykle v pořádku, pokud je čitelný. Zda si má originál schovat, se domluvte s účetní.",
    },
    {
      q: "Jak chybějící doklady hlídat automaticky?",
      a: "Připravujeme bezplatnou betu Doklady k platbám: nahrajete výpis, ke každé platbě přiřadíte doklad a nástroj vám připomene ty, které chybí. Zájem můžete dát na stránce Doklady pro účetní bez chaosu.",
    },
  ],
  sources: [SOURCES.zoUcetnictvi, SOURCES.zdph, SOURCES.zdp],
  related: ["musim-vydavat-uctenku", "storno-a-vraceni-eet", "eet-2-0-kompletni-pruvodce"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [{ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
