import { FACTS, SOURCES, formatKc } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const kohoSeEetTyka: Guide = {
  slug: "koho-se-eet-tyka",
  category: "povinnosti",
  title: "Kdo musí mít EET 2.0 od roku 2027 a kdo má výjimku",
  h1: "Kdo musí mít EET 2.0 a kdo má výjimku",
  description:
    "Kadeřnice, taxikář, veterinář i stánek na trhu: od 1. 1. 2027 eviduje každý, komu se platí osobně hotově, kartou nebo QR. Kdo má výjimku a co je EET OFF.",
  lead:
    "Od **1. 1. 2027** musí tržby evidovat každý poplatník daně z příjmů – OSVČ i firma –, který přijímá platby při osobním kontaktu: hotově, kartou nebo QR kódem. Obor ani plátcovství DPH nerozhodují. Výjimku mají vyjmuté činnosti a paušalisté v 1. pásmu s příjmy do 1 mil. Kč, kteří zvolí EET OFF.",
  summary: [
    "Evidovat musí podnikatel (FO i PO), který přijímá platby osobně: hotovost, karta, QR kód, poukázka.",
    "Nezáleží na oboru ani na tom, zda jste plátce DPH. Výjimka pro „příležitostné tržby do 50 000 Kč“ ve schváleném zákoně není.",
    "Netýká se příjmů ze zaměstnání, kapitálových příjmů, nájmu a ostatních (příležitostných) příjmů podle § 10 ZDP.",
    "Vyjmuté jsou jen konkrétní činnosti (např. část dopravy, poštovní služby, hazard, energie) – ne celé obory.",
    `Paušalisté v 1. pásmu s příjmy do 1 mil. Kč mohou místo evidence platit přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně (EET OFF).`,
  ],
  sections: [
    {
      id: "zakladni-pravidlo",
      heading: "Základní pravidlo: dvě podmínky zároveň",
      blocks: [
        {
          p: "Povinnost evidovat vzniká, když platí obě podmínky současně:",
        },
        {
          ol: [
            "**Jste poplatník daně z příjmů** – fyzická osoba (OSVČ) nebo právnická osoba (s. r. o., a. s., družstvo, spolek s podnikáním…).",
            "**Přijímáte evidovanou tržbu** – platbu za zboží nebo službu v rámci podnikání, přijatou při osobním kontaktu nebo v provozovně: hotově, platební kartou, QR kódem, poukázkou, šekem nebo virtuálními aktivy.",
          ],
        },
        { p: FACTS.whoMust.summary },
        {
          p: "Na oboru nezáleží. Kadeřnice, řemeslník, penzion, kavárna, stánek na trhu i lektor, kterému klienti platí na místě kartou, spadají do EET 2.0 stejně. Nerozhoduje ani plátcovství DPH nebo výše obratu, protože zákon obecnou hranici, pod kterou by evidence odpadla, nestanoví. Jedinou výjimkou navázanou na výši příjmů je dobrovolný režim [EET OFF](/navody/eet-off).",
        },
        {
          table: {
            head: ["Kdo", "Eviduje?", "Proč"],
            rows: [
              ["Kadeřnice se salonem, klientky platí kartou i hotově", "**Ano**", "Kontaktní platby v provozovně."],
              [
                "Taxikář, cestující platí ve voze hotově nebo kartou",
                "**Ano**",
                "Výjimky v dopravě (vlak, letadlo, pravidelná hromadná přeprava osob) se taxislužby netýkají. Vůz je evidenční jednotka (dopravní prostředek).",
              ],
              ["Veterinář, majitel zvířete platí v ordinaci", "**Ano**", "Obor nerozhoduje a veterinární péče mezi vyjmutými činnostmi (§ 11–13) není."],
              ["Prodejce medu na farmářském trhu", "**Ano**", "Stánek je mobilní provozovna, i když prodáváte jen o víkendech."],
              ["Grafička, klienti platí převodem na fakturu", "Ne", "Vzdálená platba se neeviduje."],
              ["Pronajímatel bytu, nájemné chodí na účet", "Ne", "Příjem z nájmu pod EET nespadá."],
              ["Dopravní podnik, jízdenka koupená u řidiče autobusu MHD", "Ne", "Vyjmuto (§ 12 odst. 1)."],
            ],
            caption: "Ilustrační příklady. Kdo vedle toho přijímá i jiné platby osobně, eviduje je.",
          },
        },
        {
          note: "Rozhoduje způsob platby, ne obor. Pokud vám všichni zákazníci platí převodem na fakturu nebo přes platební bránu e-shopu, evidovat nemusíte nic. Podrobně v návodu [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "ktere-prijmy-ne",
      heading: "Které příjmy pod EET nespadají",
      blocks: [
        { p: FACTS.whoMust.notCovered },
        {
          ul: [
            "**Zaměstnání** – mzda ani dohody (DPP, DPČ) se neevidují.",
            "**Kapitálové příjmy** – úroky, dividendy, podíly na zisku.",
            "**Nájem** – pronájem bytu nebo nebytového prostoru, pokud jde o příjem z nájmu. Pozor: krátkodobé ubytování s poskytováním služeb (penzion, apartmány) bývá podnikáním – viz [EET u ubytování](/navody/eet-ubytovani).",
            "**Ostatní (příležitostné) příjmy** – například jednorázový prodej věcí z domácnosti, který není podnikáním.",
          ],
        },
        { h3: "Příležitostné tržby z podnikání: hranice 50 000 Kč neplatí" },
        { p: FACTS.whoMust.occasional },
        {
          p: "Neplést s ostatními (příležitostnými) příjmy výše: ty nejsou z podnikání vůbec. Tržba z podnikání se eviduje, i když je malá. Zda je konkrétní tržba ojedinělá ve smyslu § 7, se posuzuje podle okolností – v nejasných případech se poraďte s daňovým poradcem.",
        },
      ],
    },
    {
      id: "vyjimky",
      heading: "Vyjmuté činnosti",
      blocks: [
        { p: FACTS.whoMust.exemptions },
        {
          table: {
            head: ["Oblast", "Co je vyjmuto", "Kde v zákoně"],
            rows: [
              ["Doprava", "Osobní železniční přeprava, platby ve vozidlech pravidelné hromadné přepravy osob a na palubě letadel, obchodní letecká doprava", "§ 12 odst. 1"],
              ["Pošta", "Tržby držitele poštovní licence a poštovní služby", "§ 11 odst. 1, § 12 odst. 1"],
              ["Hazard", "Hazardní hry", "§ 12 odst. 2"],
              ["Energie a voda", "Podnikání v energetice na základě licence, vodovody a kanalizace na základě povolení", "§ 12 odst. 2"],
              ["Finance a veřejný sektor", "Banky, pojišťovny, investiční společnosti, nebankovní spotřebitelské úvěry, platební instituce; stát, obce, příspěvkové organizace", "§ 11, § 12 odst. 2"],
              ["Spolky a neziskovky", "Drobná vedlejší podnikatelská činnost veřejně prospěšných poplatníků; akce v rámci hlavní činnosti (ples, slavnost) nejsou podnikáním", "§ 12 odst. 1 (limity Finanční správa zatím nezveřejnila)"],
              ["Automaty", "Prodejní automaty; samoobslužná zařízení mimo provozovnu, pokud evidence není ani s přiměřenými náklady možná", "§ 13 odst. 2–4"],
              ["Zaměstnanci a školy", "Tržby ze vztahu souvisejícího s pracovněprávním vztahem (například obědy pro vlastní zaměstnance); stravování a ubytování dětí, žáků a studentů, které poskytuje škola nebo školské zařízení", "§ 12 odst. 1"],
              [
                "Nevidomí a hluchoslepí",
                "Podnikatel s nárokem na průkaz ZTP nebo ZTP/P kvůli oboustranné těžké ztrátě zraku, úplné nebo praktické nevidomosti či hluchoslepotě – pokud nevyužívá zaměstnance ani spolupracující osoby, které tuto podmínku nesplňují",
                "§ 11 odst. 4 a 5",
              ],
              ["Nová firma", "Tržby právnické osoby do přidělení DIČ a 10 dní po jeho přidělení", "§ 13 odst. 1"],
              [
                "Další",
                "Veřejné toalety; prodej sladkovodních ryb od 18. do 24. 12. v provozovně, která v tu dobu prodává jen je; platba za služby přes veřejnou mobilní síť, která je čerpáním jiné platby",
                "§ 13 odst. 5",
              ],
            ],
            caption: "Výjimka se vztahuje jen na danou činnost. Kdo má vedle ní i jiné tržby, eviduje je.",
          },
        },
        {
          p: "Výjimka je vždy **věcná**: týká se jen konkrétní činnosti, ne podnikatele jako celku. Pokud provozujete například hernu a vedle ní bar, tržby z baru evidujete.",
        },
        {
          note: "Výčet jsme 28. 10. 2026 ověřili podle zákona č. 180/2026 Sb. (§ 11–13). Pokud vaše činnost leží na hraně výjimky (samoobslužná zařízení, spolky, doprava), ověřte si to na [eet.gov.cz](https://eet.gov.cz) nebo u daňového poradce.",
          tone: "warn",
        },
      ],
    },
    {
      id: "eet-off",
      heading: "EET OFF: legální cesta, jak neevidovat",
      blocks: [
        { p: FACTS.eetOff.summary },
        {
          p: `Na rozdíl od vyjmutých činností si EET OFF musíte zvolit sami a včas: ${FACTS.eetOff.howTo} Za rok to dělá ${formatKc(FACTS.eetOff.surchargeYearly)} navíc. ${FACTS.eetOff.binding}`,
        },
        { cta: "eet-off" },
      ],
    },
    {
      id: "zahranicni",
      heading: "Zahraniční podnikatelé a nerezidenti",
      blocks: [
        {
          p: "Povinnost je navázaná na postavení poplatníka české daně z příjmů, ne na státní občanství. Podle rozborů zákona se u daňových nerezidentů týká tržeb ze zdrojů v Česku, které zde přijmou. Zahraniční subjekt, který stejnou tržbu eviduje srovnatelným způsobem podle práva státu, s nímž má Česko smlouvu o výměně informací, ji podle dostupných rozborů nemusí evidovat znovu.",
        },
      ],
    },
    {
      id: "jak-zjistit",
      heading: "Jak si to rychle ověřit",
      blocks: [
        {
          ol: [
            "Projděte si, jakými způsoby vám zákazníci platí. Pokud nic nepřijímáte osobně (hotově, kartou, QR kódem na místě), evidovat nemusíte.",
            "Zkontrolujte, zda vaše činnost nepatří mezi vyjmuté.",
            "Jste-li OSVČ v paušálním režimu, spočítejte si, zda se vám vyplatí EET OFF – lhůta je do **11. 1. 2027**.",
            "Pokud evidovat budete, od **1. 11. 2026** se přihlaste v DIS+ a oznamte evidenční jednotky – postup v návodu [Jak aktivovat DIS+ a stáhnout certifikát](/navody/jak-aktivovat-dis-a-certifikat). Evidovat musíte od **1. 1. 2027**.",
          ],
        },
        {
          p: "Rychlejší cestu nabízí náš [kvíz Musím evidovat?](/musim-evidovat) (6 otázek) nebo [kontrola podle IČO](/kontrola-ico), která z veřejných rejstříků odhadne, zda a kolik evidenčních jednotek budete potřebovat.",
        },
        { cta: "kviz" },
      ],
    },
  ],
  faq: [
    {
      q: "Jsem neplátce DPH. Týká se mě EET 2.0?",
      a: "Ano, pokud přijímáte platby osobně (hotově, kartou, QR kódem). Registrace k DPH s evidencí tržeb nesouvisí.",
    },
    {
      q: "Mám malý obrat. Je nějaká hranice, pod kterou evidovat nemusím?",
      a: `Obecná hranice obratu neexistuje. Jedinou výjimkou navázanou na příjmy je EET OFF: fyzická osoba v 1. pásmu paušálního režimu s příjmy do ${formatKc(FACTS.eetOff.incomeLimit)} ročně může místo evidence platit přirážku ${formatKc(FACTS.eetOff.surchargeMonthly)} měsíčně.`,
    },
    {
      q: "Platí výjimka pro příležitostné tržby do 50 000 Kč?",
      a: FACTS.whoMust.occasional,
    },
    {
      q: "Přijímám jen platby převodem na účet. Musím evidovat?",
      a: "Ne, pokud jde o převody na základě faktury nebo vzdálené platby. Evidují se jen platby přijaté při osobním kontaktu. Výjimkou může být QR platba naskenovaná přímo u vás na místě – viz [Kontaktní platba](/navody/kontaktni-platba).",
    },
    {
      q: "Pronajímám byt. Týká se mě EET?",
      a: "Příjmy z nájmu pod EET nespadají. Jiná situace je krátkodobé ubytování provozované jako živnost (penzion, apartmány se službami) – tam se platby přijaté na místě evidují.",
    },
    {
      q: "Jsem taxikář. Musím evidovat?",
      a: "Ano, pokud vám cestující platí ve voze hotově, kartou nebo QR kódem. Zákon v dopravě vyjímá železniční a leteckou přepravu a platby ve vozidlech pravidelné hromadné přepravy osob, taxislužbu ne. Evidenční jednotkou je vůz jako dopravní prostředek – viz [Evidenční jednotka](/navody/evidencni-jednotka). Jízdu zaplacenou předem online přes platební bránu neevidujete.",
    },
    {
      q: "Jsem veterinář. Týká se mě EET 2.0?",
      a: "Ano. Obor nerozhoduje a veterinární péče mezi vyjmutými činnostmi není. Evidujete platby, které majitelé zvířat zaplatí v ordinaci nebo při vaší návštěvě hotově, kartou či QR kódem. Faktura uhrazená převodem se neeviduje.",
    },
    {
      q: "Náš spolek pořádá ples a prodává občerstvení. Musíme evidovat?",
      a: "Podle Finanční správy zůstávají akce, které jsou součástí hlavní činnosti spolku (plesy, slavnosti), mimo EET a pro drobnou vedlejší podnikatelskou činnost je připravena výjimka. Konkrétní limity zatím nebyly zveřejněny – ověřte je na eet.gov.cz.",
    },
  ],
  sources: [
    SOURCES.zakonUplne,
    SOURCES.kdoMusi,
    SOURCES.mfPredstavuje,
    SOURCES.fsVladaSchvalila,
    SOURCES.eetOff,
    SOURCES.eetOffJak,
    SOURCES.podnikatelPrehled,
    SOURCES.leitnerNerezidenti,
    SOURCES.podnikatelDetail,
    SOURCES.psp,
  ],
  related: ["kontaktni-platba", "eet-off", "eet-2-0-kompletni-pruvodce"],
  published: "2026-10-01",
  updated: "2026-10-31",
  changelog: [
    {
      date: "2026-10-31",
      text: "Doplněna tabulka příkladů podle profese (kadeřnice, taxikář, veterinář, farmářský trh, pronájem bytu, MHD) a otázky k taxislužbě a veterinářům.",
    },
    {
      date: "2026-10-28",
      text: "Doplněny výjimky podle zákona č. 180/2026 Sb.: nevidomí a hluchoslepí podnikatelé, pracovněprávní vztahy a školní stravování, nová právnická osoba do přidělení DIČ a platby přes mobilní síť.",
    },
    { date: "2026-10-15", text: "Výčet vyjmutých činností ověřen podle zákona č. 180/2026 Sb. (§ 11–13): doplněny veřejné toalety, upřesněny automaty a prodej ryb před Vánoci." },
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: povinnost evidovat platí od 1. 1. 2027, ne od 1. 2. 2027. Doplněno, že výjimka pro příležitostné tržby do 50 000 Kč v zákoně není.",
    },
  ],
  reviewedBy: REVIEWER.name,
};
