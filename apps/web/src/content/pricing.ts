/**
 * Ceník EvidujZdarma.
 *
 * Ceny placených doplňků jsou HYPOTÉZA k ověření (předregistrace, rozhovory s uživateli)
 * a web je tak i označuje. Jádro pokladny je zdarma navždy — to se nemění.
 * Placené funkce spouštíme později než bezplatnou pokladnu.
 */

export const PRICING_UPDATED = "2026-10-01";

/** Zobrazí se v FAQ (prostý text – FAQ a JSON-LD odkazy nevykreslují). */
export const PRICING_NOTICE_TEXT =
  "Ceny placených doplňků jsou předběžné – teprve je ověřujeme a do spuštění se mohou změnit. Bezplatné jádro pokladny zůstane zdarma navždy (čl. 6.2 podmínek).";
/** Zobrazí se nad ceníkem (RichText) – „navždy“ odkazuje na definici v podmínkách (Ц2, R7.9). */
export const PRICING_NOTICE =
  "Ceny placených doplňků jsou předběžné – teprve je ověřujeme a do spuštění se mohou změnit. Bezplatné jádro pokladny zůstane zdarma navždy ([čl. 6.2 podmínek](/podminky#zdarma)).";

export type PlanStatus = "prereg" | "later" | "preparing";

export const STATUS_LABEL: Record<PlanStatus, string> = {
  prereg: "Předregistrace otevřená",
  later: "Spustíme později",
  preparing: "Připravujeme",
};

export interface Plan {
  id: string;
  name: string;
  /** cena v Kč (bez formátování) — pro JSON-LD */
  price: number;
  /** hlavní cenovka, např. "0 Kč" nebo "149 Kč" */
  priceLabel: string;
  /** doplněk cenovky, např. "/ měsíc" */
  period?: string;
  /** alternativní cena, např. roční platba */
  alt?: string;
  /** cena je "od" (API) */
  from?: boolean;
  /** opakovaná platba (měsíčně) — pro JSON-LD */
  monthly?: boolean;
  tagline: string;
  features: readonly string[];
  status: PlanStatus;
  cta: { href: string; label: string };
  highlight?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "zdarma",
    name: "Zdarma",
    price: 0,
    priceLabel: "0 Kč",
    period: "navždy",
    tagline: "Všechno, co potřebuje malý podnikatel pro evidenci tržeb.",
    features: [
      "Pokladna pro EET 2.0 v telefonu, tabletu i počítači",
      "Funguje i bez signálu, hlídá lhůtu 48 hodin a tržby odešle, jakmile je pokladna online",
      "Až 5 uživatelů s vlastním PINem",
      "Až 3 evidenční jednotky",
      "Doklad e-mailem, odkazem a QR kódem",
      "Denní přehled tržeb",
      "Export do CSV pro účetní",
      "QR platba na přesnou částku",
    ],
    status: "prereg",
    cta: { href: "/#registrace", label: "Předregistrovat zdarma" },
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: 149,
    priceLabel: "149 Kč",
    period: "/ měsíc",
    alt: "nebo 1 490 Kč / rok (2 měsíce zdarma)",
    monthly: true,
    tagline: "Pro firmy s více provozovnami a pro ty, kdo chtějí ušetřit čas.",
    features: [
      "Vše ze Zdarma",
      "Bez limitu evidenčních jednotek a uživatelů",
      "Účtenky SMS",
      "Vlastní logo na dokladu",
      "Export pro Pohodu, Money S3 a ABRA",
      "AI přehled tržeb a trendů",
      "Prioritní podpora",
    ],
    status: "later",
    cta: { href: "/#registrace", label: "Chci vědět o spuštění" },
  },
];

export interface Addon {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  period?: string;
  from?: boolean;
  monthly?: boolean;
  text: string;
  bullets?: readonly string[];
  status: PlanStatus;
  cta: { href: string; label: string };
}

export const ADDONS: readonly Addon[] = [
  {
    id: "terminal",
    name: "Terminál",
    price: 99,
    priceLabel: "+99 Kč",
    period: "/ měsíc",
    monthly: true,
    text: "Platba kartou přímo v telefonu (Tap to Pay / SoftPOS) přes platebního partnera – bez samostatného terminálu.",
    bullets: ["Doplněk k Zdarma i Premium", "Poplatky za transakce určí platební partner – zveřejníme je před spuštěním"],
    status: "preparing",
    cta: { href: "/#registrace", label: "Mám zájem o terminál" },
  },
  {
    id: "nastaveni",
    name: "Nastavení na klíč",
    price: 490,
    priceLabel: "490 Kč",
    period: "jednorázově",
    text: "Přes videohovor za 30 minut společně projdeme DIS+, pokladní certifikát a nastavení pokladny. Vy klikáte, my radíme.",
    bullets: ["Přihlášení k evidenci a evidenční jednotky v DIS+", "Vygenerování a nahrání certifikátu", "První zkušební tržba"],
    status: "preparing",
    cta: { href: "/#registrace", label: "Chci pomoc s nastavením" },
  },
  {
    id: "api",
    name: "API pro vývojáře",
    price: 990,
    priceLabel: "od 990 Kč",
    period: "/ měsíc",
    from: true,
    monthly: true,
    text: "EET Gateway: odesílání tržeb do EET 2.0 z vašeho rezervačního systému, CRM nebo hotelového PMS bez vlastní implementace podpisu a certifikátů.",
    bullets: ["REST API, my se postaráme o komunikaci s Finanční správou", "Fronta a opakované odeslání při výpadku"],
    status: "preparing",
    cta: { href: "/o-nas#kontakt", label: "Napsat nám" },
  },
];

