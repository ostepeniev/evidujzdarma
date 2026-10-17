import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

/**
 * S1 (15. 10. 2026): cluster návod ke slevě na evidenci tržeb (§ 35be ZDP ve znění zákona č. 180/2026 Sb.).
 * 17. 10. 2026 prošel odbornou revizí (Helena Jeřábková) – index, sitemap, llms.txt, MCP. Paušální režim = „podle našeho čtení“ + ověřit s účetní.
 */
export const slevaNaDaniZaEet: Guide = {
  slug: "sleva-na-dani-za-eet",
  category: "zaklady",
  title: "Sleva na dani za EET 2.0: až 5 000 Kč pro OSVČ",
  h1: "Sleva na dani za evidenci tržeb",
  description:
    "Kdo začne od 1. 1. 2027 evidovat tržby, může si v přiznání odečíst slevu až 5 000 Kč. Komu náleží, jak se počítá podle § 35be a proč může být nižší nebo nulová.",
  lead:
    "Fyzická osoba, která od **1. 1. 2027** začne evidovat tržby, si může v daňovém přiznání uplatnit **slevu na evidenci tržeb až 5 000 Kč**. Platí jen jednou, za první rok, kdy zaevidovala povinnou tržbu. Při nízkém zisku je sleva nižší, nebo nulová.",
  summary: [
    "Sleva na evidenci tržeb je v § 35be zákona o daních z příjmů, doplněném zákonem č. 180/2026 Sb.",
    "Náleží fyzickým osobám, jen za první zdaňovací období s povinně evidovanou tržbou.",
    "5 000 Kč je strop: při nízkém dílčím základu daně ze samostatné činnosti je sleva nižší, nebo nulová.",
    "Tržby evidované podle staré EET (zákon č. 112/2016 Sb.) se nepočítají – slevu tak může získat i ten, kdo evidoval dřív.",
    "Uplatňuje se v daňovém přiznání za rok, ve kterém jste začali evidovat.",
  ],
  sections: [
    {
      id: "komu",
      heading: "Komu sleva náleží",
      blocks: [
        { p: FACTS.taxCredit.summary },
        {
          p: "Podle § 35be odst. 2 lze slevu uplatnit **pouze v prvním zdaňovacím období**, ve kterém poplatník zaevidoval tržbu, kterou má podle zákona o evidenci tržeb povinnost evidovat. Kdo začne evidovat v lednu 2027, uplatní ji v přiznání za rok 2027.",
        },
        {
          note: "Tržby, které jste kdysi evidovali podle staré EET (zákon č. 112/2016 Sb.), se pro slevu nepočítají (přechodné ustanovení zákona č. 180/2026 Sb.). Nárok tedy máte, i když jste za první EET evidovali.",
          tone: "info",
        },
      ],
    },
    {
      id: "vypocet",
      heading: "Jak se sleva počítá",
      blocks: [
        { p: "Zákon (§ 35be odst. 1) určuje výši slevy ve třech krocích:" },
        {
          ol: [
            "Spočítejte 15 % z dílčího základu daně ze samostatné činnosti.",
            "Odečtěte základní slevu na poplatníka.",
            "Vyjde-li 5 000 Kč a víc, sleva je 5 000 Kč. Vyjde-li méně, sleva je rovna tomuto rozdílu. Vyjde-li nula nebo méně, sleva je 0 Kč.",
          ],
        },
        {
          table: {
            head: ["Dílčí základ daně ze samostatné činnosti", "15 % ze základu", "Sleva na evidenci tržeb"],
            rows: [
              ["400 000 Kč", "60 000 Kč", "**5 000 Kč**"],
              ["230 000 Kč", "34 500 Kč", "**3 660 Kč**"],
              ["180 000 Kč", "27 000 Kč", "**0 Kč**"],
            ],
            caption: "Příklad počítá se základní slevou na poplatníka 30 840 Kč (výše pro rok 2026). Pro rok 2027 použijte částku platnou v daném roce.",
          },
        },
        {
          p: "Sleva tedy pomáhá hlavně tomu, komu po základní slevě ještě zbývá daň k zaplacení. Kdo má daň po základní slevě nulovou, slevu na evidenci tržeb nevyužije.",
        },
      ],
    },
    {
      id: "pausal",
      heading: "Paušalisté a EET OFF",
      blocks: [
        {
          p: "Sleva se uplatňuje v daňovém přiznání. Kdo je v paušálním režimu a přiznání k dani z příjmů nepodává, ji podle našeho čtení zákona neuplatní. Jak to platí ve vašem případě, ověřte s účetní.",
        },
        {
          p: `Kdo zvolí režim EET OFF, tržby neeviduje – nárok na slevu za evidenci tedy nevznikne. ${FACTS.eetOff.summary}`,
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "jak-uplatnit",
      heading: "Jak slevu uplatnit",
      blocks: [
        {
          ul: [
            "Slevu uvedete v daňovém přiznání k dani z příjmů fyzických osob za rok, ve kterém jste poprvé zaevidovali povinnou tržbu.",
            "Uplatňuje se jen jednou. V dalších letech už nárok nevzniká.",
          ],
        },
        { cta: "kontrola-ico" },
      ],
    },
  ],
  faq: [
    {
      q: "Kolik je sleva na dani za EET 2.0?",
      a: "Nejvýše 5 000 Kč. Při nízkém dílčím základu daně ze samostatné činnosti je nižší, nebo nulová (§ 35be zákona o daních z příjmů).",
    },
    {
      q: "Kdy slevu uplatním?",
      a: "V daňovém přiznání za první rok, ve kterém jste zaevidovali tržbu, kterou jste evidovat museli. Kdo začne v lednu 2027, uplatní ji v přiznání za rok 2027.",
    },
    {
      q: "Evidoval jsem tržby za první EET. Mám nárok?",
      a: "Ano. Tržby evidované podle zákona č. 112/2016 Sb. se pro slevu nepočítají.",
    },
    {
      q: "Platí sleva i pro s.r.o.?",
      a: "Ne. Sleva je v části zákona o slevách na dani fyzických osob a počítá se z dílčího základu daně ze samostatné činnosti.",
    },
    {
      q: "Dostanu slevu, když zvolím EET OFF?",
      a: "Ne. V režimu EET OFF tržby neevidujete, takže nárok na slevu za evidenci nevznikne.",
    },
  ],
  howTo: {
    name: "Jak uplatnit slevu na evidenci tržeb",
    description: "Od první evidované tržby po daňové přiznání.",
    steps: [
      { name: "Začněte evidovat", text: "Od 1. 1. 2027 evidujte tržby, které evidovat musíte." },
      { name: "Spočítejte nárok", text: "Z dílčího základu daně ze samostatné činnosti spočítejte 15 %, odečtěte základní slevu na poplatníka a výsledek porovnejte s 5 000 Kč." },
      { name: "Uveďte slevu v přiznání", text: "Slevu uplatněte v daňovém přiznání za rok, ve kterém jste poprvé evidovali. Postup si ověřte s účetní." },
    ],
  },
  sources: [SOURCES.zakonUplne, SOURCES.sbirka, SOURCES.zdp, SOURCES.podnikatelDetail, SOURCES.eetOff],
  related: ["eet-2-0-kompletni-pruvodce", "eet-off", "eet-a-pausalni-dan", "koho-se-eet-tyka"],
  published: "2026-10-15",
  updated: "2026-10-17",
  changelog: [
    { date: "2026-10-17", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-15", text: "Koncept návodu – před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
