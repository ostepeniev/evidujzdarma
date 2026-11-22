import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

/** S12 (22. 11. 2026): cluster „Doklady pro účetní bez chaosu“ – viz co-ucetni-potrebuje-kazdy-mesic.ts. Revize Heleny Jeřábkové 22. 11. 2026 → indexovatelný. */
export const pokladniKnihaEetABanka: Guide = {
  slug: "pokladni-kniha-eet-a-banka",
  category: "doklady",
  title: "Pokladní kniha, EET a banka: jak to sedí dohromady",
  description:
    "Hotovost, karta a QR platba skončí na třech různých místech. Jak se tržby z EET 2.0 propíšou do pokladní knihy a na výpis z banky, aby nic nebylo dvakrát.",
  lead:
    "Od **1. 1. 2027** eviduje pokladna každou kontaktní platbu, ale peníze z ní skončí na různých místech: **hotovost v pokladní knize**, **karta na výpisu souhrnně od poskytovatele terminálu** a **QR platba na výpisu jednotlivě**. Účetní potřebuje vědět, co k čemu patří, aby se tržba nezapočítala dvakrát.",
  summary: [
    "Hotovost: tržby, vklady a výběry patří do pokladní knihy; stav kasy se má shodovat s uzávěrkou.",
    "Karta: poskytovatel terminálu obvykle připisuje platby souhrnně a často po odečtení poplatků.",
    "QR platba na místě je evidovaná tržba a zároveň příchozí platba na výpisu – je to jedna a táž tržba.",
    "Datová zpráva EET nese jen celkovou částku; přehled podle způsobů platby dává export z pokladny.",
  ],
  sections: [
    {
      id: "tri-cesty",
      heading: "Tři cesty jedné tržby",
      blocks: [
        {
          table: {
            head: ["Způsob platby", "Eviduje se v EET?", "Kde peníze skončí", "Na co si dát pozor"],
            rows: [
              ["Hotovost", "Ano", "V kase → pokladní kniha", "Vklady a výběry z kasy nejsou tržby"],
              ["Karta na terminálu", "Ano", "Na účtu, souhrnně od poskytovatele terminálu", "Připsaná částka bývá po odečtení poplatků a o den či víc později"],
              ["QR platba na místě", "Ano", "Na účtu, jako jednotlivá příchozí platba", "Na výpisu to není nový příjem – tržbu už máte v pokladně"],
              ["Faktura převodem", "Ne", "Na účtu", "Párujete s vydanou fakturou, ne s pokladnou"],
            ],
            caption: "Stav k 22. 11. 2026. Pravidla evidence podle eet.gov.cz (Kdo musí evidovat tržby) a semináře Finanční správy pro vývojáře.",
          },
        },
      ],
    },
    {
      id: "hotovost",
      heading: "Hotovost a pokladní kniha",
      blocks: [
        {
          p: "Pokladní kniha zachycuje, co do kasy přišlo a co z ní odešlo: tržby v hotovosti, vrácené peníze, vklad na začátku dne, výběr do banky nebo pro majitele. Denní uzávěrka v pokladně ukáže, kolik by v kase mělo být; rozdíl proti skutečnosti je potřeba vysvětlit hned, ne na konci měsíce.",
        },
        { p: "Pokladna EvidujZdarma vede vklady a výběry hotovosti u uzávěrky a pokladní knihu exportuje do CSV – tržby v hotovosti v ní jsou souhrnně za každou uzávěrku. Postup v nápovědě [Export a pokladní kniha](/napoveda/export-pro-ucetni)." },
      ],
    },
    {
      id: "karta-a-qr",
      heading: "Karta a QR platba na výpisu",
      blocks: [
        {
          p: "Platby kartou z jednoho dne obvykle přijdou na účet jednou souhrnnou částkou od poskytovatele terminálu. Účetní je spáruje s tržbami kartou podle denní uzávěrky a poplatky zaúčtuje zvlášť – potřebuje k tomu přehled od poskytovatele terminálu (výpis transakcí nebo fakturu za poplatky).",
        },
        {
          p: "QR platba zaplacená u vás na místě je kontaktní platba, takže ji pokladna eviduje. Na výpis z účtu pak přijde jako běžná příchozí platba. Účetní ji má spárovat s tržbou z pokladny, ne zaúčtovat jako další příjem – pomůže, když QR platba nese variabilní symbol dokladu z pokladny.",
        },
        { p: `${FACTS.evidenced.notEvidenced} Platba převodem na fakturu proto v pokladně být nemá.` },
      ],
    },
    {
      id: "co-predat",
      heading: "Co předat účetní, aby to sedělo",
      blocks: [
        {
          ul: [
            "Export tržeb za měsíc (s rozdělením na hotovost, kartu a QR) a denní uzávěrky.",
            "Pokladní knihu se vklady a výběry.",
            "Výpis z účtu a přehled transakcí od poskytovatele terminálu.",
            "Vratky: vrácení peněz zákazníkovi je v pokladně záporná tržba k původnímu dokladu – viz [Storno a vrácení](/navody/storno-a-vraceni-eet).",
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Zákazník zaplatil QR kódem na místě. Je to tržba v EET, nebo platba na účet?",
      a: "Obojí – ale jde o jednu tržbu. Pokladna ji eviduje jako kontaktní platbu a na výpis přijde jako příchozí platba. Účetní je spáruje, nesčítá.",
    },
    {
      q: "Proč na účet přišlo za karty méně, než ukazuje pokladna?",
      a: "Poskytovatel terminálu obvykle připisuje platby souhrnně a po odečtení poplatků, někdy s posunem o den či víc. Rozdíl vysvětlí přehled transakcí od poskytovatele.",
    },
    {
      q: "Je výběr z kasy do banky tržba?",
      a: "Ne. Vklad i výběr hotovosti jen přesouvají peníze mezi kasou a účtem. V pokladní knize je zapište zvlášť, aby se nesčítaly s tržbami.",
    },
  ],
  sources: [SOURCES.kdoMusi, SOURCES.seminarVyvojari, SOURCES.zoUcetnictvi],
  related: ["kontaktni-platba", "storno-a-vraceni-eet", "eet-bez-internetu"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [
    // Revize Heleny Jeřábkové 22. 11. 2026
    { date: "2026-11-22", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-11-22", text: "Nový návod – koncept před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
