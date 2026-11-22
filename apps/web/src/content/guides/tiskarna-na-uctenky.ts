import { FACTS, SOURCES } from "../facts";
import type { Guide } from "./types";
import { REVIEWER } from "@/lib/site";

/**
 * S12 (22. 11. 2026): „tiskárna na účtenky“ (GSC, pozice ~10). Technický návod bez doporučení značek: zda je tiskárna
 * kvůli EET 2.0 potřeba (FACTS.receipt, FACTS.confirmation – revidované znění), co v prohlížeči (PWA) funguje přes
 * Web Bluetooth a co přes systémový tisk. Funkce pokladny jen podle kódu: lib/pos/escpos.ts (ESC/POS přes Bluetooth LE,
 * 32 znaků, bez diakritiky), components/pos/receipt-view.tsx a cash-panel.tsx (Tisk = tisk prohlížeče, Bluetooth).
 * Revize Heleny Jeřábkové 22. 11. 2026 → indexovatelný, v sitemap, llms.txt i MCP (Ф8, Ф12).
 */
export const tiskarnaNaUctenky: Guide = {
  slug: "tiskarna-na-uctenky",
  category: "prakticke",
  title: "Tiskárna na účtenky pro EET 2.0: potřebujete ji?",
  h1: "Tiskárna na účtenky pro EET 2.0: kdy ji potřebujete a co funguje v prohlížeči",
  description:
    "Musíte kvůli EET 2.0 kupovat tiskárnu účtenek? Kdy stačí e-mail nebo QR kód, jak tisknout z mobilu přes Bluetooth LE, co umí USB a na co se dívat před koupí.",
  lead:
    "Kvůli EET 2.0 tiskárnu kupovat nemusíte: od **1. 1. 2027** se tržba odesílá Finanční správě a účtenku zákon nepřikazuje. Když o doklad zákazník požádá, můžete ho podle běžného výkladu vydat i e-mailem nebo jako QR kód. Tiskárna se vyplatí tam, kde lidé papír chtějí často.",
  summary: [
    "EET 2.0 účtenku nepřikazuje; doklad vydáváte na žádost zákazníka, papírový nebo elektronický.",
    "POK na dokladu uvádět nemusíte – podle Finanční správy je to dobrovolné.",
    "Z pokladny v prohlížeči tisknete na termotiskárnu přes Bluetooth LE (Chrome a Edge, ne Safari) nebo přes systémový tisk.",
    "Před koupí ověřte Bluetooth LE a příkazy ESC/POS – tiskárna jen s klasickým Bluetooth z prohlížeče tisknout nejde.",
  ],
  sections: [
    {
      id: "je-potreba",
      heading: "Je tiskárna kvůli EET 2.0 potřeba?",
      blocks: [
        { p: FACTS.receipt.summary },
        { p: `${FACTS.confirmation.onReceipt} Evidence tím nijak netrpí – potvrzovací kód pokladna dostane a uloží i bez tisku.` },
        {
          table: {
            head: ["Způsob dokladu", "Co potřebujete", "Kdy se hodí"],
            rows: [
              ["E-mail", "Připojení k internetu a e-mail zákazníka", "Služby, ubytování, platby u zákazníka"],
              ["QR kód na displeji", "Připojení k internetu; zákazník si účtenku otevře v telefonu", "Rychlý prodej, kde nechcete papír"],
              ["Papír z termotiskárny", "Tiskárnu přes Bluetooth LE, nebo tiskárnu nainstalovanou v systému", "Pult kavárny, stánek, obchod, kde lidé papír chtějí často"],
            ],
            caption: "Stav k 22. 11. 2026. Povinnosti k daňovým dokladům podle zákona o DPH platí dál, EET 2.0 je nemění.",
          },
        },
        { p: "Podrobně o tom, co musí doklad obsahovat, píše návod [Musím vydávat účtenku?](/navody/musim-vydavat-uctenku)" },
      ],
    },
    {
      id: "prohlizec",
      heading: "Co funguje v pokladně v prohlížeči",
      blocks: [
        {
          p: "Pokladna EvidujZdarma je webová aplikace (PWA), která běží v prohlížeči. Prohlížeč smí s tiskárnou mluvit jen dvěma cestami – a podle toho se liší, co funguje:",
        },
        {
          table: {
            head: ["Cesta", "Jak to funguje", "Kde ano", "Kde ne"],
            rows: [
              [
                "**Bluetooth LE** (tlačítko Bluetooth)",
                "Pokladna pošle účtenku přímo do termotiskárny příkazy ESC/POS přes Web Bluetooth.",
                "Chrome nebo Edge na Androidu, Windows, macOS a ChromeOS",
                "Safari a ostatní prohlížeče na iPhonu a iPadu, Firefox",
              ],
              [
                "**Systémový tisk** (tlačítko Tisk)",
                "Otevře se tisk prohlížeče a vyberete tiskárnu, kterou má počítač nebo telefon nainstalovanou – i USB, síťovou nebo AirPrint.",
                "Všude, kde je tiskárna v systému nainstalovaná",
                "Tiskárna bez ovladače pro váš systém",
              ],
            ],
            caption: "Prohlížeč neumí poslat data přímo do USB nebo síťové tiskárny bez ovladače – to umí jen instalovaná pokladní aplikace.",
          },
        },
        {
          p: "Přes Bluetooth pokladna tiskne na šířku **32 znaků** (papír 58 mm) a text posílá **bez diakritiky**, aby byl čitelný na každém modelu. Na papír 80 mm vytiskne stejnou, jen užší účtenku. Vytisknout jde i denní uzávěrku.",
        },
        {
          note: "Otevírání pokladní zásuvky přes tiskárnu, tisk loga a čtečku čárových kódů pokladna zatím neumí. Pokud je potřebujete, napište nám – podle zájmu je přidáme.",
          tone: "info",
        },
      ],
    },
    {
      id: "pred-koupi",
      heading: "Na co se dívat před koupí",
      blocks: [
        {
          ul: [
            "**Bluetooth LE (BLE)**, ne jen „Bluetooth“. Spousta levných tiskáren umí jen klasické Bluetooth (SPP) – s instalovanou aplikací tisknou, z prohlížeče ne. Hledejte v parametrech „BLE“ nebo „Bluetooth 4.0 a vyšší s BLE“.",
            "**ESC/POS** – běžný jazyk pokladních tiskáren. Bez něj tiskárna příkazům pokladny nerozumí.",
            "**Šířka papíru** – 58 mm je menší a lehčí, hodí se ke stánku a do terénu; 80 mm je pultová.",
            "**Baterie a nabíjení**, pokud tisknete mimo provozovnu – stánek, taxi, výjezdy.",
            "**USB nebo síť** jen tehdy, když k tiskárně existuje ovladač pro váš systém a budete tisknout přes systémový tisk.",
          ],
        },
        {
          p: "Konkrétní značky nedoporučujeme a s žádným výrobcem nejsme propojeni. Nejjistější je tiskárnu vyzkoušet hned po koupi, dokud ji můžete vrátit: v pokladně (registrace je zdarma) udělejte prodej v ukázkovém režimu a na účtence klepněte na Bluetooth. Ověříte tak, že ji prohlížeč najde a vytiskne.",
        },
      ],
    },
    {
      id: "bez-signalu",
      heading: "Tisk bez signálu",
      blocks: [
        {
          p: `Bluetooth tiskárna spojení s internetem nepotřebuje – účtenku vytisknete i bez signálu. ${FACTS.offline.summary} Na účtence vytištěné bez signálu proto potvrzovací kód ještě není; zákazník ho uvidí na online účtence, jakmile se tržba odešle.`,
        },
        { p: "E-mail a QR účtenka naopak připojení potřebují. Podrobně v návodu [EET bez internetu](/navody/eet-bez-internetu)." },
      ],
    },
  ],
  faq: [
    { q: "Musím si kvůli EET 2.0 koupit tiskárnu účtenek?", a: `Ne. ${FACTS.receipt.summary}` },
    {
      q: "Jakou tiskárnu vybrat k pokladně v mobilu?",
      a: "Termotiskárnu s Bluetooth LE a příkazy ESC/POS. Tiskárna jen s klasickým Bluetooth z webové pokladny tisknout nepůjde. Konkrétní značky nedoporučujeme.",
    },
    {
      q: "Funguje Bluetooth tisk na iPhonu?",
      a: "Z prohlížeče ne – Safari ani ostatní prohlížeče na iPhonu a iPadu Web Bluetooth nepodporují. Na iPhonu můžete tisknout přes systémový tisk na tiskárnu s AirPrint, nebo účtenku poslat e-mailem či ukázat jako QR kód.",
    },
    {
      q: "Mám USB tiskárnu. Půjde to?",
      a: "Ano, pokud má ovladač pro váš počítač: pokladna ji použije přes tlačítko Tisk (tisk prohlížeče). Přímo přes USB bez ovladače prohlížeč tisknout neumí.",
    },
    { q: "Musí být na účtence potvrzovací kód POK?", a: `${FACTS.confirmation.onReceipt}` },
  ],
  howTo: {
    name: "Jak připojit Bluetooth tiskárnu k pokladně v prohlížeči",
    description: "Tisk účtenky na termotiskárnu ESC/POS přes Bluetooth LE z pokladny EvidujZdarma.",
    steps: [
      { name: "Zapněte tiskárnu a Bluetooth", text: "Zapněte tiskárnu, vložte papír a v telefonu nebo počítači zapněte Bluetooth. Tiskárnu není potřeba párovat v nastavení systému." },
      { name: "Otevřete pokladnu v Chromu nebo Edgi", text: "Po zaplacení se na obrazovce účtenky objeví tlačítko Bluetooth – jen v prohlížeči, který Web Bluetooth podporuje." },
      { name: "Vyberte tiskárnu", text: "Klepněte na Bluetooth a v seznamu zařízení vyberte tiskárnu. Pokladna si ji do zavření stránky pamatuje." },
      { name: "Zkontrolujte výtisk", text: "Po vytištění pokladna napíše „Vytištěno.“ Když tiskárna Bluetooth LE nepodporuje, uvidíte o tom hlášení – pak použijte tlačítko Tisk nebo e-mail." },
    ],
  },
  sources: [SOURCES.prezident, SOURCES.zos, SOURCES.prakticke, SOURCES.fsFaq],
  related: ["musim-vydavat-uctenku", "pokladna-v-mobilu-zdarma", "eet-bez-internetu"],
  published: "2026-11-22",
  updated: "2026-11-22",
  changelog: [
    // Revize Heleny Jeřábkové 22. 11. 2026
    { date: "2026-11-22", text: "Návod prošel odbornou revizí (Helena Jeřábková)." },
    { date: "2026-11-22", text: "Nový návod – koncept před odbornou revizí." },
  ],
  reviewedBy: REVIEWER.name,
};
