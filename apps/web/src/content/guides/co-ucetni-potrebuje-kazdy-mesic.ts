import { SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

/**
 * S12 (22. 11. 2026): cluster „Doklady pro účetní bez chaosu“ (pilíř /ucetnictvi-bez-chaosu). Tón: účetní dělají svou
 * práci dobře, zdržení a opravy vznikají z chybějících a pozdních dokladů a z ruční práce. Právní odkazy jen obecně
 * (§ 11 zákona o účetnictví, § 29 zákona o DPH, § 7b zákona o daních z příjmů). Revize Heleny Jeřábkové 22. 11. 2026 → indexovatelný (Ф8, Ф12).
 */
export const coUcetniPotrebujeKazdyMesic: Guide = {
  slug: "co-ucetni-potrebuje-kazdy-mesic",
  category: "doklady",
  title: "Co účetní potřebuje od OSVČ a malé firmy každý měsíc",
  description:
    "Výpis z banky, faktury, účtenky, pokladní kniha a tržby z EET: co předat účetní každý měsíc, do kdy a v jaké podobě, aby nemusela nic dohledávat.",
  lead:
    "Účetní potřebuje každý měsíc tři věci: **výpis z účtu**, **doklady ke všem platbám** na něm a **přehled hotovosti a tržeb** z pokladny. Když přijdou včas a úplné, zpracuje je rychle. Zdržení a opravy obvykle nevznikají u účetní, ale tam, kde doklad chybí nebo přijde pozdě.",
  summary: [
    "Základ je výpis z bankovního účtu – každá platba na něm potřebuje svůj doklad.",
    "Vydané a přijaté faktury, účtenky, smlouvy a podklady ke mzdám předávejte průběžně, ne až na konci roku.",
    "Hotovost: pokladní kniha nebo přehled příjmů a výdajů v hotovosti, včetně vkladů a výběrů.",
    "Tržby z pokladny (EET 2.0) předáte jako export – samotná datová zpráva pro Finanční správu doklad pro účetnictví nenahradí.",
  ],
  sections: [
    {
      id: "mesicni-balicek",
      heading: "Měsíční balíček pro účetní",
      blocks: [
        { p: "Konkrétní seznam si domluvte se svou účetní – každá kancelář má zavedený postup. Ve většině případů jde o tyto podklady:" },
        {
          table: {
            head: ["Podklad", "Proč ho účetní potřebuje", "Typická podoba"],
            rows: [
              ["Výpis z bankovního účtu", "Přehled všech plateb, ke kterým hledá doklady", "PDF nebo export z bankovnictví (CSV, ABO/GPC)"],
              ["Vydané faktury", "Příjmy a pohledávky; u plátce DPH podklad k přiznání", "PDF nebo export z fakturačního programu"],
              ["Přijaté faktury a účtenky", "Výdaje a nárok na odpočet DPH", "PDF z e-mailu, fotka nebo sken účtenky"],
              ["Pokladní kniha / hotovost", "Příjmy a výdaje v hotovosti, vklady a výběry", "Export z pokladny nebo tabulka"],
              ["Tržby z pokladny", "Kolik jste přijali hotově, kartou a QR kódem", "Export tržeb a denní uzávěrky"],
              ["Smlouvy, mzdy, ostatní", "Nájem, leasing, pojištění, podklady ke mzdám", "PDF, docházka"],
            ],
            caption: "Stav k 22. 11. 2026. Orientační přehled – rozsah podkladů se liší podle toho, zda vedete účetnictví, nebo daňovou evidenci, a zda jste plátce DPH.",
          },
        },
      ],
    },
    {
      id: "ucetnictvi-nebo-evidence",
      heading: "Účetnictví, nebo daňová evidence",
      blocks: [
        {
          p: "Firma (například s. r. o.) vede **účetnictví** podle zákona o účetnictví a každý účetní případ dokládá účetním dokladem (§ 11). OSVČ většinou vede **daňovou evidenci** podle § 7b zákona o daních z příjmů – i ta stojí na dokladech o příjmech a výdajích. Plátce DPH navíc potřebuje daňové doklady s náležitostmi podle § 29 zákona o DPH.",
        },
        { p: "Pro vás z toho plyne jednoduché pravidlo: ke každé platbě patří doklad. Jaké náležitosti musí mít, pohlídá účetní; vaší částí je, aby k ní doklad vůbec došel." },
      ],
    },
    {
      id: "kdy",
      heading: "Kdy podklady předat",
      blocks: [
        {
          ul: [
            "**Průběžně** – fakturu nebo účtenku předejte hned, jak ji dostanete. Za měsíc si už nikdo nepamatuje, za co byla platba 1 240 Kč.",
            "**Do termínu, který si s účetní domluvíte** – plátci DPH mají lhůty pro přiznání a kontrolní hlášení, a účetní potřebuje čas doklady zpracovat.",
            "**Najednou a na jedno místo** – sdílená složka nebo jedna e-mailová adresa jsou lepší než doklady rozeseté v pěti schránkách.",
          ],
        },
      ],
    },
    {
      id: "eet",
      heading: "Tržby z EET 2.0 a účetnictví",
      blocks: [
        {
          p: "Od 1. 1. 2027 posílá pokladna o každé kontaktní platbě datovou zprávu Finanční správě. Zpráva obsahuje celkovou částku, datum, evidenční jednotku a pořadové číslo – ne položky, způsob platby ani sazby DPH. Pro účetní je proto užitečnější export z pokladny: tržby podle dní, způsobu platby a sazeb DPH a pokladní kniha.",
        },
        { p: "V pokladně EvidujZdarma najdete export tržeb a pokladní knihu v CSV, účetní může mít vlastní přístup přes Účetní kabinet – viz [Export pro účetní](/napoveda/export-pro-ucetni)." },
      ],
    },
  ],
  faq: [
    {
      q: "Stačí účetní poslat jen výpis z banky?",
      a: "Ne. Výpis ukazuje, že peníze odešly nebo přišly, ale ne za co. Ke každé platbě účetní potřebuje doklad – fakturu, účtenku, smlouvu nebo jiný podklad.",
    },
    {
      q: "Nahradí datová zpráva EET doklad pro účetnictví?",
      a: "Ne. Datová zpráva pro Finanční správu obsahuje jen celkovou částku, datum, evidenční jednotku a pořadové číslo. Účetní potřebuje přehled tržeb z pokladny a doklady k výdajům.",
    },
    {
      q: "Jsem neplátce DPH. Potřebuji doklady taky?",
      a: "Ano. I daňová evidence OSVČ stojí na dokladech o příjmech a výdajích. Neplátce jen nepotřebuje daňové doklady s náležitostmi podle zákona o DPH.",
    },
  ],
  sources: [SOURCES.zoUcetnictvi, SOURCES.zdph, SOURCES.zdp, SOURCES.kdoMusi],
  related: ["musim-vydavat-uctenku", "storno-a-vraceni-eet", "eet-2-0-kompletni-pruvodce"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [
    // Revize Heleny Jeřábkové 22. 11. 2026
    { date: "2026-11-22", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-11-22", text: "Nový návod – koncept před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
