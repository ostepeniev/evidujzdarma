import { FACTS, formatKc, timelineAt } from "./facts";
import { formatCzk } from "@/lib/doc-tools";
import { isClosed } from "@/lib/launch";
import { vatFromBase, type VatRate } from "@/lib/vat";

/**
 * S5-SLUŽBY (26. 10. 2026, rozhodnutí majitele): placené služby kolem EET 2.0 – stránka /nastaveni-na-klic.
 *  - Technické nastavení prodáváme sami, písemně (e-mailem), bez telefonování.
 *  - Daňovou část (zda EET ON, nebo OFF; přihlášení k EET OFF) smí za úplatu poskytovat jen daňový poradce
 *    (zákon č. 523/1992 Sb., o daňovém poradenství). Proto ji nabízíme až s partnerským daňovým poradcem –
 *    TAX_PARTNER.enabled zapne kontroler, jakmile s tím Helena Jeřábková souhlasí (karta eet-helena-s5).
 *    Do té doby stránka vede na kalkulačku a návod zdarma a jasně říká, že daňové poradenství neposkytujeme.
 *  - Poptávka jde e-mailem provozovateli (POST /api/poptavka), zákazníkovi nic neposíláme – žádné e-maily na cizí adresy.
 *
 * DECISIONS К13 (31. 10. 2026, rozhodnutí majitele):
 *  - cena je bez DPH; provozovatel (Swipe Scape s.r.o.) je plátce DPH, proto u ceny vždy i částka s DPH –
 *    obojí se počítá z jediné konstanty SETUP_PRICE_EX_VAT a sazby SERVICE_VAT_RATE;
 *  - služba má 3 kroky (SETUP_STEPS); nový balíček „Připojení stávající pokladny“ (EXISTING_POS_SERVICE) s cenou
 *    podle systému; partnerská účetní kancelář (SERVICE_PARTNER) pomáhá se složitějším nastavením.
 */

/** Sazba DPH u našich služeb – provozovatel je plátce DPH (DIČ v lib/site.ts, OPERATOR.dic). */
export const SERVICE_VAT_RATE: VatRate = 21;
/** Cena „Nastavení na klíč“ bez DPH – jediné místo, kde se mění (rozhodnutí majitele 31. 10. 2026). */
export const SETUP_PRICE_EX_VAT = 990;

const SETUP_PRICE = vatFromBase(SETUP_PRICE_EX_VAT, SERVICE_VAT_RATE);

export const SETUP_SERVICE = {
  id: "nastaveni",
  name: "Nastavení EET na klíč",
  /** cena bez DPH (Kč) */
  price: SETUP_PRICE.base,
  /** cena včetně DPH (Kč) – pro spotřebitele a pro JSON-LD Offer */
  priceInclVat: SETUP_PRICE.total,
  vatRate: SERVICE_VAT_RATE,
  /** „990 Kč bez DPH“ */
  priceExVatLabel: `${formatKc(SETUP_PRICE.base)} bez DPH`,
  /** „1 197,90 Kč s DPH“ */
  priceInclVatLabel: `${formatCzk(SETUP_PRICE.total)} s DPH`,
  /** „990 Kč bez DPH (1 197,90 Kč s DPH)“ – do vět a všude, kde se cena zmiňuje */
  priceLabel: `${formatKc(SETUP_PRICE.base)} bez DPH (${formatCzk(SETUP_PRICE.total)} s DPH)`,
  priceNote: `jednorázově; jsme plátci DPH (${SERVICE_VAT_RATE} %)`,
  payment: "Platíte až po dokončení – fakturou se splatností 14 dní.",
  responseTime: "Ozveme se e-mailem do 1 pracovního dne.",
} as const;

/**
 * Balíček pro podnikatele, kteří už pokladnu mají – z první EET (2016–2020) nebo jiný pokladní systém.
 * Údaje o ceně servisních firem jsou z praxe partnerské účetní kanceláře, ne z ceníků – web je tak i podává.
 * Cenu pevně neuvádíme: potvrdíme ji předem podle systému.
 */
export const EXISTING_POS_SERVICE = {
  id: "pripojeni",
  name: "Připojení stávající pokladny",
  priceLabel: "Cena podle systému",
  priceNote: "cenu potvrdíme předem podle systému, bez DPH",
  /** tři cesty, jak připojit stávající pokladnu k EET 2.0 (pořadí = doporučení) */
  options: [
    {
      title: "Servisní firma vaší pokladny",
      text: "Pokud vám pokladnu někdo servisuje, obvykle vám EET klíč připojí sám. Z praxe naší partnerské účetní kanceláře: jednorázově zhruba 900–1 000 Kč plus cesta, nebo v rámci měsíčního paušálu 70–200 Kč. Ceny jednotlivých firem se liší – zeptejte se svého dodavatele.",
    },
    {
      title: "Vzdálené připojení s námi",
      text: "Když servisní firmu nemáte, můžeme pokladnu připojit přes vzdálený přístup – podle toho, jaký systém v ní běží. Certifikát nahráváte a heslo zadáváte vy, soubor ani heslo nám neposíláte.",
    },
    {
      title: "Sami podle písemného návodu",
      text: "Pošleme vám písemný postup pro váš systém a vy pokladnu připojíte sami. Pokud se zaseknete, poradíme e-mailem.",
    },
  ],
} as const;

