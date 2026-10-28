import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

/**
 * S7-VIZ (28. 10. 2026): příklady z prezentace MF a FS (seminář pro vývojáře, „Specifické případy“) převyprávěné
 * do situací z provozu. Jen oficiální příklady a znění zákona, bez vlastního výkladu → basis "official" (Ф15).
 */
export const eet20VPrikladech: Guide = {
  slug: "eet-2-0-v-prikladech",
  category: "povinnosti",
  title: "EET 2.0 v příkladech: 15 situací podle Finanční správy",
  h1: "EET 2.0 v příkladech: 15 situací z provozu",
  description:
    "Zaokrouhlení, sleva, záloha, kauce, dýško, stravenka s kartou i storno: 15 situací, jak je od 1. 1. 2027 evidovat podle příkladů Finanční správy.",
  lead:
    "Od **1. 1. 2027** se eviduje každá kontaktní platba, jenže v provozu přijdou situace, kde odpověď hned jasná není: zaokrouhlení, sleva, kauce nebo dýško. Ministerstvo financí a Finanční správa je vysvětlily na konkrétních příkladech. Sepsali jsme je do 15 situací s odpovědí, co přesně odeslat.",
  summary: [
    "Eviduje se vždy skutečně přijatá částka – po zaokrouhlení i po slevě.",
    "Jedna platba dvěma způsoby, třeba stravenkou a kartou, je jedna tržba s celkovou částkou.",
    "Kauce se eviduje až při použití; uplatnění dárkového poukazu se neeviduje vůbec.",
    "Storno i oprava se posílají s aktuálním datem a na původní tržbu se neváží.",
  ],
  sections: [
    {
      id: "tri-podminky",
      heading: "Kdy se platba eviduje: tři podmínky",
      blocks: [
        { p: "Evidovat musíte platbu, u které platí **tři věci najednou**. Když jedna chybí, platba se neeviduje." },
        {
          conditions: [
            { title: "Příjem z podnikání", text: "Platba je vaší tržbou z podnikání – ne příjmem ze zaměstnání, z nájmu ani ojedinělou tržbou." },
            { title: "Kontaktní platba", text: "Zaplaceno při osobním kontaktu, v provozovně nebo hotově – kartou, hotově, QR kódem i stravenkou." },
            { title: "Žádná výjimka", text: "Vaše činnost není mezi zákonnými výjimkami (§ 11–13), jako jsou prodejní automaty nebo veřejné toalety." },
          ],
        },
        { p: "Výjimky podrobně rozebírá návod [Kdo musí mít EET 2.0](/navody/koho-se-eet-tyka), hranici kontaktní platby návod [Kontaktní platba](/navody/kontaktni-platba)." },
      ],
    },
    {
      id: "kolik-evidovat",
      heading: "Kolik evidovat: zaokrouhlení, sleva, záloha",
      blocks: [
        {
          table: {
            head: ["Situace", "Co odeslat"],
            rows: [
              ["1. Účet 78,90 Kč, zákazník platí hotově a zaokrouhlíte na 79 Kč", "Tržbu **79 Kč**"],
              ["2. Tentýž účet zaplatí kartou", "Tržbu **78,90 Kč**"],
              ["3. Zákazník dá 80 Kč a korunu zpět nechce", "Tržbu **80 Kč**"],
              ["4. Zboží za 1 000 Kč se slevou 20 %", "Tržbu **800 Kč** – jen částku po slevě, DPH se neřeší"],
              ["5. Záloha 2 000 Kč na místě, za týden doplatek 3 000 Kč na místě", "**Dvě tržby**, 2 000 Kč a 3 000 Kč – nejsou nijak provázané"],
            ],
            caption: "Podle příkladů Ministerstva financí a Finanční správy: eviduje se vždy skutečně přijatá částka.",
          },
        },
      ],
    },
    {
      id: "vic-zpusobu",
      heading: "Jedna platba, více způsobů nebo více podnikatelů",
      blocks: [
        {
          table: {
            head: ["Situace", "Co odeslat"],
            rows: [
              ["6. Účet 1 000 Kč: host zaplatí 200 Kč stravenkou a 800 Kč kartou", "**Jednu tržbu 1 000 Kč** – jde o jednu platbu dvěma způsoby"],
              ["7. Faktura 1 000 Kč: 200 Kč kartou na místě, 800 Kč druhý den převodem", "Tržbu **200 Kč** – převod není kontaktní platba"],
              ["8. Čerpací stanice: zákazník platí benzín (prodávaný za jiného) a kávu", "**Dvě datové zprávy** – kávu jako svou tržbu, benzín v pověření"],
            ],
            caption: "U faktury rozhoduje skutečný způsob úhrady, ne forma uvedená na faktuře.",
          },
        },
        { p: "Kdy a jak se eviduje za jiného podnikatele – pověření, přímé a nepřímé zastoupení – vysvětluje návod [Tržba za jiného](/navody/trzba-za-jineho)." },
      ],
    },
    {
      id: "kauce-poukazy-kredit",
      heading: "Kauce, poukazy, kredit a vyúčtování",
      blocks: [
        {
          table: {
            head: ["Situace", "Co odeslat"],
            rows: [
              ["9. Host složí kauci a po odjezdu ji dostane celou zpět", "**Nic** – složení ani vrácení se neeviduje, ani stornem"],
              ["10. Z kauce složené na místě si ponecháte 300 Kč na škodu", "Tržbu **300 Kč** (kauci poslanou převodem předem neevidujete)"],
              ["11. Zákazník koupí dárkový poukaz na masáž za 1 000 Kč a pak ho uplatní", "Tržbu **1 000 Kč** při prodeji; uplatnění poukazu se **neeviduje**"],
              ["12. Ve fitku si nabije čip na 500 Kč a za vstup se mu strhne 120 Kč", "**Obě**: nabití i čerpání, s příznaky nabití a čerpání"],
              ["13. Externí firma vydává obědy zaměstnancům jiné firmy a jednou měsíčně je vyúčtuje zaměstnavateli", "Při výdeji **nic**; vyúčtování jen tehdy, když se platí kontaktně"],
            ],
            caption: "Totéž jako u čipu platí pro předplacenou kartu nákupního centra; pro fleet a tankovací karty totéž jako u závodní jídelny.",
          },
        },
      ],
    },
    {
      id: "spropitne",
      heading: "14. Dýško na kartě",
      blocks: [
        {
          p: "U spropitného rozhoduje, **čí je to příjem**. Spropitné pro podnik nebo pro číšníka, který je OSVČ, je evidovaná tržba. Spropitné, které je příjmem zaměstnance, evidenci nepodléhá – evidovat ho ale lze dobrovolně. Podrobně, včetně nového osvobození od daně, v návodu [Spropitné a EET 2.0](/navody/spropitne-a-eet).",
        },
      ],
    },
    {
      id: "storno-a-vypadek",
      heading: "15. Překlep, storno a výpadek internetu",
      blocks: [
        {
          p: "Pokladní namarkuje 1 500 Kč místo 150 Kč. Chybnou tržbu stornujete zprávou se zápornou částkou a pošlete správnou, nebo pošlete jednu **rozdílovou** zprávu na −1 350 Kč. Obojí s **aktuálním datem a časem**, ne s datem původní tržby. Víc v návodu [Storno a vrácení](/navody/storno-a-vraceni-eet).",
        },
        {
          timeline: [
            { date: "Pondělí 10:00", title: "Platba bez signálu", text: "Prodáváte dál, pokladna tržbu uloží." },
            { date: "Pondělí 12:30", title: "Signál je zpět", text: "Tržbu odešlete hned – bezodkladně, ne „někdy do 48 hodin“." },
            { date: "Středa 10:00", title: "Konec lhůty 48 hodin", text: "Nejpozději teď musí být tržba odeslána." },
            { date: "Potom", title: "Povinnost trvá dál", text: `Neodeslanou tržbu pošlete i po lhůtě. ${FACTS.penalties.summary}` },
          ],
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    { q: "Eviduje se zaokrouhlená částka, nebo částka z účtenky?", a: "Skutečně přijatá. Když účet 78,90 Kč zaokrouhlíte při platbě hotově na 79 Kč, evidujete 79 Kč; při platbě kartou 78,90 Kč." },
    { q: "Host platí částečně stravenkou a zbytek kartou. Jsou to dvě tržby?", a: "Ne. Jde o jednu platbu dvěma způsoby, takže se eviduje jedna tržba s celkovou částkou." },
    { q: "Eviduje se vratná kauce?", a: "Při složení ani při vrácení ne. Evidovanou tržbou je až částka, kterou z kauce použijete, a to jen tehdy, když byla kauce složena kontaktně." },
    { q: "Musím evidovat uplatnění dárkového poukazu?", a: "Ne. Eviduje se prodej poukazu; jeho pozdější uplatnění na zboží nebo službu není platbou." },
    { q: "Co když tržbu nestihnu odeslat do 48 hodin?", a: `Odeslat ji musíte i potom – povinnost trvá i po uplynutí lhůty. ${FACTS.penalties.summary}` },
  ],
  howTo: {
    name: "Jak určit, co a kolik evidovat",
    description: "Čtyři kroky podle příkladů Ministerstva financí a Finanční správy.",
    steps: [
      { name: "Ověřte tři podmínky", text: "Příjem z podnikání, kontaktní platba a žádná zákonná výjimka – musí platit všechny najednou." },
      { name: "Vezměte skutečně přijatou částku", text: "Po zaokrouhlení a po slevě; jedna platba více způsoby je jedna tržba." },
      { name: "Rozdělte platbu podle podnikatelů", text: "Patří-li část platby jinému poplatníkovi, odešlete za každého samostatnou datovou zprávu." },
      { name: "Odešlete hned", text: "Nejpozději při přijetí platby; bez signálu bezodkladně po obnovení spojení, nejpozději do 48 hodin." },
    ],
  },
  sources: [SOURCES.seminarVyvojari, SOURCES.zakonUplne, SOURCES.kdoMusi, SOURCES.prakticke],
  related: ["kontaktni-platba", "storno-a-vraceni-eet", "eet-bez-internetu", "trzba-za-jineho"],
  published: "2026-10-28",
  updated: "2026-10-28",
  changelog: [{ date: "2026-10-28", text: "Nový návod podle příkladů Ministerstva financí a Finanční správy." }],
  reviewedBy: null,
  basis: "official",
};
