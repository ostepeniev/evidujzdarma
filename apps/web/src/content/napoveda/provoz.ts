import type { HelpArticle } from "./types";

/**
 * Přehled, uzávěrka, obsluha a zařízení: components/pos/history-view.tsx (Historie, Přehled, CSV dne), cash-panel.tsx
 * (vklad, výběr, denní uzávěrka), pin-lock.tsx, lib/pos/pin-attempts.ts, pos-app.tsx (zamykání), setup-app.tsx
 * (Obsluha a PINy, Toto zařízení jako pokladna, Odpojit).
 */
export const PROVOZ: readonly HelpArticle[] = [
  {
    slug: "denni-prehled",
    topic: "hotovost",
    title: "Denní přehled tržeb a historie",
    description:
      "Co ukazuje Přehled a Historie v pokladně EvidujZdarma: dnešní tržby podle způsobu platby, spropitné, vratky, čekající tržby a stažení dnešních tržeb do CSV.",
    lead: "Obrazovka **Přehled** shrne dnešní den: kolik jste utržili, jakými způsoby platby a zda jsou všechny tržby potvrzené. **Historie** ukáže jednotlivé tržby za posledních 7 dní.",
    sections: [
      {
        id: "prehled",
        heading: "Přehled",
        blocks: [
          {
            ul: [
              "**Dnešní tržby** – počet a celková částka.",
              "Částky podle způsobu platby: vždy Hotovost, Karta a QR platba, ostatní způsoby jen tehdy, když jimi dnes někdo platil.",
              "Spropitné a vratky za den.",
              "Odmítnuté tržby: „Z toho odmítnuto …“ – nejsou evidované v EET, vyřiďte je.",
              "Rámeček „… tržeb čeká na potvrzení (POK)“, nebo „Všechny tržby jsou potvrzené.“",
            ],
          },
          { p: "Nahoře v Přehledu je hotovost v pokladně a tlačítko **Denní uzávěrka** – viz [Denní uzávěrka](/napoveda/denni-uzaverka)." },
        ],
      },
      {
        id: "historie",
        heading: "Historie",
        blocks: [
          {
            p: "Tržby jsou seřazené po dnech. U každé vidíte čas, položky, číslo dokladu, způsob platby, jméno pokladní, částku a stav. Klepnutím otevřete účtenku – můžete ji vytisknout, poslat, nebo k ní udělat vratku.",
          },
        ],
      },
      {
        id: "csv-dne",
        heading: "Dnešní tržby do CSV",
        blocks: [
          {
            p: "Tlačítko **Stáhnout dnešní tržby (CSV)** uloží dnešní tržby z tohoto zařízení. Přehled za libovolné období a export pro účetní najdete v nastavení – viz [Export pro účetní](/napoveda/export-pro-ucetni).",
          },
          { note: "Přehled i Historie počítají tržby uložené v tomto zařízení. Tržby ze všech pokladen najdete v exportu v nastavení." },
        ],
      },
    ],
    related: ["denni-uzaverka", "stav-trzby", "export-pro-ucetni"],
    updated: "2026-10-17",
  },
  {
    slug: "denni-uzaverka",
    topic: "hotovost",
    title: "Denní uzávěrka, vklad a výběr hotovosti",
    description:
      "Jak v pokladně EvidujZdarma udělat denní uzávěrku: počáteční stav, spočítaná hotovost po bankovkách a mincích, manko či přebytek, odvod, vklady a výběry.",
    lead: "Uzávěrka porovná, kolik hotovosti má v pokladně být, s tím, kolik jste spočítali. Najdete ji nahoře v **Přehled** v panelu **Hotovost v pokladně (očekáváno)**.",
    steps: [
      {
        name: "Zapisujte vklady a výběry",
        text: "Během dne klepněte na **+ Vklad** nebo **− Výběr**, zadejte částku a důvod, například „Drobné na vracení“ nebo „Odvod do banky“, a uložte. Vklad a výběr nejsou tržby – Finanční správě se neposílají.",
      },
      {
        name: "Otevřete uzávěrku",
        text: "Klepněte na **Denní uzávěrka**. Pokladna ukáže tržby, vratky, částky podle způsobu platby a řádek **= Má být v pokladně**.",
      },
      {
        name: "Zadejte počáteční stav",
        text: "Jen u první uzávěrky napište, kolik hotovosti bylo v pokladně ráno. Příště ho pokladna převezme ze zůstatku poslední uzávěrky.",
      },
      {
        name: "Spočítejte hotovost",
        text: "Do pole **Spočítaná hotovost** napište částku, nebo zvolte **Spočítat po bankovkách a mincích**. Pokladna ukáže „Sedí na korunu.“, manko, nebo přebytek.",
      },
      {
        name: "Uzavřete pokladnu",
        text: "Vyplňte **Odvod – vyberu z pokladny**, při rozdílu i **Poznámka**, a klepněte na **Uzavřít pokladnu**. Uzávěrku pak můžete vytisknout.",
      },
    ],
    sections: [
      {
        id: "dobre-vedet",
        heading: "Dobré vědět",
        blocks: [
          {
            ul: [
              "Uzávěrku uděláte i bez signálu; na server se odešle při synchronizaci.",
              "Čekající tržby uzávěrku neblokují – odešlou se samy, jakmile bude spojení.",
              "Posledních pět uzávěrek je v Přehledu, všechny uzávěrky ze všech pokladen v nastavení – viz [Export a pokladní kniha](/napoveda/export-pro-ucetni).",
            ],
          },
        ],
      },
    ],
    related: ["denni-prehled", "export-pro-ucetni", "tisk-uctenky"],
    updated: "2026-10-17",
  },
  {
    slug: "pokladni-a-pin",
    topic: "obsluha",
    title: "Pokladní, vlastník a PIN",
    description:
      "Jak v pokladně EvidujZdarma přidat pokladní a nastavit PIN, proč má vlastník PIN se 6 až 8 číslicemi, jak funguje zamykání a co dělat po chybném PINu.",
    lead: "Každý, kdo prodává, má v pokladně svůj profil a PIN. U každé tržby se pak uloží, kdo ji udělal. Zdarma můžete mít až 5 uživatelů.",
    steps: [
      {
        name: "Přidejte pokladní",
        text: "V **Nastavení pokladny**, v kroku **Obsluha a PINy**, vyplňte **Jméno pokladní** a **PIN** (4–8 číslic) a klepněte na **+ Přidat**.",
      },
      { name: "Nastavte PIN vlastníkovi", text: "U vlastníka zadejte PIN se 6–8 číslicemi a klepněte na **Nastavit**. Bez něj nejde schválit vratku." },
      { name: "Přihlaste se v pokladně", text: "Pokladna se zeptá „Kdo bude prodávat?“. Klepněte na své jméno, naťukejte PIN a klepněte na **OK**." },
      {
        name: "Zamykejte",
        text: "Ikonou zámku 🔒 vedle jména pokladnu zamknete. Když ji znovu otevřete po víc než 15 minutách bez práce, zeptá se na PIN znovu; vlastník ho zadává po každém otevření.",
      },
    ],
    sections: [
      {
        id: "pin-pokladni-a-vlastnika",
        heading: "PIN pokladní a PIN vlastníka",
        blocks: [
          {
            p: "PIN pokladní ověřuje zařízení, takže se pokladní přihlásí i bez signálu. Po dvou chybných pokusech roste prodleva: 30 sekund, 1 minuta, 2 minuty… nejvýš hodina. PIN vlastníka se ověřuje online – bez signálu se přihlaste jako pokladní.",
          },
        ],
      },
      {
        id: "zmena",
        heading: "Změna a odebrání",
        blocks: [
          {
            p: "Nový PIN zadáte v řádku uživatele a potvrdíte **Nastavit**. Pokladní, která u vás už nepracuje, odeberete tlačítkem **Odebrat**. Má-li účet jediného uživatele bez PINu, pokladna se otevře rovnou, bez přihlášení.",
          },
        ],
      },
    ],
    related: ["vratka", "bezpecnost", "vice-zarizeni"],
    updated: "2026-10-17",
  },
  {
    slug: "vice-zarizeni",
    topic: "obsluha",
    title: "Více pokladen a odpojení zařízení",
    description:
      "Jak v EvidujZdarma používat víc pokladen najednou: registrace dalšího zařízení, označení P1 a P2, vlastní řada dokladů a odpojení ztraceného zařízení.",
    lead: "Prodáváte na víc místech nebo u víc pultů? Zaregistrujte každé zařízení jako samostatnou pokladnu. Všechny patří k jednomu účtu a sdílejí katalog, obsluhu i certifikát.",
    steps: [
      { name: "Přihlaste se na novém zařízení", text: "Otevřete na něm **Nastavení pokladny** a přihlaste se e-mailem vlastníka." },
      {
        name: "Zvolte jiné označení",
        text: "V kroku **Toto zařízení jako pokladna** dejte zařízení vlastní označení – první je P1, další P2. Stejné označení dvakrát nejde: „Pokladna s tímto označením už existuje. Zvolte jiné označení.“",
      },
      {
        name: "Zaregistrujte ho",
        text: "Klepněte na **Zaregistrovat toto zařízení**. Pak se můžete v nastavení odhlásit tlačítkem **Odhlásit** – pokladna funguje dál a obsluha se přihlašuje PINem.",
      },
    ],
    sections: [
      {
        id: "seznam-pokladen",
        heading: "Seznam pokladen",
        blocks: [
          {
            p: "V kroku 6 vidíte všechny pokladny s označením, názvem a časem posledního použití („naposledy …“, nebo „zatím nepoužito“). Každá pokladna má vlastní řadu čísel dokladů, takže se čísla nikdy neopakují.",
          },
        ],
      },
      {
        id: "odpojeni",
        heading: "Ztracené nebo vyřazené zařízení",
        blocks: [
          {
            p: "U pokladny klepněte na **Odpojit** a potvrďte. Zařízení se přestane synchronizovat a ukáže „Toto zařízení bylo odpojeno“. Tržby, které v něm zůstaly, se odešlou až po nové registraci. Když přijde e-mail o nové pokladně, kterou jste nepřidali, odpojte ji a změňte PIN vlastníka.",
          },
        ],
      },
    ],
    related: ["zarizeni-jako-pokladna", "pokladni-a-pin", "bezpecnost"],
    updated: "2026-10-17",
  },
];
