import { FACTS, timelineAt } from "./facts";
import { isClosed } from "@/lib/launch";

/**
 * S5-SLUŽBY (26. 10. 2026, rozhodnutí majitele): placené služby kolem EET 2.0 – stránka /nastaveni-na-klic.
 *  - Technické nastavení prodáváme sami: 990 Kč, písemně (e-mailem), bez telefonování.
 *  - Daňovou část (zda EET ON, nebo OFF; přihlášení k EET OFF) smí za úplatu poskytovat jen daňový poradce
 *    (zákon č. 523/1992 Sb., o daňovém poradenství). Proto ji nabízíme až s partnerskou daňovou poradkyní –
 *    TAX_PARTNER.enabled zapne kontroler, jakmile s tím Helena Jeřábková souhlasí (karta eet-helena-s5).
 *    Do té doby stránka vede na kalkulačku a návod zdarma a jasně říká, že daňové poradenství neposkytujeme.
 *  - Poptávka jde e-mailem provozovateli (POST /api/poptavka), zákazníkovi nic neposíláme – žádné e-maily na cizí adresy.
 */

export const SETUP_SERVICE = {
  id: "nastaveni",
  name: "Nastavení EET na klíč",
  price: 990,
  priceLabel: "990 Kč",
  /** Konečná cena – nic se k ní nepřičítá. */
  priceNote: "konečná cena, jednorázově",
  payment: "Platíte až po dokončení – fakturou se splatností 14 dní.",
  responseTime: "Ozveme se e-mailem do 1 pracovního dne.",
} as const;

/**
 * Co je v ceně – čas pokladny podle stavu spuštění (R11: před 2. 11. budoucí čas).
 * Do DIS+ se klient přihlašuje sám a soubor certifikátu (.p12) s heslem nikomu neposílá (návod jak-aktivovat-dis-a-certifikat) –
 * proto „na klíč“ = všechno připravíme a zkontrolujeme, klient klikne jen tam, kde je potřeba jeho přihlášení.
 */
export function setupIncludes(): string[] {
  const posOpen = !isClosed("/pokladna");
  return [
    "Postup na míru pro vaši firmu: přihlášení k evidenci v DIS+, evidenční jednotky (provozovny) a pokladní certifikát – krok za krokem, s odkazy přímo na správná místa.",
    "Kontrola: pošlete nám, co jste v DIS+ udělali (ID evidenčních jednotek, platnost certifikátu), a my ověříme, že je vše správně.",
    posOpen
      ? "Připravíme nastavení pokladny EvidujZdarma: provozovny, uživatele a z vašeho ceníku soubor pro import zboží a služeb. Projdeme s vámi první zkušební tržbu."
      : "Připravíme nastavení pokladny EvidujZdarma (spouštíme ji 2. 11. 2026): provozovny, uživatele a z vašeho ceníku soubor pro import zboží a služeb. Projdeme s vámi první zkušební tržbu.",
    "Odpovědi na vaše dotazy k nastavení e-mailem ještě 30 dní po dokončení.",
  ];
}

export const SETUP_STEPS: readonly { title: string; text: string }[] = [
  { title: "Pošlete poptávku", text: "Stačí e-mail a pár slov o firmě. IČO pomůže, abychom postup připravili přesně pro vás." },
  {
    title: "Dostanete postup na míru",
    text: "Do 1 pracovního dne vám pošleme přesný postup pro DIS+ – co, kde a v jakém pořadí kliknout.",
  },
  {
    title: "Kliknete v DIS+",
    text: "Do DIS+ se přihlašujete sami, například přes Identitu občana, proto tyto kroky uděláte vy podle našeho postupu.",
  },
  {
    title: "Zkontrolujeme a doladíme",
    text: "Ověříme, že je vše v pořádku, připravíme nastavení pokladny a projdeme s vámi první tržbu. Fakturu posíláme až potom.",
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
    a: `${SETUP_SERVICE.priceLabel} jako konečná cena. ${SETUP_SERVICE.payment} Pokladna EvidujZdarma sama zůstává zdarma.`,
  },
  {
    q: "Je to i pro s.r.o. a pro víc provozoven?",
    a: "Ano. Postup připravíme pro OSVČ i pro firmy a pro všechny vaše provozovny. U více než 3 provozoven vám předem napíšeme, jestli cena zůstává stejná.",
  },
  {
    q: "Mám jinou pokladnu. Pomůžete mi?",
    a: "S DIS+ a certifikátem ano – ty potřebuje každá pokladna. Nastavení cizí pokladny ale neděláme; certifikát do ní nahrajete podle návodu jejího dodavatele.",
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
];
