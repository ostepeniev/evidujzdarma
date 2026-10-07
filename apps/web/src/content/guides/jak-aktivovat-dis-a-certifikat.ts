import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

export const jakAktivovatDisACertifikat: Guide = {
  slug: "jak-aktivovat-dis-a-certifikat",
  category: "prakticke",
  title: "Jak aktivovat DIS+ a stáhnout certifikát EET 2.0",
  h1: "Jak aktivovat DIS+ a stáhnout certifikát EET",
  description:
    "Krok za krokem: přihlášení k evidenci tržeb v DIS+ od 1. 11. 2026, založení evidenčních jednotek a vygenerování pokladního certifikátu (.p12) zdarma.",
  lead:
    "Od **1. 11. 2026** se k EET 2.0 přihlásíte v Daňové informační schránce (DIS+) na portálu MOJE daně. Tam založíte evidenční jednotky a v aplikaci Správa pokladních certifikátů EET si zdarma vygenerujete pokladní certifikát – soubor .p12 chráněný heslem, platný **366 dní**.",
  summary: [
    "Funkce EET 2.0 v DIS+ se otevírají 1. 11. 2026, evidovat se musí od 1. 1. 2027.",
    "Postup: přihlášení do DIS+ → přihlášení k evidenci tržeb → evidenční jednotky → pokladní certifikát.",
    "Certifikát je zdarma, platí 366 dní a patří podnikateli – jeden stačí pro všechny pokladny.",
    "Soubor .p12 a jeho heslo nikomu neposílejte e-mailem; kdo je má, může jménem podnikatele odesílat tržby.",
  ],
  sections: [
    {
      id: "co-pripravit",
      heading: "Co si připravit předem",
      blocks: [
        {
          ul: [
            "**Přístup do portálu MOJE daně** – nejčastěji přes Identitu občana (bankovní identita, eObčanka, mobilní klíč eGovernmentu) nebo přihlašovací údaje k datové schránce. Pokud ho ještě nemáte, zařiďte si ho v říjnu, ať se 1. 11. nezdržíte.",
            "**Seznam evidenčních jednotek** – provozovny, stánky, vozidla, web, nebo vy sami, pokud provozovnu nemáte. Pomůže vám [průvodce evidenčními jednotkami](/evidencni-jednotky).",
            "**Pokladnu**, do které certifikát nahrajete – státní MOJE eet, komerční pokladnu, nebo [pokladnu EvidujZdarma](/#registrace).",
            "**Silné heslo** k soukromému klíči certifikátu, které si bezpečně uložíte.",
          ],
        },
        {
          note: "Funkce pro EET 2.0 se v DIS+ zpřístupní **1. 11. 2026**. Do té doby nejde certifikát vygenerovat ani jednotky založit. Snímky obrazovek do tohoto návodu doplníme hned po spuštění, 1. 11. 2026. Postup níže vychází z dokumentace Finanční správy a certifikační autority EET.",
          tone: "warn",
        },
      ],
    },
    {
      id: "krok-za-krokem",
      heading: "Postup krok za krokem",
      blocks: [
        { h3: "1. Přihlášení do DIS+" },
        {
          p: "Na portálu [MOJE daně](https://mojedane.gov.cz/pmd/home/prihlaseni-do-dis) zvolte dlaždici Online finanční úřad a přihlaste se do Daňové informační schránky (DIS+).",
        },
        { h3: "2. Přihlášení k evidenci tržeb" },
        {
          p: "V prostředí DIS+ se tlačítkem přihlaste k elektronické evidenci tržeb. Tím se vám zpřístupní další funkce – evidenční jednotky a správa certifikátů.",
        },
        { h3: "3. Založení evidenčních jednotek" },
        {
          p: `V části Evidence tržeb → Evidenční jednotky založte každou jednotku: druh (stálá či mobilní provozovna, automat, internetová stránka, dopravní prostředek, nebo vy sami), identifikaci, převažující činnost. ${FACTS.units.allUnits} Systém každé jednotce přidělí **ID jednotky** – to budete potřebovat v pokladně. Podrobnosti v návodu [Evidenční jednotka](/navody/evidencni-jednotka).`,
        },
        { h3: "4. Vygenerování pokladního certifikátu" },
        {
          p: "Otevřete aplikaci **Správa pokladních certifikátů EET**. Při generování v prohlížeči nejprve zvolíte a potvrdíte heslo k soukromému klíči. Certifikát si pak stáhnete ve formátu **PKCS#12** jako soubor s příponou **.p12**, chráněný tímto heslem.",
        },
        { h3: "5. Nahrání do pokladny" },
        {
          p: "V pokladní aplikaci nahrajte soubor .p12, zadejte heslo a vyplňte ID evidenčních jednotek. Pokladna od té chvíle podepisuje datové zprávy vaším certifikátem.",
        },
        { h3: "6. Zkouška nanečisto v prosinci" },
        {
          p: "Pokladnu vyzkoušejte ještě **v prosinci 2026** – v testovacím režimu pokladny, ověřovací zprávou nebo na Playgroundu Finanční správy. Ověřte, že pokladna tržby odesílá a dostává potvrzovací kód (POK). Od **1. 1. 2027** se eviduje naostro.",
        },
        { note: FACTS.pilot.summary, tone: "warn" },
      ],
    },
    {
      id: "certifikat",
      heading: "Co potřebujete vědět o certifikátu",
      blocks: [
        { p: FACTS.certificate.summary },
        {
          table: {
            head: ["Vlastnost", "Hodnota"],
            rows: [
              ["Cena", "Zdarma"],
              ["Kde ho získáte", "DIS+ → Správa pokladních certifikátů EET"],
              ["Formát", "PKCS#12 (.p12), chráněný heslem"],
              ["Platnost", "366 dní"],
              ["Komu patří", "Podnikateli (obsahuje jeho daňové identifikační údaje), ne zařízení"],
              ["Kolik pokladen", "Jeden certifikát lze použít ve více pokladnách"],
              ["Obnova", "Automaticky, pokud ji pokladna podporuje; jinak ručně vydáním nového certifikátu"],
            ],
          },
        },
        {
          p: "Certifikáty z první EET (2016–2020) v EET 2.0 nepoužijete – pro EET 2.0 je vydává nová certifikační autorita EET v2.0.",
        },
      ],
    },
    {
      id: "bezpecnost",
      heading: "Bezpečnost: s certifikátem opatrně",
      blocks: [
        {
          ul: [
            "Soubor .p12 a heslo uchovávejte odděleně. Kdo má obojí, může vaším jménem odesílat tržby.",
            "Neposílejte certifikát s heslem v jednom e-mailu – ani účetní, ani dodavateli pokladny.",
            "Při ztrátě zařízení nebo podezření na únik postupujte podle nápovědy certifikační autority EET: certifikát zneplatněte a vygenerujte nový.",
            "Hlídejte konec platnosti (366 dní od vydání) – datum si zapište do kalendáře, i když vás pokladna upozorňuje.",
          ],
        },
        { cta: "registrace" },
      ],
    },
    {
      id: "caste-problemy",
      heading: "Časté problémy a jak je vyřešit",
      blocks: [
        {
          table: {
            head: ["Problém", "Řešení"],
            rows: [
              ["Zapomněl(a) jsem heslo k souboru .p12", "Heslo nejde obnovit. Vygenerujte v aplikaci Správa pokladních certifikátů EET nový certifikát a nahrajte ho do pokladny."],
              ["Mám víc zařízení (mobil a tablet)", "Stejný certifikát můžete nahrát do více pokladen – patří vám, ne zařízení."],
              ["Pokladna hlásí neznámou evidenční jednotku", "Zkontrolujte, že jste zadali ID jednotky z DIS+, ne IČP ze živnostenského rejstříku."],
              ["Funkce EET v DIS+ nevidím", "Před 1. 11. 2026 ještě nejsou zpřístupněné. Po tomto datu se nejprve přihlaste k evidenci tržeb."],
              ["Blíží se konec platnosti certifikátu", "Obnovte ho v pokladně (pokud podporuje automatickou obnovu), nebo vygenerujte nový ručně."],
            ],
            caption: "Obecné rady podle dokumentace certifikační autority EET. Po spuštění DIS+ je doplníme o konkrétní hlášky.",
          },
        },
      ],
    },
    {
      id: "firmy-a-ucetni",
      heading: "Firmy, zástupci a účetní",
      blocks: [
        {
          p: "Za právnickou osobu jedná v DIS+ statutární orgán nebo osoba s oprávněním (zmocněním) k přístupu do daňové schránky firmy. Pokud vám agendu vede účetní nebo daňový poradce, mohou vám s nastavením pomoci – certifikát ale patří vám jako poplatníkovi. Informace pro účetní najdete na stránce [Pro účetní](/ucetni).",
        },
      ],
    },
  ],
  howTo: {
    name: "Jak aktivovat EET 2.0 v DIS+ a získat pokladní certifikát",
    description:
      "Přihlášení k evidenci tržeb v Daňové informační schránce (DIS+), založení evidenčních jednotek a vygenerování pokladního certifikátu EET 2.0. Funkce jsou dostupné od 1. 11. 2026.",
    steps: [
      { name: "Přihlaste se do DIS+", text: "Na portálu MOJE daně zvolte Online finanční úřad a přihlaste se do Daňové informační schránky (DIS+), např. přes Identitu občana." },
      { name: "Přihlaste se k evidenci tržeb", text: "V DIS+ použijte tlačítko pro přihlášení k elektronické evidenci tržeb." },
      { name: "Založte evidenční jednotky", text: "V části Evidence tržeb → Evidenční jednotky založte každou provozovnu, stánek, vozidlo, web, nebo sebe, pokud provozovnu nemáte. Poznamenejte si přidělená ID jednotek." },
      { name: "Vygenerujte pokladní certifikát", text: "V aplikaci Správa pokladních certifikátů EET zvolte heslo k soukromému klíči a vygenerujte certifikát. Stáhněte soubor .p12." },
      { name: "Nahrajte certifikát do pokladny", text: "V pokladní aplikaci nahrajte soubor .p12, zadejte heslo a doplňte ID evidenčních jednotek." },
      { name: "Vyzkoušejte evidenci nanečisto", text: "V prosinci 2026 v testovacím režimu pokladny ověřte, že tržby odcházejí a vrací se potvrzovací kód (POK). Od 1. 1. 2027 se eviduje naostro." },
    ],
  },
  faq: [
    {
      q: "Od kdy si můžu certifikát pro EET 2.0 stáhnout?",
      a: "Od 1. 11. 2026, kdy Finanční správa zpřístupní funkce EET 2.0 v DIS+ na portálu MOJE daně.",
    },
    {
      q: "Kolik stojí pokladní certifikát?",
      a: "Nic. Certifikát vydává certifikační autorita Finanční správy zdarma.",
    },
    {
      q: "Potřebuji pro každou pokladnu vlastní certifikát?",
      a: "Ne. Certifikát patří podnikateli a jeden můžete použít ve více pokladnách.",
    },
    {
      q: "Můžu použít certifikát ze staré EET?",
      a: "Ne. Pro EET 2.0 vydává certifikáty nová certifikační autorita EET v2.0.",
    },
    {
      q: "Co když mi certifikát vyprší?",
      a: "Pokladna s ním přestane úspěšně odesílat tržby. Proto ho obnovte před koncem platnosti (366 dní) – automaticky, pokud to pokladna umí, nebo ručně vydáním nového certifikátu v DIS+.",
    },
  ],
  sources: [SOURCES.jakZacit, SOURCES.harmonogram, SOURCES.caeetPostupy, SOURCES.caeetNapoveda, SOURCES.mojeDane, SOURCES.vyvojari, SOURCES.fsPlayground, SOURCES.psp],
  related: ["evidencni-jednotka", "eet-2-0-kompletni-pruvodce", "eet-bez-internetu"],
  published: "2026-10-01",
  updated: "2026-10-01",
  changelog: [
    { date: "2026-10-07", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-10-01", text: "První verze návodu. Snímky obrazovek doplníme po spuštění funkcí v DIS+ 1. 11. 2026." },
    {
      date: "2026-10-01",
      text: "Opraveno podle schváleného znění zákona: evidovat se musí od 1. 1. 2027, a to i v lednu. Vyzkoušet pokladnu doporučujeme v prosinci 2026.",
    },
  ],
  reviewedBy: REVIEWER.name,
};
