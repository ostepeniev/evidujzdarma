import { FACTS } from "../facts";
import type { HelpArticle } from "./types";

/**
 * Účtenky: components/pos/receipt-view.tsx (Tisk, Bluetooth, E-mail, QR účtenka), lib/pos/escpos.ts,
 * app/api/pokladna/uctenka (podmínky a limity e-mailu), app/(app)/u/[id] (online účtenka), renderReceiptText.
 */
export const UCTENKY: readonly HelpArticle[] = [
  {
    slug: "tisk-uctenky",
    topic: "uctenky",
    title: "Tisk účtenky a Bluetooth tiskárna",
    description:
      "Jak v pokladně EvidujZdarma vytisknout účtenku na tiskárně nebo do PDF, jak tisknout na Bluetooth termotiskárnu a které údaje na účtence najdete.",
    lead: "Po zaplacení pokladna ukáže účtenku a tlačítka **Tisk**, **E-mail** a **QR účtenka**. V prohlížeči, který umí Bluetooth, přibude tlačítko **Bluetooth** pro termotiskárnu.",
    steps: [
      { name: "Tisk z prohlížeče", text: "Klepněte na **Tisk**. Otevře se tisk prohlížeče – vyberte tiskárnu, nebo uložení do PDF." },
      {
        name: "Tisk na termotiskárnu",
        text: "Klepněte na **Bluetooth** a v seznamu zařízení vyberte tiskárnu. Po vytištění pokladna napíše „Vytištěno.“ Tlačítko uvidíte jen v prohlížeči s podporou Web Bluetooth, typicky v Chromu na Androidu.",
      },
      { name: "Tisk později", text: "Účtenky z posledních 7 dní najdete v **Historie** – klepněte na tržbu a pak na **Tisk**." },
    ],
    sections: [
      {
        id: "bluetooth",
        heading: "Bluetooth tiskárny",
        blocks: [
          {
            p: "Pokladna tiskne na termotiskárny ESC/POS přes Bluetooth LE, na šířku 32 znaků. Text posílá bez diakritiky, aby byl čitelný na každém modelu. Když tiskárna Bluetooth LE nepodporuje, uvidíte „Tiskárna nepodporuje tisk přes Bluetooth LE.“",
          },
        ],
      },
      {
        id: "co-je-na-uctence",
        heading: "Co je na účtence",
        blocks: [
          {
            p: "Název firmy, adresa evidenční jednotky, IČO a DIČ, záhlaví, položky, sleva, celková částka a způsoby platby, u plátce DPH rozpis DPH, datum, číslo jednotky, označení pokladny, číslo dokladu, POK, patička a odkaz na online účtenku.",
          },
          { p: `${FACTS.receipt.summary} Více v návodu [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)` },
        ],
      },
    ],
    related: ["uctenka-emailem-a-qr", "pok-na-uctence", "firma-a-ares"],
    guides: ["musim-vydavat-uctenku"],
    updated: "2026-10-17",
  },
  {
    slug: "uctenka-emailem-a-qr",
    topic: "uctenky",
    title: "Účtenka e-mailem a QR kódem",
    description:
      "Jak poslat zákazníkovi účtenku e-mailem nebo ji ukázat jako QR kód z pokladny EvidujZdarma, co k tomu pokladna potřebuje a jaké platí limity odesílání.",
    lead: "Papír nepotřebujete. Účtenku můžete zákazníkovi poslat e-mailem, nebo mu ukázat QR kód s odkazem na online účtenku, kterou si uloží do telefonu.",
    steps: [
      {
        name: "Účtenka e-mailem",
        text: "Na obrazovce účtenky klepněte na **E-mail**, vyplňte **E-mail zákazníka** a klepněte na **Odeslat účtenku**. Po odeslání uvidíte „Účtenka odeslána e-mailem.“",
      },
      { name: "Účtenka QR kódem", text: "Klepněte na **QR účtenka**. Zákazník naskenuje kód fotoaparátem a účtenku si uloží." },
    ],
    sections: [
      {
        id: "co-je-potreba",
        heading: "Co je potřeba",
        blocks: [
          {
            ul: [
              "Připojení k internetu – tržba musí být na serveru. Bez signálu pokladna u QR kódu napíše „Účtenka bude online, jakmile se pokladna připojí k internetu.“",
              "Zákazníkovi lze účtenku poslat jen v ostrém provozu s pokladním certifikátem vydaným na EIČ vaší firmy.",
              "V ukázkovém režimu a na Playgroundu jde účtenka poslat jen na e-mail vlastníka účtu – hodí se na vyzkoušení.",
            ],
          },
        ],
      },
      {
        id: "limity",
        heading: "Limity a soukromí",
        blocks: [
          {
            p: "Na jednu adresu odejde nejvýš 5 účtenek za den, z jednoho účtu nejvýš 60 za hodinu. E-mail zákazníka použijeme jen k doručení účtenky.",
          },
          { p: "Online účtenka ukazuje stejné údaje jako papírová; u vratky má nadpis „Vratka / opravný doklad“." },
        ],
      },
    ],
    related: ["tisk-uctenky", "pok-na-uctence", "rezim-evidence"],
    guides: ["musim-vydavat-uctenku"],
    updated: "2026-10-17",
  },
  {
    slug: "pok-na-uctence",
    topic: "uctenky",
    title: "Potvrzovací kód POK na účtence",
    description:
      "Co je potvrzovací kód POK, kde ho v pokladně EvidujZdarma najdete, proč na účtence z výpadku signálu chybí a jak jeho tisk na účtence vypnout.",
    lead: `${FACTS.confirmation.summary} Pokladna ho uloží k tržbě a ukáže pod částkou na obrazovce účtenky.`,
    sections: [
      {
        id: "kde-pok-najdete",
        heading: "Kde POK najdete",
        blocks: [
          {
            ul: [
              "Na obrazovce účtenky: stav **Potvrzeno (POK)** a pod ním kód.",
              "Na tištěné i online účtence v řádku „POK“.",
              "V exportu tržeb ve sloupci „POK“.",
              "V ukázkovém režimu POK není – stav ukazuje „Ukázka – bez FS“.",
            ],
          },
        ],
      },
      {
        id: "uctenka-bez-pok",
        heading: "Účtenka bez POK",
        blocks: [
          {
            p: "Pokud jste prodávali bez signálu, POK ještě nemáte a vytištěná účtenka ho neobsahuje. Kód pokladna doplní, jakmile tržbu odešle. Zákazník ho uvidí na online účtence ([QR účtenka](/napoveda/uctenka-emailem-a-qr)); do té doby je tam „Tržba čeká na potvrzení Finanční správou.“",
          },
        ],
      },
      {
        id: "vypnuti",
        heading: "Vypnutí POK na účtence",
        blocks: [
          {
            p: `V kroku **Firma** odškrtněte **Uvádět na účtence potvrzovací kód (POK)** a uložte. ${FACTS.confirmation.onReceipt} V pokladně i v exportu POK zůstává vždy.`,
          },
        ],
      },
    ],
    related: ["stav-trzby", "prodej-bez-signalu", "firma-a-ares"],
    guides: ["glosar-eet"],
    updated: "2026-10-17",
  },
];
