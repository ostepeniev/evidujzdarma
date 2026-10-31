import { SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const trzbaZaJineho: Guide = {
  slug: "trzba-za-jineho",
  category: "povinnosti",
  title: "Tržba za jiného v EET 2.0: pověření a komisní prodej",
  h1: "Tržba za jiného (pověření): masér v hotelu, prodej v cizím obchodě",
  description:
    "Masáž placená na recepci hotelu, med včelaře v cizím obchodě, sdílený stánek: kdo od 1. 1. 2027 eviduje tržbu za jiného a jak funguje pověření v EET 2.0.",
  lead:
    "EET 2.0 umožňuje, aby tržbu evidoval jiný podnikatel než ten, komu patří – na základě **pověření**. Typicky hotel, který na recepci inkasuje za externího maséra. Pověřený pak eviduje a datová zpráva od **1. 1. 2027** nese identifikaci obou podnikatelů. Často je ale jednodušší jiné uspořádání: každý eviduje sám, nebo hotel službu přeprodá.",
  summary: [
    "Poplatník, jemuž tržba plyne, může evidencí pověřit jiného poplatníka.",
    "Pověřený eviduje tržbu za pověřujícího; datová zpráva obsahuje identifikaci obou.",
    "Při komisním prodeji (nepřímé zastoupení) eviduje celou tržbu prodejce, svým jménem a svým certifikátem.",
    "Pověřujícího to podle rozborů zákona nezbavuje odpovědnosti za to, že jeho tržba bude zaevidována.",
    "Alternativy: každý eviduje vlastní tržby sám, nebo jeden podnikatel službu či zboží přeprodává jako svou tržbu.",
  ],
  sections: [
    {
      id: "o-co-jde",
      heading: "O co jde",
      blocks: [
        {
          p: "V praxi často peníze od zákazníka nepřebírá ten, komu tržba patří. Host zaplatí masáž na recepci hotelu, zákazník koupí med místního včelaře v cizím obchodě, dva podnikatelé sdílejí jeden stánek a jednu kasu. EET 2.0 pro tyto situace nabízí institut **pověření**: poplatník, kterému tržba plyne, pověří jiného poplatníka, aby ji za něj evidoval.",
        },
        {
          p: "Pověřený podle § 10 zákona fakticky jedná za pověřujícího: tržbu eviduje, plní za něj v rozsahu pověření i další povinnosti podle zákona o evidenci tržeb a odpovídá za jejich porušení. Pověřující se ale odpovědnosti za evidenci své tržby úplně nezbavuje – pokud tržba zaevidována není, může to dopadnout i na něj.",
        },
        {
          note: "Pověření upravuje § 10 zákona č. 180/2026 Sb. Jaké údaje nese datová zpráva v pověření a v zastoupení, popsaly Ministerstvo financí a Finanční správa v prezentaci k EET 2.0; formu samotného pověření zatím podrobně nepopsaly. Než pověření nastavíte, poraďte se s daňovým poradcem.",
          tone: "warn",
        },
      ],
    },
    {
      id: "datova-zprava",
      heading: "Co se mění v datové zprávě",
      blocks: [
        {
          p: "Zpráva odeslaná v pověření nese EIČ pověřeného poplatníka, údaje o jeho evidenční jednotce a identifikaci pověřujícího – technická dokumentace EET 2.0 pro to má pole **eic_poverujiciho**. Podepisuje ji certifikát pověřeného. Bez těchto údajů by evidence nebyla platná.",
        },
        {
          p: "Když jedna tržba plyne více poplatníkům – například společníkům podle smlouvy o společnosti nebo spoluvlastníkům –, mohou evidencí pověřit jednoho z nich, nebo jiného poplatníka. Zpráva pak nese příznak **povereni_vice_popl** („Pověření více poplatníky“). Je-li pověřen jeden z nich, EIČ pověřujícího se nevyplňuje; je-li pověřen někdo jiný, může v něm být EIČ některého z poplatníků, kterým tržba plyne.",
        },
        {
          p: "Pro pokladnu to znamená, že musí umět u konkrétní tržby zvolit, za koho se eviduje. Než pověření začnete používat, ověřte si u dodavatele pokladny, že tuto funkci podporuje.",
        },
      ],
    },
    {
      id: "zastoupeni",
      heading: "Přímé a nepřímé zastoupení",
      blocks: [
        {
          p: "Kromě pověření zákon počítá i se zastoupením. Ministerstvo financí a Finanční správa v prezentaci k EET 2.0 rozlišují tyto situace:",
        },
        {
          table: {
            head: ["Situace", "Kdo eviduje", "Čí EIČ, jednotka a certifikát"],
            rows: [
              ["**Vlastní tržba**", "Ten, komu tržba plyne", "Vlastní"],
              [
                "**Přímé zastoupení** – jednáte jménem a na účet jiného (například mandátní smlouva)",
                "Zastoupený. Tržbu za něj může odeslat zástupce, plnou odpovědnost ale nese zastoupený.",
                "Zastoupeného",
              ],
              [
                "**Nepřímé zastoupení** – jednáte svým jménem na účet jiného (typicky komisionářská smlouva)",
                "Zástupce, a to celou tržbu – i část, která není jeho příjmem, nejen marži",
                "Zástupce; EIČ zastoupeného ve zprávě není",
              ],
              ["**Pověření**", "Pověřený", "Pověřeného, navíc EIČ pověřujícího"],
              ["**Pověření více poplatníky**", "Jeden z nich, nebo jiný pověřený poplatník", "Pověřeného, navíc příznak, že tržba plyne více poplatníkům"],
            ],
            caption: "Podle prezentace Ministerstva financí a Finanční správy k EET 2.0 (Specifické případy).",
          },
        },
        { h3: "Jedna platba, více podnikatelů" },
        {
          p: "Když jedna platba zákazníka zakládá příjem více poplatníkům, eviduje se tržba zvlášť za každého z nich. Příklad z prezentace: zákazník na čerpací stanici zaplatí benzín i kávu. Prodejce eviduje kávu jako svou tržbu a benzín v pověření za jiného poplatníka – platbu tedy odešle ve dvou samostatných datových zprávách.",
        },
      ],
    },
    {
      id: "tri-modely",
      heading: "Čtyři způsoby, jak spolupráci nastavit",
      blocks: [
        {
          table: {
            head: ["Model", "Kdo eviduje", "Kdy se hodí"],
            rows: [
              ["**A. Každý sám**", "Každý podnikatel eviduje svou tržbu ve své pokladně", "Masér si bere platby sám (kartou nebo hotově u lehátka)."],
              ["**B. Přeprodej**", "Hotel nebo obchod eviduje celou částku jako svou tržbu; partner mu fakturuje", "Hotel prodává masáž jako vlastní službu, obchod zboží výrobce nakupuje."],
              ["**C. Pověření**", "Hotel nebo obchod eviduje tržbu za partnera, zpráva nese identifikaci obou", "Recepce vybírá peníze za externího maséra, ale tržba patří masérovi."],
              ["**D. Komisní prodej**", "Obchod eviduje celou částku svým jménem a certifikátem (nepřímé zastoupení)", "Obchod prodává zboží výrobce svým jménem na jeho účet a peníze mu později vyúčtuje."],
            ],
          },
        },
        {
          p: "Model A je nejjednodušší a nevyžaduje žádnou dohodu. Model B mění obchodní vztah – tržba patří hotelu nebo obchodu a partner (masér, výrobce) jim vystaví fakturu, kterou dostane zaplacenou převodem (ta se neeviduje). Model C zachovává tržbu partnerovi, ale vyžaduje dohodu, pokladnu s podporou pověření a důvěru mezi oběma stranami. Model D je pro obchod z pohledu EET běžná tržba – eviduje ji celou a výrobci pak peníze vyúčtuje.",
        },
      ],
    },
    {
      id: "priklady",
      heading: "Příklady z praxe",
      blocks: [
        { h3: "Masér v hotelu" },
        {
          p: "Masér je OSVČ a v hotelu má pronajatou místnost. Pokud mu klienti platí přímo, eviduje sám (model A) – jako evidenční jednotku uvede provozovnu, nebo sám sebe. Pokud hosté platí masáž na recepci spolu s ubytováním, může hotel tržbu evidovat v pověření (model C), nebo masáž prodávat jako vlastní službu a masérovi platit na fakturu (model B).",
        },
        { h3: "Výrobce prodává v cizím obchodě" },
        {
          p: "Včelař dodává med do obchodu se smíšeným zbožím. Když obchod med odkoupí a prodává dál, jde o běžnou tržbu obchodu. Když ho prodává svým jménem na účet včelaře (komisní prodej), jde o nepřímé zastoupení: obchod eviduje celou prodejní cenu, svým jménem a svým certifikátem, a včelař tyto prodeje znovu neeviduje. Kdyby obchod prodával jménem včelaře, šlo by o přímé zastoupení a evidovalo by se s údaji včelaře.",
        },
        { h3: "Sdílený stánek nebo salon" },
        {
          p: "Dvě kadeřnice sdílejí salon a jeden terminál. Nejčistší je, když má každá vlastní pokladnu a eviduje své tržby. Pokud chtějí jednu kasu, jedna může evidovat za druhou v pověření – v pokladně pak u každé tržby musí být jasné, komu patří. Více v návodu [EET pro kadeřnictví a kosmetiku](/navody/eet-kadernictvi-kosmetika).",
        },
        { cta: "registrace" },
      ],
    },
    {
      id: "doporuceni",
      heading: "Doporučení před spuštěním",
      blocks: [
        {
          ol: [
            "Rozhodněte, který model (A, B, C, nebo D) vám dává smysl – nejjednodušší bývá A.",
            "Při pověření si dohodu sepište: kdo eviduje, za jaké tržby, odkdy a jak si budete předávat peníze a přehledy.",
            "Ověřte, že pokladna pověřeného umí evidovat tržby za jiného poplatníka.",
            "Ujasněte si, čí evidenční jednotky se použijí: v pověření a v nepřímém zastoupení jednotky toho, kdo eviduje, v přímém zastoupení jednotky zastoupeného.",
            "Pravidelně si porovnávejte přehledy tržeb – pověřující se odpovědnosti za evidenci své tržby nezbavuje.",
          ],
        },
        {
          p: "Text pověření si můžete připravit ve [vzoru pověření k evidování tržeb](/vzor-povereni): vyplníte obě strany, rozsah a datum a vzor vytisknete nebo uložíte jako PDF. Před podpisem ho projděte s účetní.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Může za mě tržby evidovat někdo jiný?",
      a: "Ano. EET 2.0 umožňuje pověřit evidencí tržby jiného poplatníka. Ten tržbu eviduje za vás a datová zpráva obsahuje identifikaci vás obou.",
    },
    {
      q: "Kdo odpovídá, když pověřený tržbu nezaeviduje?",
      a: "Pověřený odpovídá za povinnosti, které v rozsahu pověření plní. Podle rozborů zákona se ale pověřující nezbavuje odpovědnosti za to, že jeho tržba bude zaevidována. Proto si přehledy tržeb pravidelně kontrolujte.",
    },
    {
      q: "Musí být pověření písemné?",
      a: "Formální náležitosti pověření Finanční správa zatím podrobně nepopsala. Doporučujeme dohodu sepsat – kvůli jasnému rozsahu i případné kontrole.",
    },
    {
      q: "Prodávám zboží v komisi. Kdo eviduje tržbu?",
      a: "Při komisním prodeji jednáte svým jménem na účet jiného – jde o nepřímé zastoupení. Tržbu evidujete vy, a to celou částku, kterou zákazník zaplatil, svým jménem a svým certifikátem. EIČ toho, na čí účet prodáváte, se do zprávy neuvádí.",
    },
    {
      q: "Hotel vybírá peníze za maséra. Je to jeho tržba, nebo masérova?",
      a: "Záleží na tom, jak máte vztah nastavený. Pokud hotel prodává masáž jako vlastní službu, je to tržba hotelu. Pokud vybírá peníze za maséra, je to masérova tržba, kterou může hotel evidovat v pověření.",
    },
  ],
  sources: [SOURCES.zakonUplne, SOURCES.seminarVyvojari, SOURCES.vyvojari, SOURCES.podnikatelDetail, SOURCES.podnikatelPrehled, SOURCES.kdoMusi],
  related: ["koho-se-eet-tyka", "evidencni-jednotka", "eet-kadernictvi-kosmetika", "eet-gastronomie"],
  published: "2026-10-01",
  updated: "2026-10-28",
  changelog: [
    {
      date: "2026-10-28",
      text: "Doplněno přímé a nepřímé zastoupení, pověření více poplatníky a evidence jedné platby za více podnikatelů podle prezentace Ministerstva financí a Finanční správy.",
    },
    { date: "2026-10-17", text: "Doplněn odkaz na vzor pověření k evidování tržeb." },
    { date: "2026-10-15", text: "Doplněno číslo zákona ve Sbírce zákonů (zákon č. 180/2026 Sb.) a paragrafy ověřené podle vyhlášeného znění." },
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-01", text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, ne od 1. 2. 2027." },
  ],
  reviewedBy: REVIEWER.name,
};
