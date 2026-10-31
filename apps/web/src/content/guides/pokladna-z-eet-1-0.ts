import { FACTS, SOURCES } from "../facts";
import { EXISTING_POS_SERVICE, WHY_CHEAPER } from "../services";
import type { Guide } from "./types";

/**
 * К13 (31. 10. 2026, rozhodnutí majitele): praktický návod pro podnikatele s pokladnou z první EET (2016–2020).
 * Jen fakta, která už web má (FACTS, návody eet-2-0-vs-eet-1-0 a jak-aktivovat-dis-a-certifikat); tři cesty připojení
 * a orientační ceny servisních firem jsou zkušenost partnerské účetní kanceláře (EXISTING_POS_SERVICE), ne zákon.
 * Nejde o převyprávění oficiálních příkladů (basis "official" ne) → koncept, noindex a mimo strojové kanály do revize (Ф9).
 */
export const pokladnaZEet10: Guide = {
  slug: "pokladna-z-eet-1-0",
  category: "prakticke",
  title: "Mám pokladnu z EET 1.0 – co teď? Připojení k EET 2.0",
  h1: "Mám pokladnu z EET 1.0 – co teď?",
  description:
    "Pokladna z první EET a EET 2.0: na co se zeptat dodavatele, nový certifikát a evidenční jednotky v DIS+ a tři cesty, jak starou pokladnu připojit.",
  lead:
    "Pokladnu z první EET (2016–2020) použijete pro EET 2.0 jen tehdy, když ji dodavatel aktualizuje na nové rozhraní – staré pokladny posílaly jiný formát zprávy. Potřebuje také nový pokladní certifikát z DIS+ a ID evidenčních jednotek. Připojit ji můžete přes servisní firmu, vzdáleně s námi, nebo sami, a evidovat se musí od **1. 1. 2027**.",
  summary: [
    "Stará pokladna funguje s EET 2.0 jen po aktualizaci od dodavatele – kódy FIK a BKP už neexistují, nově se vrací POK.",
    "Certifikát z první EET nepoužijete: nový pokladní certifikát si zdarma vygenerujete v DIS+, platí 366 dní.",
    "Místo provozoven oznamujete v DIS+ evidenční jednotky a jejich ID zadáte do pokladny.",
    "Připojit pokladnu můžete přes servisní firmu, vzdáleně s námi, nebo sami podle písemného návodu.",
  ],
  sections: [
    {
      id: "jde-to",
      heading: "Půjde stará pokladna použít?",
      blocks: [
        {
          p: "Jen pokud výrobce nebo dodavatel pokladnu aktualizuje na nové rozhraní EET 2.0. Staré pokladny posílaly jiný formát zprávy a pracovaly s kódy FIK a BKP, které už neexistují. Finanční správa v EET 2.0 vrací na každou přijatou tržbu jediný potvrzovací kód **POK**.",
        },
        {
          p: "Certifikáty z první EET v EET 2.0 nepoužijete – pro EET 2.0 je vydává nová certifikační autorita EET v2.0. I aktualizovaná pokladna proto potřebuje nový pokladní certifikát z DIS+.",
        },
      ],
    },
    {
      id: "na-co-se-zeptat",
      heading: "Na co se zeptat dodavatele pokladny",
      blocks: [
        {
          ul: [
            "**Podporuje pokladna EET 2.0?** Tedy nové rozhraní, evidenční jednotky místo provozoven a potvrzovací kód POK místo FIK.",
            "**Je potřeba aktualizace?** Stačí nová verze programu, nebo je nutné vyměnit zařízení?",
            "**Kolik to bude stát?** Jednorázově, nebo v rámci měsíčního paušálu? Platí se cesta technika?",
            "**Jak se nahrává certifikát a kam se zadávají ID evidenčních jednotek?**",
            `**Odešle pokladna tržbu dodatečně při výpadku spojení?** ${FACTS.offline.summary}`,
            "**Umí pokladna certifikát obnovit sama?** Certifikát platí 366 dní; pokud pokladna automatickou obnovu neumí, vydáte nový certifikát ručně.",
          ],
        },
      ],
    },
    {
      id: "tri-cesty",
      heading: "Tři cesty, jak pokladnu připojit",
      blocks: [
        { ol: EXISTING_POS_SERVICE.options.map((o) => `**${o.title}.** ${o.text}`) },
        {
          note: "Ceny servisních firem uvádíme orientačně podle zkušeností naší partnerské účetní kanceláře, nejde o ceník žádné konkrétní firmy. Na přesnou částku se zeptejte svého dodavatele.",
          tone: "info",
        },
        {
          p: "Ať zvolíte kteroukoli cestu, soubor certifikátu (.p12) a jeho heslo nikomu neposílejte e-mailem – kdo je má, může vaším jménem odesílat tržby. Když pokladnu připojuje technik, heslo zadejte sami.",
        },
      ],
    },
    {
      id: "kroky-v-dis",
      heading: "Co udělat v DIS+",
      blocks: [
        {
          ol: [
            "Od **1. 11. 2026** se přihlaste do DIS+ na portálu [MOJE daně](https://mojedane.gov.cz/pmd/home/prihlaseni-do-dis), například přes Identitu občana.",
            "V DIS+ se přihlaste k evidenci tržeb.",
            `Oznamte evidenční jednotky. ${FACTS.units.summary} ${FACTS.units.allUnits}`,
            `Vygenerujte nový pokladní certifikát. ${FACTS.certificate.summary}`,
            "Certifikát nahrajte do pokladny, zadejte heslo a ID evidenčních jednotek.",
            "V prosinci 2026 pokladnu vyzkoušejte v testovacím režimu a ověřte, že se vrací potvrzovací kód (POK).",
          ],
        },
        {
          p: "Podrobný postup najdete v návodech [Jak aktivovat DIS+ a certifikát](/navody/jak-aktivovat-dis-a-certifikat) a [Evidenční jednotka](/navody/evidencni-jednotka).",
        },
      ],
    },
    {
      id: "co-se-lisi",
      heading: "Co se oproti první EET změnilo",
      blocks: [
        {
          table: {
            head: ["", "Stará EET (2016–2020)", "EET 2.0 (od 2027)"],
            rows: [
              ["Účtenka", "Povinná u každé tržby", "Nepovinná; na žádost doklad podle zákona o ochraně spotřebitele"],
              ["Kódy", "FIK, BKP, PKP", "Jediný potvrzovací kód POK; uvést ho na dokladu je dobrovolné"],
              ["Místo prodeje", "Provozovna (id_provoz)", "Evidenční jednotka (id_jednotky) – i web, vozidlo nebo poplatník sám"],
              ["Identifikace poplatníka", "DIČ (dic_popl)", "EIČ (eic_popl)"],
              ["Správa", "Webová aplikace EET na daňovém portálu", "DIS+ na portálu MOJE daně"],
              ["Certifikát", "Platnost 3 roky", "Platnost 366 dní, možná automatická obnova"],
            ],
            caption: "Výběr z návodu EET 2.0 vs stará EET. Technické údaje podle dokumentace Finanční správy pro vývojáře.",
          },
        },
        { p: "Celé srovnání najdete v návodu [EET 2.0 vs stará EET](/navody/eet-2-0-vs-eet-1-0)." },
      ],
    },
    {
      id: "kdy-prejit",
      heading: "Kdy je jednodušší přejít na EvidujZdarma",
      blocks: [
        {
          p: "Pokud dodavatel aktualizaci nenabízí, pokladnu už nikdo neservisuje, nebo by připojení stálo víc, než chcete dát, může být jednodušší přejít na jinou pokladnu.",
        },
        { ul: [...WHY_CHEAPER] },
        {
          p: "S nastavením vám pomůžeme: [Nastavení EET na klíč](/nastaveni-na-klic) pro pokladnu EvidujZdarma, nebo [Připojení stávající pokladny](/nastaveni-na-klic#stavajici-pokladna), pokud chcete zůstat u své. Ceny pokladen najdete na stránce [Přechod z jiné pokladny](/prechod-z-jine-pokladny).",
        },
        { cta: "registrace" },
      ],
    },
  ],
  faq: [
    {
      q: "Musím kvůli EET 2.0 koupit novou pokladnu?",
      a: "Ne nutně. Pokud dodavatel vaši pokladnu aktualizuje na rozhraní EET 2.0, můžete ji používat dál s novým certifikátem. Pokud aktualizaci nenabízí, potřebujete jinou pokladnu – například státní MOJE eet nebo pokladnu EvidujZdarma v telefonu, tabletu či počítači.",
    },
    {
      q: "Můžu použít certifikát ze staré EET?",
      a: "Ne. Pro EET 2.0 vydává certifikáty nová certifikační autorita EET v2.0. Nový certifikát si zdarma vygenerujete v DIS+.",
    },
    {
      q: "Kolik stojí připojení přes servisní firmu?",
      a: "Podle zkušeností naší partnerské účetní kanceláře jednorázově zhruba 900–1 000 Kč plus cesta, nebo bývá v měsíčním paušálu 70–200 Kč. Jde o orientační údaj z praxe – přesnou cenu vám řekne váš dodavatel.",
    },
    {
      q: "Smím technikovi poslat soubor certifikátu a heslo?",
      a: "Raději ne. Kdo má soubor certifikátu a heslo, může vaším jménem odesílat tržby. Certifikát nahrajte do pokladny sami, nebo heslo zadejte sami, když pokladnu připojuje technik.",
    },
    {
      q: "Platí ještě stará EET?",
      a: "Ne. Stará EET byla pozastavena v březnu 2020 a zrušena k 1. 1. 2023. EET 2.0 je nový zákon účinný od 1. 1. 2027.",
    },
  ],
  howTo: {
    name: "Jak připojit pokladnu z první EET k EET 2.0",
    description: "Ověření u dodavatele, kroky v DIS+ (evidenční jednotky a nový pokladní certifikát) a připojení pokladny.",
    steps: [
      { name: "Zeptejte se dodavatele", text: "Zjistěte, zda pokladna podporuje EET 2.0, jestli potřebuje aktualizaci a kolik bude stát." },
      { name: "Připravte DIS+", text: "Od 1. 11. 2026 se v DIS+ přihlaste k evidenci tržeb a oznamte evidenční jednotky." },
      { name: "Vygenerujte nový certifikát", text: "V DIS+ si zdarma vygenerujte pokladní certifikát (soubor .p12 s heslem, platnost 366 dní)." },
      { name: "Připojte pokladnu", text: "Přes servisní firmu, vzdáleně s námi, nebo sami podle návodu: nahrajte certifikát, zadejte heslo a ID evidenčních jednotek." },
      { name: "Vyzkoušejte ji", text: "V prosinci 2026 ověřte v testovacím režimu, že se vrací POK. Od 1. 1. 2027 se eviduje naostro." },
    ],
  },
  sources: [SOURCES.jakZacit, SOURCES.caeetPostupy, SOURCES.mojeDane, SOURCES.harmonogram, SOURCES.prakticke, SOURCES.vyvojari, SOURCES.srovnani, SOURCES.fsZruseni2023],
  related: ["eet-2-0-vs-eet-1-0", "jak-aktivovat-dis-a-certifikat", "evidencni-jednotka", "eet-bez-internetu"],
  published: "2026-10-31",
  updated: "2026-10-31",
  changelog: [{ date: "2026-10-31", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
