import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";

/**
 * S12 (22. 11. 2026): proč se v DIS+ nezobrazuje tlačítko AKTIVOVAT EET – podle dotazu veřejnosti FS z 5. 11. 2026
 * (č. 5652, oprávnění) a dotazu č. 4086 (pověření nastavuje ten, kdo přístup přidělil). Aktivace do 48 hodin a počet
 * přihlášených podle Podnikatel.cz (18. 11. 2026, mluvčí GFŘ). Názvy obrazovek DIS+ jen ty, které uvádí FS.
 * Nový návod → koncept, noindex a mimo strojové kanály do odborné revize (Ф8, Ф9).
 */
export const nezobrazujeSeAktivovatEet: Guide = {
  slug: "nezobrazuje-se-aktivovat-eet",
  category: "prakticke",
  title: "Nezobrazuje se AKTIVOVAT EET v DIS+? Oprávnění",
  h1: "Nezobrazuje se tlačítko AKTIVOVAT EET v DIS+? Oprávnění a pověření",
  description:
    "V DIS+ chybí tlačítko AKTIVOVAT EET? Oprávnění „Prohlížení všeho“ nestačí. Jaká práva nastavit, co musí klient udělit účetní a proč aktivace trvá až 48 hodin.",
  lead:
    "Tlačítko **AKTIVOVAT EET** v DIS+ nevidí uživatelé, kteří mají jen oprávnění k prohlížení. Podle Finanční správy je potřeba oprávnění **Prohlížení a odesílání všeho**, nebo plné pověření pro agendu EET – nastaví ho podnikatel sám. Aktivujte s rezervou, evidovat se musí od **1. 1. 2027**.",
  summary: [
    "„Prohlížení všeho“ ani „Prohlížení všeho včetně práva pověřit přístupem“ k aktivaci EET nestačí.",
    "Potřebné je „Prohlížení a odesílání všeho“, nebo plné pověření pro agendu EET.",
    "Práva nastavuje ten, kdo přístup do DIS+ přidělil – obvykle sám podnikatel nebo statutární orgán firmy.",
    "Po klepnutí na Aktivovat se funkce EET zpřístupní podle Podnikatel.cz nejpozději do 48 hodin.",
  ],
  sections: [
    {
      id: "proc-chybi",
      heading: "Proč tlačítko chybí",
      blocks: [
        { p: FACTS.disPermissions.summary },
        {
          table: {
            head: ["Oprávnění v DIS+", "Stačí na aktivaci EET?"],
            rows: [
              ["Prohlížení všeho", "**Ne** – jen čtení"],
              ["Prohlížení všeho včetně práva pověřit přístupem", "**Ne** – jen čtení"],
              ["Prohlížení a odesílání všeho", "**Ano**"],
              ["Plné pověření pro agendu EET", "**Ano**"],
            ],
            caption: "Podle dotazu veřejnosti Finanční správy z 5. 11. 2026. Stav k 22. 11. 2026.",
          },
        },
        {
          p: "Týká se to každého, kdo do DIS+ firmy nebo OSVČ vstupuje s přiděleným přístupem: zaměstnance, společníka bez statutární funkce, účetní i daňového poradce.",
        },
      ],
    },
    {
      id: "jak-rozsirit",
      heading: "Jak práva rozšířit",
      blocks: [
        { p: FACTS.disPermissions.whoSets },
        {
          ol: [
            "Podnikatel (u firmy statutární orgán nebo osoba s plným přístupem) se přihlásí do DIS+ sám – přes [MOJE daně](https://mojedane.gov.cz/pmd/home/prihlaseni-do-dis).",
            "Otevře **Nastavení a informace o subjektu** → **Uživatelé a oprávnění**.",
            "U osoby, která má EET aktivovat, nastaví **Prohlížení a odesílání všeho**, nebo plné pověření pro agendu EET.",
            "Změnu uloží. Pověřená osoba se pak do DIS+ přihlásí znovu a tlačítko **AKTIVOVAT EET** by už měla vidět.",
          ],
        },
        {
          note: "Přesné popisky obrazovek se v DIS+ mohou měnit. Názvy oprávnění v tomto návodu přebíráme z odpovědi Finanční správy; když se vám liší, řiďte se nápovědou DIS+ nebo infolinkou Finanční správy.",
          tone: "info",
        },
      ],
    },
    {
      id: "48-hodin",
      heading: "Aktivace trvá až 48 hodin",
      blocks: [
        { p: `${FACTS.registrations.activation} ${FACTS.registrations.summary}` },
        {
          stats: [
            { value: "30 895", label: "subjektů přihlášených k EET v DIS+", note: "k 15. 11. 2026" },
            { value: "až 600 tis.", label: "podnikatelů, kterých se EET může týkat", note: "velmi hrubý odhad MF" },
            { value: "48 h", label: "nejdéle trvá zpřístupnění EET po aktivaci", note: "podle Podnikatel.cz" },
          ],
        },
        {
          p: "Po aktivaci následují další kroky – evidenční jednotky a pokladní certifikát. Postup najdete v návodu [Jak aktivovat DIS+ a certifikát](/navody/jak-aktivovat-dis-a-certifikat).",
        },
      ],
    },
    {
      id: "ucetni",
      heading: "Pro účetní: co vám musí klient udělit",
      blocks: [
        {
          p: "Pokud máte EET za klienta aktivovat vy, samotné prohlížení jeho DIS+ nestačí. Požádejte klienta, aby vám v části **Uživatelé a oprávnění** nastavil:",
        },
        {
          ul: [
            "**Prohlížení a odesílání všeho**, nebo",
            "**plné pověření pro agendu EET**.",
          ],
        },
        {
          p: "Nastavit to musí klient sám (nebo ten, kdo vám přístup přidělil) – vy si práva rozšířit nemůžete. Počítejte s tím, že se aktivace může zpřístupnit až za 48 hodin, a nenechávejte ji na poslední prosincový týden.",
        },
        {
          p: "Evidenční jednotky můžete v DIS+ oznámit i hromadně souborem CSV podle formátu, který Finanční správa zveřejnila 3. 11. 2026. Soubor ze záznamů klienta v pokladně vám připraví [Účetní kabinet](/ucetni#import-jednotek).",
        },
        {
          note: "Pokladní certifikát patří klientovi jako poplatníkovi. Soubor .p12 a jeho heslo si neposílejte e-mailem – kdo je má, může jménem klienta odesílat tržby.",
          tone: "warn",
        },
      ],
    },
    {
      id: "pomoc",
      heading: "Nechcete to řešit sami?",
      blocks: [
        {
          p: "S nastavením pomůžeme písemně v rámci služby [Nastavení EET na klíč](/nastaveni-na-klic): připravíme vám osobní postup pro DIS+ (včetně oprávnění), zkontrolujeme evidenční jednotky a pokladnu. Do DIS+ se přihlašujete vy sami, přístupové údaje ani certifikát nám neposíláte.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Mám v DIS+ „Prohlížení všeho“. Proč nevidím AKTIVOVAT EET?",
      a: "Protože jde o oprávnění jen pro čtení. Podle Finanční správy je k aktivaci potřeba „Prohlížení a odesílání všeho“, nebo plné pověření pro agendu EET.",
    },
    {
      q: "Kdo mi oprávnění rozšíří?",
      a: "Ten, kdo vám přístup do DIS+ přidělil – obvykle sám podnikatel, u firmy statutární orgán. Nastavuje se v části Nastavení a informace o subjektu → Uživatelé a oprávnění.",
    },
    {
      q: "Jak dlouho trvá aktivace EET v DIS+?",
      a: "Podle Podnikatel.cz se funkce EET zpřístupní nejpozději do 48 hodin od klepnutí na Aktivovat. Proto aktivujte s předstihem.",
    },
    {
      q: "Může EET za klienta aktivovat účetní?",
      a: "Ano, pokud jí klient v DIS+ udělí oprávnění „Prohlížení a odesílání všeho“, nebo plné pověření pro agendu EET. Samotné prohlížení nestačí.",
    },
    {
      q: "Platí povinnost evidovat i v lednu 2027?",
      a: FACTS.pilot.summary,
    },
  ],
  howTo: {
    name: "Jak zpřístupnit tlačítko AKTIVOVAT EET v DIS+",
    description: "Postup podle odpovědi Finanční správy z 5. 11. 2026.",
    steps: [
      { name: "Přihlaste se jako podnikatel", text: "Do DIS+ vstupte sami za sebe, u firmy jako statutární orgán nebo osoba s plným přístupem." },
      { name: "Otevřete oprávnění", text: "Nastavení a informace o subjektu → Uživatelé a oprávnění." },
      { name: "Rozšiřte práva", text: "Nastavte „Prohlížení a odesílání všeho“, nebo plné pověření pro agendu EET." },
      { name: "Aktivujte EET", text: "Klepněte na AKTIVOVAT EET a počítejte až se 48 hodinami, než se funkce zpřístupní." },
    ],
  },
  sources: [SOURCES.fsDotazOpravneni, SOURCES.fsDotazPovereniDis, SOURCES.podnikatelOpravneni, SOURCES.podnikatelRegistrace, SOURCES.mojeDane, SOURCES.fsTzPrihlasit, SOURCES.fsImportJednotekCsv],
  related: ["jak-aktivovat-dis-a-certifikat", "evidencni-jednotka", "eet-2-0-kompletni-pruvodce"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [{ date: "2026-11-22", text: "Nový návod – čeká na odbornou revizi." }],
  reviewedBy: null,
};
