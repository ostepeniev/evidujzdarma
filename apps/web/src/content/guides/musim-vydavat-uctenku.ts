import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

export const musimVydavatUctenku: Guide = {
  slug: "musim-vydavat-uctenku",
  category: "povinnosti",
  title: "Musím vydávat účtenku? Pravidla EET 2.0 od roku 2027",
  h1: "Musím v EET 2.0 vydávat účtenku?",
  description:
    "EET 2.0 účtenku nepřikazuje, ale na žádost zákazníka doklad vydat musíte. Co na něm musí být podle § 16 zákona o ochraně spotřebitele a jak je to s POK.",
  lead:
    "Ne automaticky. Zákon o evidenci tržeb, který platí od **1. 1. 2027**, povinnost vydat účtenku neukládá. Když ale zákazník o doklad požádá, musíte mu ho vydat podle **§ 16 zákona o ochraně spotřebitele** – s datem, popisem zboží či služby, cenou, svým jménem a IČO. Doklad může být i elektronický.",
  summary: [
    "EET 2.0 neukládá povinnost vystavit ani vytisknout účtenku – tržbu jen odešlete Finanční správě.",
    "Na žádost spotřebitele musíte vydat doklad podle § 16 zákona o ochraně spotřebitele.",
    "Doklad obsahuje datum, zboží nebo službu, cenu a identifikaci prodávajícího včetně IČO.",
    "Povinnosti k daňovým dokladům podle zákona o DPH platí dál, EET 2.0 je nemění.",
    "Tiskárnu účtenek kvůli EET 2.0 kupovat nemusíte.",
  ],
  sections: [
    {
      id: "co-rika-zakon",
      heading: "Co říká zákon o evidenci tržeb",
      blocks: [
        {
          p: "V první EET (2016–2020) byla účtenka s kódy FIK a BKP povinná u každé evidované tržby. EET 2.0 to mění: podnikatel posílá Finanční správě jen nezbytné údaje o tržbě a od ní dostane zpět **potvrzovací kód (POK)**. Vystavit a předat zákazníkovi účtenku kvůli evidenci povinné není.",
        },
        {
          p: "Finanční správa na webu EET 2.0 výslovně uvádí, že zákon o evidenci tržeb povinnost vystavit účtenku neukládá, ale povinnost vydat doklad může vyplývat z **jiných předpisů** – typicky ze zákona o ochraně spotřebitele nebo ze zákona o DPH. Právě to je v praxi podstatné.",
        },
        {
          note: "Zrušení povinné účtenky neznamená, že tržbu nemusíte evidovat. Evidence (odeslání datové zprávy) a vydání dokladu jsou dvě samostatné věci. Co se eviduje, vysvětluje návod [Kontaktní platba: co se eviduje a co ne](/navody/kontaktni-platba).",
        },
      ],
    },
    {
      id: "na-zadost",
      heading: "Kdy doklad vydat musíte: na žádost zákazníka",
      blocks: [
        {
          p: "Podle **§ 16 odst. 1 zákona o ochraně spotřebitele** je prodávající povinen na žádost spotřebitele vydat doklad o koupi zboží nebo poskytnutí služby. Tato povinnost platila už před EET a platí i nadále – bez ohledu na to, zda tržbu evidujete, nebo jste v režimu EET OFF.",
        },
        { h3: "Co musí doklad obsahovat" },
        {
          ul: [
            "**datum** prodeje zboží nebo poskytnutí služby,",
            "**o jaké zboží nebo službu** jde (stačí srozumitelný popis, např. „pánský střih“),",
            "**cenu**, za kterou bylo zboží prodáno nebo služba poskytnuta,",
            "**identifikaci prodávajícího**: jméno a příjmení nebo název či obchodní firmu a **IČO**.",
          ],
        },
        {
          p: "Zákon dále žádá, aby doklad u prodeje s pozdějším dodáním uváděl i místo a datum dodání, a u použitého či vadného zboží, aby to na dokladu bylo zřetelně vyznačeno.",
        },
        { h3: "Papír, nebo e-mail?" },
        {
          p: "§ 16 formu dokladu nepředepisuje. Podle dostupných výkladů proto obstojí i **elektronický doklad** – PDF, e-mail nebo odkaz v SMS –, pokud ho zákazník přijme. Kdo chce papír a vy tiskárnu nemáte, můžete doklad vypsat i ručně z bloku.",
        },
      ],
    },
    {
      id: "dph-a-firmy",
      heading: "Plátci DPH a zákazníci-firmy",
      blocks: [
        {
          p: "Jste-li plátce DPH, řídí se vystavování daňových dokladů **zákonem o DPH** a EET 2.0 na tom nic nemění. Kupuje-li u vás jiná firma nebo podnikatel a chce si nákup uplatnit v nákladech či odpočtu DPH, bude od vás typicky chtít fakturu nebo daňový doklad – to je otázka zákona o DPH a účetních předpisů, ne zákona o evidenci tržeb.",
        },
        {
          p: "Pozor na jeden detail: pokud vám firma zaplatí fakturu bankovním převodem, tržba se do EET neeviduje. Když ale zaplatí na místě hotově nebo kartou, evidovat ji musíte – i když k ní vystavíte fakturu.",
        },
      ],
    },
    {
      id: "pok-a-oznameni",
      heading: "Musí být na dokladu POK? A co cedulka „Evidujeme tržby“?",
      blocks: [
        {
          p: "Ve staré EET musela účtenka nést kódy FIK a BKP (při prodeji bez spojení BKP a PKP). V EET 2.0 se místo nich vrací **POK** – potvrzení, že Finanční správa tržbu přijala. Zda musí být POK uveden na dokladu, který vydáte na žádost zákazníka, Finanční správa k 1. 10. 2026 výslovně nezveřejnila. Zákon samotnou účtenku nepřikazuje, proto povinnost tisknout POK nepředpokládáme – sledujte ale [eet.gov.cz](https://eet.gov.cz).",
        },
        {
          p: "Stará EET také ukládala vyvěsit v provozovně **informační oznámení** o evidenci tržeb. Podle dostupných rozborů nového zákona tato povinnost v EET 2.0 odpadá; oficiální potvrzení Finanční správy jsme k 1. 10. 2026 nedohledali. Pokud si nejste jisti, cedulka vám neuškodí.",
        },
        {
          note: "Stav k 1. 10. 2026: Finanční správa zatím nezveřejnila metodiku k náležitostem dobrovolně vydávaných dokladů v EET 2.0. Jakmile ji vydá, návod doplníme. V nejasných případech se obraťte na daňového poradce.",
          tone: "warn",
        },
      ],
    },
    {
      id: "v-praxi",
      heading: "Jak to řešit v praxi",
      blocks: [
        {
          table: {
            head: ["Situace", "Co udělat"],
            rows: [
              ["Zákazník platí hotově nebo kartou a doklad nechce", "Tržbu zaevidujte (odešlete), doklad vydávat nemusíte."],
              ["Zákazník doklad chce", "Vydejte doklad podle § 16 – papírový nebo elektronický."],
              ["Platí firma na místě a chce daňový doklad", "Tržbu zaevidujte a vystavte doklad podle zákona o DPH (jste-li plátce)."],
              ["Firma platí fakturu převodem z účtu", "Do EET se neeviduje; fakturu vystavíte jako obvykle."],
              ["Jste v režimu EET OFF", "Neevidujete, ale doklad na žádost spotřebitele vydat musíte."],
            ],
            caption: "Evidence tržby a vydání dokladu jsou dvě samostatné povinnosti.",
          },
        },
        {
          p: "Pro většinu malých podnikatelů z toho plyne jednoduchá rutina: pokladna tržbu odešle a dostane POK, zákazník nic dostávat nemusí – a když o doklad požádá, vydáte ho. Státní aplikace MOJE eet umí podle zveřejněných informací vytvářet PDF doklady; podobné funkce mají i komerční pokladny.",
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Dostanu pokutu, když zákazníkovi nedám účtenku?",
      a: "Podle zákona o evidenci tržeb ne – vydání účtenky EET 2.0 nepřikazuje. Odmítnutí vydat doklad na žádost spotřebitele je ale porušením § 16 zákona o ochraně spotřebitele, který kontroluje Česká obchodní inspekce. Za neodeslání tržby hrozí pokuta podle zákona o evidenci tržeb – viz [Pokuty za EET 2.0](/navody/pokuty-eet).",
    },
    {
      q: "Musím si kvůli EET 2.0 koupit tiskárnu?",
      a: "Nemusíte. Na evidenci stačí chytrý telefon, tablet nebo počítač s pokladní aplikací. Doklad na žádost můžete poslat e-mailem, nebo ho výjimečně vypsat ručně.",
    },
    {
      q: "Může být doklad jen elektronický?",
      a: FACTS.receipt.summary,
    },
    {
      q: "Platí pravidla o dokladu i v režimu EET OFF?",
      a: "Ano. EET OFF vás osvobozuje jen od evidence tržeb. Povinnost vydat doklad na žádost spotřebitele podle zákona o ochraně spotřebitele zůstává. Více v návodu [EET OFF: vyplatí se?](/navody/eet-off).",
    },
    {
      q: "Jak se to liší od staré EET?",
      a: "Stará EET vyžadovala u každé tržby účtenku s kódy FIK a BKP (offline BKP a PKP) a informační cedulku v provozovně. EET 2.0 účtenku nepřikazuje a kódy FIK, BKP a PKP nahradil jediný potvrzovací kód POK. Přehled najdete v článku [EET 2.0 vs stará EET](/navody/eet-2-0-vs-eet-1-0).",
    },
  ],
  sources: [SOURCES.prakticke, SOURCES.prezident, SOURCES.fsVladaSchvalila, SOURCES.zos, SOURCES.srovnani],
  related: ["kontaktni-platba", "eet-2-0-vs-eet-1-0", "pokuty-eet"],
  published: "2026-10-01",
  updated: "2026-10-01",
  reviewedBy: null,
};