/** Balíčky ve formuláři poptávky (/api/poptavka ověřuje id). */
export const SERVICE_PACKAGES = [
  { id: SETUP_SERVICE.id, name: SETUP_SERVICE.name, priceLabel: SETUP_SERVICE.priceLabel },
  { id: EXISTING_POS_SERVICE.id, name: EXISTING_POS_SERVICE.name, priceLabel: EXISTING_POS_SERVICE.priceNote },
] as const;
export type ServicePackageId = (typeof SERVICE_PACKAGES)[number]["id"];

/**
 * Partnerská účetní kancelář (rozhodnutí majitele 31. 10. 2026): pomáhá se složitějším nastavením pokladen.
 * Není to daňové poradenství – TAX_PARTNER zůstává vypnutý. Jméno kontaktní osoby neuvádíme.
 */
export const SERVICE_PARTNER = {
  name: "Leader Business Consulting Group s.r.o.",
  ico: "24181412",
  city: "Praha 6",
  role: "pomáhá se složitějším nastavením pokladen",
} as const;

/** „Partnerská účetní kancelář: … – pomáhá se složitějším nastavením pokladen.“ (/o-nas, /nastaveni-na-klic) */
export const SERVICE_PARTNER_LINE = `Partnerská účetní kancelář: ${SERVICE_PARTNER.name}, IČO ${SERVICE_PARTNER.ico}, ${SERVICE_PARTNER.city} – ${SERVICE_PARTNER.role}.`;

/** Proč může být EvidujZdarma pro malé podnikatele levnější – argument partnerské kanceláře, věcně a bez srovnávání s konkrétními firmami. */
export const WHY_CHEAPER: readonly string[] = [
  "Účet založíte jednou a pokladnu nastavíte jednou – pak už ji jen používáte v telefonu, tabletu nebo počítači.",
  "Žádné placené výjezdy servisního technika: nastavení i pomoc probíhají písemně a na dálku.",
  "Nejvíc to platí pro menší provozy a poskytovatele služeb, kteří nevedou sklad.",
];

/**
 * Co je v ceně – čas pokladny podle stavu spuštění (R11: před 2. 11. budoucí čas).
 * Do DIS+ se klient přihlašuje sám a soubor certifikátu (.p12) s heslem nikomu neposílá (návod jak-aktivovat-dis-a-certifikat) –
 * proto „na klíč“ = všechno připravíme a zkontrolujeme, klient klikne jen tam, kde je potřeba jeho přihlášení.
 */
export function setupIncludes(): string[] {
  const posOpen = !isClosed("/pokladna");
  return [
    "Postup na míru pro vaši firmu: přihlášení k evidenci v DIS+, oznámení evidenčních jednotek (provozoven) a pokladní certifikát – krok za krokem, s odkazy přímo na správná místa.",
    "Kontrola v DIS+: pošlete nám, co jste udělali (ID evidenčních jednotek, platnost certifikátu), a my ověříme, že je vše správně.",
    posOpen
      ? "Připojení certifikátu v pokladně EvidujZdarma a zkušební spuštění: projdeme s vámi první zkušební tržbu."
      : "Připojení certifikátu v pokladně EvidujZdarma (spouštíme ji 2. 11. 2026) a zkušební spuštění: projdeme s vámi první zkušební tržbu.",
    "Kontrola nastavení pokladny: provozovny, uživatelé a zboží či služby – z vašeho ceníku připravíme soubor pro import.",
    "Odpovědi na vaše dotazy k nastavení e-mailem ještě 30 dní po dokončení.",
  ];
}

/** Tři kroky služby (rozhodnutí majitele 31. 10. 2026, DECISIONS К13). */
export const SETUP_STEPS: readonly { title: string; text: string }[] = [
  {
    title: "DIS+ a EET: přihlášení k evidenci a evidenční jednotky",
    text: "Do 1 pracovního dne vám pošleme postup na míru: jak se v DIS+ přihlásit k evidenci tržeb a oznámit evidenční jednotky. Do DIS+ se přihlašujete sami, například přes Identitu občana – my pak zkontrolujeme, že je vše oznámené správně.",
  },
  {
    title: "Připojení certifikátu (klíče) a zkušební spuštění",
    text: "Pokladní certifikát si vygenerujete v DIS+ a sami ho nahrajete do pokladny – soubor .p12 ani heslo nám neposíláte. Pak spolu projdeme zkušební tržbu a ověříme, že se vrací potvrzovací kód (POK).",
  },
  {
    title: "Kontrola nastavení pokladny",
    text: "Zkontrolujeme provozovny, uživatele a zboží či služby v pokladně, aby od prvního dne evidovala správně. Fakturu posíláme až potom.",
  },
];

