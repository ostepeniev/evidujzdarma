import { SOURCES } from "../facts";
import type { Guide } from "./types";
import { SERVICE_COPY } from "@/lib/site";

/**
 * S7-VIZ (28. 10. 2026): spropitné podle prezentace MF a FS (slajdy „Spropitné“ a „Osvobození spropitného v ZDP“)
 * a zákona č. 180/2026 Sb. Jen oficiální výklad, daňové zacházení odkazuje na účetní → basis "official" (Ф15).
 */
export const spropitneAEet: Guide = {
  slug: "spropitne-a-eet",
  category: "povinnosti",
  title: "Spropitné a EET 2.0: kdy je to tržba a kdy je bez daně",
  h1: "Spropitné a EET 2.0: kdy se eviduje a kdy je bez daně",
  description:
    "Dýško na kartě, v hotovosti, pro číšníka i pro podnik: kdy je spropitné od 1. 1. 2027 evidovanou tržbou a kdy je u zaměstnanců osvobozené až do 7 %.",
  lead:
    "Od **1. 1. 2027** u spropitného rozhoduje, čí je to příjem. Dýško pro podnik nebo pro číšníka na živnostenský list je evidovaná tržba, dýško zaměstnance evidovat nemusíte. Spropitné zaměstnanců je navíc nově osvobozené od daně, a to až do 7 % měsíčních tržeb restaurace.",
  summary: [
    "Spropitné pro podnik nebo pro OSVČ je evidovaná tržba; eviduje ho ten, komu patří.",
    "Spropitné zaměstnance evidenci nepodléhá, evidovat ho ale lze dobrovolně.",
    "Osvobození od daně platí jen pro zaměstnance a jen tam, kde se jí na místě.",
    "Strop 7 % měsíčních tržeb platí pro celou restauraci, ne pro každého číšníka.",
  ],
  sections: [
    {
      id: "eviduje-se",
      heading: "Eviduje se dýško?",
      blocks: [
        {
          p: "Ministerstvo financí a Finanční správa v prezentaci k EET 2.0 vysvětlují, že pro evidenci je klíčové, zda je spropitné **příjmem z podnikání**. Nezáleží na tom, jestli ho host nechá v hotovosti, nebo připíše ke kartě.",
        },
        {
          table: {
            head: ["Komu dýško patří", "Eviduje se?"],
            rows: [
              ["Restauraci, kavárně nebo salonu (podniku)", "**Ano** – je to evidovaná tržba podniku"],
              ["Číšníkovi nebo kadeřnici, kteří pracují na živnostenský list (OSVČ)", "**Ano** – eviduje ho ten, komu je příjmem z podnikání"],
              ["Zaměstnanci (číšník, kuchař, servírka)", "**Ne** – evidenci nepodléhá; dobrovolně evidovat lze"],
            ],
            caption: "Podle prezentace Ministerstva financí a Finanční správy k EET 2.0 (Specifické případy – Spropitné).",
          },
        },
        {
          p: "Když host připíše dýško k platbě kartou a pokladna ho eviduje spolu s platbou, je to v pořádku v obou případech: u podniku a OSVČ je to povinné, u zaměstnanců dobrovolné. Dobrovolná evidence může posloužit i jako podklad pro osvobození na straně zaměstnance.",
        },
      ],
    },
    {
      id: "bez-dane",
      heading: "Spropitné zaměstnanců bez daně: až 7 %",
      blocks: [
        {
          p: "Zákon č. 180/2026 Sb. od 1. 1. 2027 zároveň mění daň z příjmů: spropitné zaměstnanců ze stravovacích služeb je osvobozené až do **7 % měsíčních tržeb** podniku. Ministerstvo financí to ukazuje na příkladu:",
        },
        {
          stats: [
            { value: "7 %", label: "měsíčních tržeb restaurace", note: "strop pro všechny zaměstnance dohromady" },
            { value: "70 000 Kč", label: "osvobozené spropitné při tržbách 1 000 000 Kč", note: "co je nad strop, se zdaní běžně" },
            { value: "0 Kč", label: "osvobození pro majitele a OSVČ", note: "osvobození platí jen pro zaměstnance" },
          ],
        },
        {
          ul: [
            "**Jen tam, kde se jí na místě.** Neplatí pro stánky, food trucky ani prodej přes okénko (take away).",
            "**Jen dobrovolné spropitné.** Neplatí pro povinné poplatky typu couvert ani pro servisní přirážku.",
            "**Hotovost i karta.** Osvobozené je i dýško připsané ke kartě, i když projde přes účet provozovny.",
            "**Přehled o spropitném.** Restaurace jako plátce musí mít přehled o tom, kolik spropitného zaměstnanci dostali.",
          ],
        },
        {
          note: "Jak spropitné účtovat, rozdělovat mezi zaměstnance a uvádět ve mzdách, proberte se svou účetní.",
          tone: "info",
        },
      ],
    },
    {
      id: "v-pokladne",
      heading: "Spropitné v pokladně",
      blocks: [
        {
          p: `${SERVICE_COPY.tipsNote} Podrobnosti v [nápovědě ke způsobům platby](/napoveda/zpusoby-platby).`,
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    { q: "Musím evidovat dýško, které host dá číšníkovi do ruky?", a: "Je-li číšník zaměstnanec, evidenci nepodléhá. Je-li číšník OSVČ, je to jeho evidovaná tržba." },
    { q: "Host připsal spropitné k platbě kartou. Je to tržba restaurace?", a: "Pro evidenci rozhoduje, čí je to příjem. Patří-li zaměstnancům, evidovat ho nemusíte, ale pokladna ho smí evidovat spolu s platbou." },
    { q: "Platí osvobození spropitného i pro food truck?", a: "Ne. Podle Ministerstva financí platí jen tam, kde se jí na místě – ne pro stánky, food trucky ani prodej přes okénko." },
    { q: "Je servisní poplatek spropitné?", a: "Ne. Osvobození se týká jen dobrovolného dýška od hosta, ne povinných poplatků typu couvert nebo servisní přirážky." },
    { q: "Platí limit 7 % pro každého číšníka zvlášť?", a: "Ne. Je to strop pro celou restauraci a všechny zaměstnance dohromady." },
  ],
  howTo: {
    name: "Jak naložit se spropitným od 1. 1. 2027",
    description: "Tři kroky podle prezentace Ministerstva financí a Finanční správy.",
    steps: [
      { name: "Určete, čí spropitné je", text: "Podniku a OSVČ – evidovaná tržba; zaměstnancům – evidence dobrovolná." },
      { name: "Nastavte pokladnu", text: "Spropitné zadávejte u platby zvlášť, aby bylo v přehledech oddělené od tržby za jídlo." },
      { name: "Proberte daně s účetní", text: "Osvobození do 7 % platí jen pro zaměstnance a jen u jídla na místě; zbytek se zdaní běžně." },
    ],
  },
  sources: [SOURCES.seminarVyvojari, SOURCES.zakonUplne, SOURCES.sbirka, SOURCES.zdp],
  related: ["eet-gastronomie", "eet-kadernictvi-kosmetika", "kontaktni-platba", "eet-2-0-v-prikladech"],
  published: "2026-10-28",
  updated: "2026-10-28",
  changelog: [{ date: "2026-10-28", text: "Nový návod podle prezentace Ministerstva financí a Finanční správy." }],
  reviewedBy: null,
  basis: "official",
};
