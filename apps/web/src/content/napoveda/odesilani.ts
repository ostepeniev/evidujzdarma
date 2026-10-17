import { FACTS } from "../facts";
import type { HelpArticle } from "./types";

/**
 * Odesílání tržeb a vratky: lib/pos/sync.ts (automatická synchronizace), components/pos/status-bar.tsx, receipt-view.tsx,
 * ui.tsx (štítky stavů), setup-app.tsx (Neodeslané tržby, Tržby k vyřízení, Upozornění FS), owner-approval.tsx,
 * lib/pos/sale-factory.ts a lib/server/sales.ts (pravidla vratky), lib/server/reminders.ts (e-maily).
 */
export const ODESILANI: readonly HelpArticle[] = [
  {
    slug: "prodej-bez-signalu",
    topic: "odesilani",
    title: "Prodej bez signálu a lhůta 48 hodin",
    description:
      "Jak pokladna EvidujZdarma prodává bez internetu: tržby se uloží v zařízení, odešlou se samy po připojení a pokladna hlídá lhůtu 48 hodin pro dodatečné odeslání.",
    lead: `${FACTS.offline.summary} Pokladna každou tržbu nejdřív uloží v zařízení, takže výpadek signálu prodej nezastaví.`,
    stepsHeading: "Co dělat",
    stepsAt: 1,
    sections: [
      {
        id: "co-uvidite",
        heading: "Co uvidíte",
        blocks: [
          {
            ul: [
              "V záhlaví místo **Online** svítí **Offline**. Čekající tržby přibudou i s časem do konce lhůty, například „· 3 čeká (46 h 12 min)“.",
              "Na účtence: „Jste offline – tržba je uložená a odešle se sama.“ a „Lhůta: …“.",
              "Po lhůtě: „Lhůta 48 hodin uplynula – připojte zařízení k internetu, tržba se odešle hned, jak to půjde.“",
            ],
          },
        ],
      },
      {
        id: "co-nejde",
        heading: "Co bez signálu nejde",
        blocks: [
          {
            ul: [
              "Vratka – PIN vlastníka se ověřuje online.",
              "Účtenka e-mailem a online účtenka přes QR kód.",
              "Přihlášení vlastníka PINem – bez signálu se přihlaste jako pokladní.",
            ],
          },
          {
            note: "Dokud nejsou všechny tržby potvrzené, nemažte data prohlížeče ani pokladnu neodinstalujte. Pokud tržba došla na server, ale Finanční správě se ji nedaří odeslat, pošleme vlastníkovi e-mail, když se blíží konec lhůty.",
          },
        ],
      },
    ],
    steps: [
      { name: "Prodávejte dál", text: "Prodej, platba a tisk fungují bez připojení. PIN pokladní ověří zařízení samo." },
      {
        name: "Připojte se",
        text: "Jakmile je signál, pokladna tržby odešle sama – po připojení, při návratu do aplikace a každých 20 sekund. Ručně synchronizaci spustíte klepnutím na štítek **Online** / **Offline**.",
      },
      { name: "Zkontrolujte přehled", text: "V **Přehled** má být „Všechny tržby jsou potvrzené.“" },
    ],
    related: ["stav-trzby", "odmitnuta-trzba", "zarizeni-jako-pokladna"],
    guides: ["eet-bez-internetu"],
    updated: "2026-10-17",
  },
  {
    slug: "stav-trzby",
    topic: "odesilani",
    title: "Co znamená stav tržby v pokladně",
    description:
      "Přehled stavů tržby v pokladně EvidujZdarma: čeká na odeslání, odesílá se do FS, opakujeme odeslání, potvrzeno (POK), odmítnuto a neeviduje se.",
    lead: "U každé tržby v **Historie** a na obrazovce účtenky je barevný štítek se stavem. Říká, kde tržba právě je – v zařízení, na serveru, nebo už u Finanční správy.",
    sections: [
      {
        id: "stavy",
        heading: "Stavy tržby",
        blocks: [
          {
            table: {
              head: ["Štítek", "Co znamená", "Co udělat"],
              rows: [
                ["**Čeká na odeslání**", "Tržba je uložená v zařízení a ještě nedošla na server.", "Nic, odešle se sama. Bez signálu hlídejte lhůtu 48 hodin."],
                ["**Odesílá se do FS**", "Server tržbu má a posílá ji Finanční správě.", "Nic."],
                ["**Opakujeme odeslání**", "Pokus se nepovedl, zkoušíme to znovu.", "Nic, pokladna to zkouší sama."],
                ["**Potvrzeno (POK)**", "Finanční správa tržbu přijala a vrátila POK.", "Hotovo."],
                ["**Odmítnuto**", "Finanční správa nebo náš server tržbu nepřijaly.", "Vyřiďte ji – viz [Odmítnutá tržba](/napoveda/odmitnuta-trzba)."],
                ["**Neeviduje se**", "Tržba nemá evidovanou platbu, například je celá zaplacená dárkovým poukazem.", "Nic."],
                ["**Ukázka – bez FS**", "Tržba z ukázkového režimu, Finanční správě se neposílá.", "Nic."],
              ],
            },
          },
        ],
      },
      {
        id: "zahlavi",
        heading: "Souhrn v záhlaví",
        blocks: [
          {
            p: "Štítek **Online** / **Offline** v záhlaví ukazuje i počet čekajících tržeb a čas do konce lhůty. Když zbývají méně než 2 hodiny, zčervená. Červené tlačítko „… odmítnuto“ otevře historii.",
          },
        ],
      },
    ],
    related: ["odmitnuta-trzba", "prodej-bez-signalu", "pok-na-uctence"],
    guides: ["eet-bez-internetu"],
    updated: "2026-10-17",
  },
  {
    slug: "odmitnuta-trzba",
    topic: "odesilani",
    title: "Odmítnutá nebo neodeslaná tržba: co dělat",
    description:
      "Co dělat, když Finanční správa tržbu odmítne nebo ji pokladna nemůže odeslat: kde najdete důvod, jak opravit údaje a odeslat tržbu znovu do 48 hodin.",
    lead: "Odmítnutá tržba se neztratí – je uložená a čeká na vás. Peníze jste přijali, jen tržba ještě není evidovaná. Opravte příčinu a odešlete ji znovu; lhůta je 48 hodin od prodeje.",
    steps: [
      {
        name: "Najděte tržbu",
        text: "V záhlaví pokladny klepněte na červené „… odmítnuto“ – otevře se **Historie**. Na odmítnuté tržby upozorní i **Přehled** a denní e-mail „Některé tržby čekají na vaše rozhodnutí“.",
      },
      { name: "Přečtěte si důvod", text: "Na obrazovce účtenky je důvod červeně. Nejčastěji jde o certifikát, EIČ nebo číslo evidenční jednotky." },
      { name: "Opravte údaje", text: "Chybu opravte v **Nastavení pokladny** – v kroku Firma, Evidenční jednotky nebo Pokladní certifikát." },
      {
        name: "Odešlete znovu",
        text: "V nastavení v oddílu **Neodeslané tržby** klepněte na **Odeslat znovu**, **Odeslat znovu vše**, nebo **Odeslat s opravenými údaji**. Tržba, kterou server ještě nemá, má tlačítko **Odeslat znovu** přímo na účtence.",
      },
    ],
    sections: [
      {
        id: "opravene-udaje",
        heading: "Odeslat s opravenými údaji",
        blocks: [{ p: "Tržba se odešle s EIČ a číslem evidenční jednotky, které máte teď v nastavení. Pořadové číslo, čas i částka zůstanou." }],
      },
      {
        id: "trzby-k-vyrizeni",
        heading: "Tržby k vyřízení",
        blocks: [
          {
            p: "Tržby, které pokladna poslala, ale server je nemohl přijmout, jsou v nastavení v oddílu **Tržby k vyřízení**. Dokud je nevyřídíte, Finanční správě se neodešlou. Podle důvodu pokladna nabídne **Zkusit znovu přijmout**, **Použít čas přijetí**, odeslání v aktuálním režimu, nebo **Byla to zkouška**. Tlačítkem **Vyřízeno ručně** tržbu uzavřete s poznámkou, jak jste ji vyřídili.",
          },
        ],
      },
      {
        id: "upozorneni-fs",
        heading: "Upozornění Finanční správy",
        blocks: [
          {
            p: "Tržby v oddílu **Upozornění Finanční správy** jsou přijaté, ale Finanční správa k nim připojila upozornění. Zkontrolujte EIČ a čas v pokladně, ať se to neopakuje.",
          },
        ],
      },
    ],
    related: ["stav-trzby", "pokladni-certifikat", "zmeny-v-provozovne"],
    guides: ["eet-bez-internetu", "pokuty-eet"],
    updated: "2026-10-17",
  },
  {
    slug: "vratka",
    topic: "odesilani",
    title: "Vratka a storno: vrácení peněz zákazníkovi",
    description:
      "Jak v pokladně EvidujZdarma vrátit zákazníkovi peníze: vratka k původní tržbě se schválením vlastníka, záporná tržba a co udělat ještě před zaplacením.",
    lead: "Zaplacenou tržbu nejde smazat ani stornovat. Peníze vrátíte **vratkou** – novou tržbou se zápornou částkou, která odkazuje na původní prodej. Dokud zákazník nezaplatil, stačí tlačítko **Zrušit účet**.",
    steps: [
      { name: "Otevřete původní tržbu", text: "V **Historie** klepněte na prodej, ke kterému vracíte peníze." },
      { name: "Klepněte na Vratka", text: "Tlačítko **Vratka** je pod účtenkou, vedle **Nová tržba**." },
      {
        name: "Nechte vratku schválit",
        text: "Otevře se **Vratku schvaluje vlastník**. Vlastník zadá svůj PIN (6–8 číslic). PIN se ověří online, proto je potřeba internet.",
      },
      {
        name: "Vraťte peníze",
        text: "Okno **Vrácení peněz** ukáže částku a způsoby platby. Vrací se stejnými způsoby a ve stejném poměru, jakým zákazník platil; hotovost, kartu, QR platbu a stravenku lze mezi sebou zaměnit. Potvrďte **Potvrdit vrácení**.",
      },
      { name: "Předejte doklad", text: "Vratka má vlastní účtenku s nadpisem „VRATKA / OPRAVNÝ DOKLAD“. Odešle se Finanční správě jako každá tržba." },
    ],
    sections: [
      {
        id: "kdy-vratka-nejde",
        heading: "Kdy vratka nejde",
        blocks: [
          {
            ul: [
              "K jedné tržbě je nejvýš jedna vratka a vrací se celý nákup – částečnou vratku pokladna zatím neumí.",
              "Vratku uděláte na zařízení, na kterém se prodávalo, u tržeb z posledních 7 dní (tolik ukazuje Historie).",
              "K odmítnuté tržbě vratka není.",
              "K tržbě z jiného režimu evidence ji pokladna neodešle: „Původní prodej proběhl … Vratku k němu pokladna neodešle.“",
              "Spropitné se nevrací.",
            ],
          },
        ],
      },
    ],
    related: ["pokladni-a-pin", "stav-trzby", "rozdelena-platba"],
    guides: ["storno-a-vraceni-eet"],
    updated: "2026-10-17",
  },
];
