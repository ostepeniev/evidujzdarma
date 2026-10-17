import { FACTS } from "../facts";
import type { HelpArticle } from "./types";

/**
 * Začínáme: přihlášení a Nastavení pokladny (components/setup/setup-app.tsx – kroky 1–6), registrace zařízení.
 * Názvy kroků, polí a tlačítek doslovně z aplikace.
 */
export const ZACINAME: readonly HelpArticle[] = [
  {
    slug: "prvni-spusteni",
    topic: "zaciname",
    title: "První spuštění: přihlášení a nastavení pokladny",
    description:
      "Jak začít s pokladnou EvidujZdarma: přihlášení odkazem z e-mailu bez hesla a průchod Nastavením pokladny od kroku Firma až po registraci zařízení.",
    lead: "Pokladnu EvidujZdarma otevřete v prohlížeči na mobilu, tabletu nebo počítači. Heslo nepotřebujete – přihlásíte se odkazem z e-mailu. Pak vás **Nastavení pokladny** provede krok za krokem až k první tržbě.",
    steps: [
      {
        name: "Zadejte e-mail",
        text: "Na stránce **Přihlášení a registrace** (evidujzdarma.cz/prihlaseni) vyplňte **E-mail** a klepněte na **Poslat odkaz**. Pokud u nás účet ještě nemáte, založí se při prvním přihlášení.",
      },
      {
        name: "Otevřete odkaz z e-mailu",
        text: "Odkaz platí 15 minut a funguje jen v prohlížeči, ve kterém jste o něj požádali. Na stránce **Dokončit přihlášení** klepněte na **Přihlásit se**.",
      },
      {
        name: "Vyplňte firmu",
        text: "Otevře se **Nastavení pokladny**. V prvním kroku **Firma** zadejte IČO a údaje načtěte z ARES – podrobně v článku [Krok Firma](/napoveda/firma-a-ares).",
      },
      {
        name: "Projděte další kroky",
        text: "Postupně **Přihlášení k evidenci v DIS+**, **Evidenční jednotky**, **Pokladní certifikát** a **Režim evidence a testovací tržba**. Hotový krok má místo čísla značku ✓.",
      },
      {
        name: "Zaregistrujte zařízení",
        text: "V kroku **Toto zařízení jako pokladna** klepněte na **Zaregistrovat toto zařízení** a pak na **Otevřít pokladnu**. Obsluhu, katalog a export doplníte, kdykoli budete chtít.",
      },
    ],
    sections: [
      {
        id: "kdyz-odkaz-nefunguje",
        heading: "Když odkaz nefunguje",
        blocks: [
          {
            p: "Hláška „Odkaz vypršel nebo už byl použit. Pošleme nový.“ znamená, že si musíte poslat nový odkaz. Pokud jste odkaz otevřeli v jiném prohlížeči, například přímo v e-mailové aplikaci, zkopírujte ho do prohlížeče, ve kterém jste o přihlášení požádali – nebo si tam pošlete nový.",
          },
          {
            note: "Než budete mít certifikát z DIS+, můžete pokladnu zkoušet v ukázkovém režimu – nic se neodesílá Finanční správě. Viz [Ukázkový režim, Playground a ostrý provoz](/napoveda/rezim-evidence).",
          },
        ],
      },
    ],
    related: ["firma-a-ares", "zarizeni-jako-pokladna", "rezim-evidence"],
    guides: ["jak-aktivovat-dis-a-certifikat", "pokladna-v-mobilu-zdarma"],
    updated: "2026-10-17",
  },
  {
    slug: "firma-a-ares",
    topic: "zaciname",
    title: "Krok Firma: údaje z ARES, záhlaví a patička účtenky",
    description:
      "Jak v nastavení pokladny vyplnit krok Firma: IČO a údaje z ARES, DIČ a EIČ, číslo účtu pro QR platby, plátce DPH, záhlaví a patička účtenky a kód POK.",
    lead: "První krok nastavení se jmenuje **Firma**. Údaje se tisknou na účtenku a DIČ / EIČ je vaše identifikace pro Finanční správu. Většinu z nich pokladna načte z veřejného registru ARES.",
    steps: [
      {
        name: "Zadejte IČO",
        text: "Jakmile napíšete platné osmimístné IČO, pokladna sama hledá v ARES („Hledám v ARES…“). Údaje načtete i tlačítkem **ARES**. Pokud jste přišli z [kontroly IČO](/kontrola-ico), IČO už bude vyplněné.",
      },
      {
        name: "Potvrďte kartu „Je to vaše firma?“",
        text: "Karta ukáže název, sídlo, DIČ a zda jste plátce DPH. Klepněte na **Ano, použít údaje z ARES**, nebo na **Vyplnit ručně**.",
      },
      {
        name: "Doplňte zbytek formuláře",
        text: "**EIČ pro EET** vyplňte, jen pokud se liší od DIČ. **Číslo účtu pro QR platby** zadejte jako 123456789/0100 nebo IBAN. Dále **Vaše jméno v pokladně**, **Záhlaví účtenky** (text nahoře, například otevírací doba) a **Patička účtenky** (text dole, například „Děkujeme za návštěvu!“).",
      },
      {
        name: "Zaškrtněte DPH a POK",
        text: `**Jsem plátce DPH** přidá na účtenku rozpis DPH. **Uvádět na účtence potvrzovací kód (POK)** je předem zaškrtnuté. ${FACTS.confirmation.onReceipt} V pokladně i v exportu POK zůstává vždy.`,
      },
      {
        name: "Uložte",
        text: "U nového účtu souhlaste s obchodními podmínkami a klepněte na **Pokračovat**. Později stejný formulář uložíte tlačítkem **Uložit změny**.",
      },
    ],
    sections: [
      {
        id: "kdyz-ares-nepomuze",
        heading: "Když ARES nepomůže",
        blocks: [
          {
            ul: [
              "„Subjekt s tímto IČO jsme v ARES nenašli. Údaje vyplňte ručně.“ – vyplňte název a DIČ sami.",
              "„Podle ARES tento subjekt zanikl.“ – zkontrolujte, zda je IČO správné.",
              "DIČ i EIČ zadávejte ve tvaru CZ12345678.",
            ],
          },
          {
            p: "EIČ musí být stejné jako v pokladním certifikátu. Když se liší, pokladna změnu neuloží a napíše proč – viz [Nahrání pokladního certifikátu](/napoveda/pokladni-certifikat).",
          },
        ],
      },
    ],
    related: ["prvni-spusteni", "pokladni-certifikat", "qr-platba", "pok-na-uctence"],
    guides: ["koho-se-eet-tyka"],
    updated: "2026-10-17",
  },
  {
    slug: "evidencni-jednotky",
    topic: "zaciname",
    title: "Evidenční jednotky v pokladně",
    description:
      "Jak v pokladně EvidujZdarma přidat evidenční jednotku: typ, název, adresa na účtenku a číslo jednotky z DIS+. Kolik jednotek je zdarma a jak mezi nimi přepínat.",
    lead: `${FACTS.units.summary} V pokladně je zadáte ve třetím kroku nastavení – **Evidenční jednotky**.`,
    steps: [
      {
        name: "Vyberte typ jednotky",
        text: "Na výběr je **Stálá provozovna**, **Mobilní provozovna**, **Automat**, **Internetová stránka**, **Dopravní prostředek** a **Podnikatel bez provozovny (já sám)**.",
      },
      {
        name: "Pojmenujte ji",
        text: "Název slouží vám a obsluze, například „Salon Masarykova“. Adresa se tiskne na účtenku.",
      },
      {
        name: "Doplňte číslo z DIS+",
        text: "Číslo jednotky vám přidělí Finanční správa v DIS+. Pokud ho ještě nemáte, nechte pole prázdné a doplňte ho později v seznamu jednotek tlačítkem **Uložit**.",
      },
      {
        name: "Přidejte jednotku",
        text: "Klepněte na **+ Přidat jednotku**. Jednotka se objeví v seznamu nad formulářem.",
      },
    ],
    sections: [
      {
        id: "vice-jednotek",
        heading: "Více jednotek",
        blocks: [
          {
            p: "V tarifu Zdarma můžete mít až 3 evidenční jednotky. Když jich máte víc, vyberete v záhlaví pokladny tu, kde právě prodáváte. Každé zařízení má výchozí jednotku, kterou zvolíte při jeho registraci.",
          },
          {
            p: `Ostrý provoz zapnete, až budou mít všechny aktivní jednotky číslo z DIS+. ${FACTS.units.allUnits} Které jednotky oznámit, poradí [průvodce evidenčními jednotkami](/evidencni-jednotky).`,
          },
          { p: "Jednotku, kde už neprodáváte, odeberete tlačítkem **Odebrat** – viz [Změny v provozovně](/napoveda/zmeny-v-provozovne)." },
        ],
      },
    ],
    related: ["zmeny-v-provozovne", "rezim-evidence", "zarizeni-jako-pokladna"],
    guides: ["evidencni-jednotka", "jak-aktivovat-dis-a-certifikat"],
    updated: "2026-10-17",
  },
  {
    slug: "pokladni-certifikat",
    topic: "zaciname",
    title: "Nahrání pokladního certifikátu (.p12) a heslo",
    description:
      "Jak nahrát pokladní certifikát z DIS+ do pokladny EvidujZdarma: soubor .p12, heslo, volba prostředí, ověřovací tržba a nejčastější chybové hlášky.",
    lead: "Bez pokladního certifikátu nejde tržbu podepsat a odeslat. Certifikát vygenerujete zdarma v DIS+ a do pokladny ho nahrajete ve čtvrtém kroku nastavení – **Pokladní certifikát**.",
    steps: [
      {
        name: "Vygenerujte certifikát v DIS+",
        text: "Postup najdete v návodu [Jak aktivovat DIS+ a certifikát](/navody/jak-aktivovat-dis-a-certifikat). Uložte si soubor .p12 a heslo, které jste k němu zadali.",
      },
      { name: "Vyberte soubor", text: "V kroku **Pokladní certifikát** zvolte soubor certifikátu. Pokladna přijme soubory .p12 i .pfx." },
      {
        name: "Zadejte heslo",
        text: "Do pole **Heslo k certifikátu** napište heslo z DIS+. Prostředí nechte na **Rozpoznat podle certifikátu**, nebo zvolte **Ostrý certifikát (z DIS+)** či **Testovací certifikát (Playground)**.",
      },
      {
        name: "Nahrajte ho",
        text: "Klepněte na **Nahrát certifikát**. Pokud jste se přihlásili před více než 15 minutami, pokladna vás požádá o nové přihlášení – klepněte na **Poslat přihlašovací odkaz**.",
      },
      {
        name: "Ověřte spojení",
        text: "U ostrého certifikátu uvidíte „zatím neověřeno“. Klepněte na **Odeslat ověřovací tržbu** – viz [režim evidence](/napoveda/rezim-evidence).",
      },
    ],
    sections: [
      {
        id: "co-s-certifikatem-delame",
        heading: "Co s certifikátem děláme",
        blocks: [
          {
            p: "Privátní klíč ukládáme šifrovaně na serverech v EU a dešifrujeme ho jen v paměti při odeslání tržby. Heslo k certifikátu neukládáme. Po nahrání pošleme vlastníkům účtu upozornění e-mailem. Účet, který ještě nemá EIČ, ho převezme z certifikátu.",
          },
        ],
      },
      {
        id: "caste-chyby",
        heading: "Časté chyby",
        blocks: [
          {
            ul: [
              "„Certifikát patří EIČ …, ale u účtu je …“ – EIČ v kroku Firma musí být stejné jako v certifikátu.",
              "„Certifikát už není platný. Vygenerujte nový v DIS+.“",
              "„Certifikát je z testovacího prostředí EET. Pro ostrý provoz si vygenerujte certifikát v produkčním DIS+.“",
            ],
          },
        ],
      },
    ],
    related: ["platnost-certifikatu", "rezim-evidence", "bezpecnost"],
    guides: ["jak-aktivovat-dis-a-certifikat"],
    updated: "2026-10-17",
  },
  {
    slug: "rezim-evidence",
    topic: "zaciname",
    title: "Ukázkový režim, Playground a ostrý provoz",
    description:
      "Tři režimy evidence v pokladně EvidujZdarma: ukázkový bez odesílání, testovací Playground Finanční správy a ostrý provoz. Co potřebujete a jak přepnout.",
    lead: `Pokladna má tři režimy evidence. Zvolíte je v pátém kroku nastavení – **Režim evidence a testovací tržba**. Naostro se eviduje od ${FACTS.law.effectiveFrom}; do té doby si pokladnu můžete vyzkoušet.`,
    sections: [
      {
        id: "tri-rezimy",
        heading: "Tři režimy",
        blocks: [
          {
            table: {
              head: ["Režim", "Co dělá", "Štítek v záhlaví pokladny"],
              rows: [
                ["**Ukázkový režim**", "Vyzkoušíte si pokladnu. Nic se neodesílá Finanční správě.", "UKÁZKOVÝ REŽIM"],
                ["**Testovací prostředí FS**", "Odesílá na Playground Finanční správy. Potřebuje testovací certifikát.", "TEST FS (Playground)"],
                ["**Ostrý provoz**", "Tržby se evidují u Finanční správy. Potřebuje certifikát z DIS+ a čísla jednotek.", "OSTRÝ PROVOZ"],
              ],
            },
          },
          { p: "Účtenka z ukázkového režimu i z Playgroundu má řádek „TESTOVACÍ REŽIM – NEPLATNÝ DOKLAD“." },
        ],
      },
      {
        id: "prepnuti",
        heading: "Přepnutí s neodeslanými tržbami",
        blocks: [
          {
            p: "Pokud některé tržby ještě nejsou vyřízené, pokladna je vypíše a zeptá se, zda režim přepnout. Odešlou se v režimu, ve kterém vznikly. Po přepnutí si pokladna načte nové nastavení; do té doby ukazuje „Účet změnil režim evidence…“ a neprodává.",
          },
        ],
      },
    ],
    stepsHeading: "Jak zapnout ostrý provoz",
    stepsAt: 1,
    steps: [
      { name: "Nahrajte ostrý certifikát", text: "V kroku **Pokladní certifikát** – viz [Nahrání certifikátu](/napoveda/pokladni-certifikat). EIČ musí být vyplněné." },
      { name: "Doplňte čísla jednotek", text: "Všechny aktivní evidenční jednotky musí mít číslo přidělené Finanční správou." },
      {
        name: "Odešlete ověřovací tržbu",
        text: "Klepněte na **Odeslat ověřovací tržbu**. Finanční správa zprávu zkontroluje, ale tržbu neeviduje. Máte-li víc evidenčních jednotek, vyberte v poli **Za evidenční jednotku** jednu z nich, nebo **Všechny jednotky** – pokladna pak ověří každou zvlášť a ukáže výsledek u každé.",
      },
      {
        name: "Přepněte na Ostrý provoz",
        text: "Klepněte na **Ostrý provoz**. Krok vyžaduje přihlášení ne starší než 15 minut, jinak pokladna nabídne **Poslat přihlašovací odkaz**. Dokud ostré prostředí Finanční správy tržby nepřijímá, pokladna přepnutí odmítne a napíše, od kdy to jde.",
      },
    ],
    related: ["pokladni-certifikat", "evidencni-jednotky", "stav-trzby"],
    guides: ["jak-aktivovat-dis-a-certifikat", "eet-2-0-kompletni-pruvodce"],
    updated: "2026-10-17",
  },
  {
    slug: "zarizeni-jako-pokladna",
    topic: "zaciname",
    title: "Jak z mobilu nebo tabletu udělat pokladnu",
    description:
      "Registrace zařízení v pokladně EvidujZdarma: název, označení pokladny a výchozí jednotka. Proč přidat pokladnu na plochu a jak zacházet s daty v zařízení.",
    lead: "Pokladnou se stane mobil, tablet nebo počítač s prohlížečem, který zaregistrujete v šestém kroku nastavení – **Toto zařízení jako pokladna**. Zařízení dostane vlastní klíč a pokladní se pak přihlašují jen PINem, i bez internetu.",
    steps: [
      {
        name: "Přihlaste se na tomto zařízení",
        text: "Otevřete **Nastavení pokladny** v prohlížeči zařízení, které bude pokladnou. Registrace platí pro tento prohlížeč.",
      },
      {
        name: "Vyplňte údaje",
        text: "Název zařízení (předvyplněno „Pokladna“), označení pokladny (například P1, nejvýš 20 znaků) a výchozí evidenční jednotku. Bez jednotky to nejde: „Nejdřív přidejte evidenční jednotku.“",
      },
      {
        name: "Zaregistrujte ho",
        text: "Klepněte na **Zaregistrovat toto zařízení**. Pokladna potvrdí „Toto zařízení je pokladna P1“ a nabídne **Otevřít pokladnu →**.",
      },
      { name: "Přidejte pokladnu na plochu", text: "V nabídce prohlížeče zvolte **Instalovat aplikaci** nebo **Přidat na plochu**. Pokladna se pak otevírá jako aplikace." },
    ],
    sections: [
      {
        id: "data-v-zarizeni",
        heading: "Tržby jsou nejdřív v zařízení",
        blocks: [
          {
            p: "Každá tržba se uloží v zařízení dřív, než se odešle. Pokud prohlížeč nepotvrdí trvalé uložení dat, pokladna vás upozorní – při nedostatku místa by mohl smazat tržby, které ještě nedošly na server. Proto pokladnu přidejte na plochu a nechávejte zařízení často online. Data prohlížeče nemažte, dokud nejsou všechny tržby potvrzené.",
          },
          { p: "Po registraci pošleme vlastníkům e-mail o nové pokladně. Další zařízení přidáte stejně – viz [Více pokladen](/napoveda/vice-zarizeni)." },
        ],
      },
    ],
    related: ["vice-zarizeni", "pokladni-a-pin", "prodej-bez-signalu"],
    guides: ["pokladna-v-mobilu-zdarma"],
    updated: "2026-10-17",
  },
];