export const PARTNER_PLAN = {
  name: "Účetní Partner",
  priceLabel: "0 Kč",
  share: 20,
  text: "Pro účetní a daňové kanceláře: bezplatný Účetní kabinet pro všechny klienty a podíl z jejich plateb.",
  bullets: [
    "Účetní kabinet zdarma: hromadná kontrola IČO a stav připravenosti klientů",
    "Export tržeb klientů – CSV zdarma, Pohoda / Money S3 / ABRA připravujeme v partnerském tarifu",
    "20 % z plateb vašich klientů za placené tarify po celou dobu, kdy je platí – nebo místo toho sleva pro klienty",
    "Šablony dopisů klientům a webináře EET 2.0 pro účetní",
  ],
  cta: { href: "/ucetni", label: "Program pro účetní" },
} as const;

/** Srovnání Zdarma × Premium. `true` = ano, `false` = ne, string = konkrétní hodnota. */
export const FEATURE_MATRIX: readonly { feature: string; free: boolean | string; premium: boolean | string }[] = [
  { feature: "Evidence tržeb EET 2.0", free: true, premium: true },
  { feature: "Práce bez signálu, odeslání do 48 h", free: true, premium: true },
  { feature: "Uživatelé", free: "až 5", premium: "bez limitu" },
  { feature: "Evidenční jednotky", free: "až 3", premium: "bez limitu" },
  { feature: "Doklad e-mailem, odkazem a QR", free: true, premium: true },
  { feature: "QR platba", free: true, premium: true },
  { feature: "Denní přehled a export CSV", free: true, premium: true },
  { feature: "Účtenky SMS", free: false, premium: true },
  { feature: "Vlastní logo na dokladu", free: false, premium: true },
  { feature: "Export Pohoda / Money S3 / ABRA", free: false, premium: true },
  { feature: "AI přehled tržeb a trendů", free: false, premium: true },
  { feature: "Prioritní podpora", free: false, premium: true },
];

export const PRICING_FAQ = [
  {
    q: "Je bezplatný tarif opravdu zdarma navždy?",
    a: "Ano. Evidence tržeb, práce bez signálu, až 5 uživatelů, 3 evidenční jednotky, doklad e-mailem a QR kódem, denní přehled, export CSV a QR platba zůstanou zdarma. Nejde o zkušební verzi a nevyžadujeme platební kartu.",
  },
  {
    q: "Jak na bezplatné pokladně vyděláváte?",
    a: "Na placených doplňcích (připravujeme je), které nás stojí peníze nebo vám šetří hodiny práce – například SMS účtenky, export do účetních programů, platba kartou v telefonu nebo nastavení na klíč. Vaše data neprodáváme.",
  },
  {
    q: "Proč jsou ceny označené jako předběžné?",
    a: PRICING_NOTICE_TEXT + " Konečné ceny včetně informace o DPH zveřejníme před spuštěním placených funkcí a nikomu je nezačneme účtovat bez jeho výslovného souhlasu.",
  },
  {
    q: "Kdy budou placené funkce dostupné?",
    a: "Nejdřív spouštíme bezplatnou pokladnu, abyste si ji stihli vyzkoušet v prosinci 2026 – evidovat se musí od 1. 1. 2027. Placené doplňky přidáme později. Kdo je předregistrovaný, dozví se o spuštění jako první.",
  },
  {
    q: "Mohu Premium získat zdarma?",
    a: "Ano – když se přes váš odkaz předregistruje kolega a do 31. 3. 2027 začne s EvidujZdarma evidovat tržby, získáte oba Premium na 3 měsíce zdarma. Odkaz dostanete po potvrzení předregistrace. Podrobnosti najdete v pravidlech akce.",
  },
  {
    q: "Co když mi limit 3 evidenčních jednotek nestačí?",
    a: "Pak se vám vyplatí Premium bez limitu jednotek a uživatelů. Kolik jednotek opravdu potřebujete, zjistíte v našem průvodci evidenčními jednotkami.",
  },
] as const;