/** Daňová část – jen s partnerskou daňovou poradkyní (zákon č. 523/1992 Sb.). */
export const TAX_PARTNER = {
  /** Zapne kontroler po souhlasu partnerky (DECISIONS К12). */
  enabled: false,
  notice:
    "Rozhodnutí, zda evidovat, nebo zvolit EET OFF, a přihlášení k EET OFF za vás jsou daňové poradenství. To smí za úplatu poskytovat jen daňový poradce, proto je neděláme. Orientačně si to spočítáte v naší kalkulačce zdarma a rozhodnutí proberte se svou účetní nebo daňovým poradcem.",
} as const;

/** Termíny na stránce – vždy z harmonogramu, nikdy natvrdo. */
export function serviceDeadlines(): { label: string; text: string }[] {
  const dis = timelineAt("2026-11-01");
  const start = timelineAt("2027-01-01");
  return [
    { label: dis.dateLabel, text: "EET v DIS+: přihlášení k evidenci, evidenční jednotky a pokladní certifikát." },
    { label: start.dateLabel, text: "Účinnost zákona – evidovat se musí od prvního dne." },
    { label: FACTS.eetOff.deadline, text: "Poslední den pro přihlášení k EET OFF (jen paušalisté v 1. pásmu s příjmy do 1 mil. Kč)." },
  ];
}

export const SERVICE_FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Proč nevoláte?",
    a: "Všechno vyřídíme písemně e-mailem: postup máte černé na bílém, můžete se k němu kdykoli vrátit a nemusíte hledat čas na hovor.",
  },
  {
    q: "Můžete DIS+ udělat úplně za mě?",
    a: "Do DIS+ se přihlašujete sami, například přes Identitu občana, a přihlašovací údaje nikomu nedávejte – ani nám. Stejně tak soubor certifikátu (.p12) a jeho heslo: kdo je má, může vaším jménem odesílat tržby. Kroky v DIS+ a nahrání certifikátu proto uděláte vy podle našeho postupu, my všechno ostatní připravíme a zkontrolujeme.",
  },
  {
    q: "Pomůžete mi rozhodnout, jestli evidovat, nebo zvolit EET OFF?",
    a: `${TAX_PARTNER.notice} Lhůta pro přihlášení k EET OFF je ${FACTS.eetOff.deadline}.`,
  },
  {
    q: "Kolik to stojí a kdy platím?",
    a: `Nastavení na klíč stojí jednorázově ${SETUP_SERVICE.priceLabel}. Jsme plátci DPH, proto uvádíme cenu bez DPH i s DPH. ${SETUP_SERVICE.payment} Pokladna EvidujZdarma sama zůstává zdarma.`,
  },
  {
    q: "Kdo službu dělá?",
    a: `Nastavení děláme my, tým EvidujZdarma. Se složitějším nastavením pokladen nám pomáhá partnerská účetní kancelář ${SERVICE_PARTNER.name}. Daňové poradenství neposkytujeme ani my, ani partner v rámci této služby.`,
  },
  {
    q: "Je to i pro s.r.o. a pro víc provozoven?",
    a: "Ano. Postup připravíme pro OSVČ i pro firmy a pro všechny vaše provozovny. U více než 3 provozoven vám předem napíšeme, jestli cena zůstává stejná.",
  },
  {
    q: "Mám pokladnu z první EET nebo jiný pokladní systém. Pomůžete mi?",
    a: `Ano – na to je balíček ${EXISTING_POS_SERVICE.name}. Nejčastěji vám EET klíč připojí servisní firma vaší pokladny; když žádnou nemáte, připojíme pokladnu přes vzdálený přístup (podle systému), nebo vám pošleme písemný návod. Cenu potvrdíme předem podle systému. Certifikát nahráváte vždy vy.`,
  },
];

/** Návody, ve kterých je po textu nabídka „Nastavení na klíč“ (praktické kroky s DIS+, certifikátem a EET OFF). */
export const SERVICE_CTA_GUIDES: readonly string[] = [
  "jak-aktivovat-dis-a-certifikat",
  "evidencni-jednotka",
  "eet-off",
  "eet-a-pausalni-dan",
  "eet-2-0-kompletni-pruvodce",
  "koho-se-eet-tyka",
  "pokladna-v-mobilu-zdarma",
  "eet-on-nebo-off-modelove-situace",
  "kdo-pomuze-s-eet",
  "pokladna-z-eet-1-0",
];
