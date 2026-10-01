import type { FaqItem } from "@/components/faq";

export const WHO_MUST: readonly { title: string; text: string; tone: "yes" | "maybe" | "no"; href?: string; linkLabel?: string }[] = [
  {
    title: "Podnikatelé, kteří přijímají hotovost nebo kartu od zákazníků",
    text: "Obchody, stánky, kadeřnictví, kosmetika, řemeslníci, ubytování, taxi a další služby pro spotřebitele.",
    tone: "yes",
    href: "/navody/koho-se-eet-tyka",
    linkLabel: "Koho se EET týká",
  },
  {
    title: "OSVČ v paušálním režimu",
    text: "Mohou zvážit režim EET OFF – vyšší paušální daň místo evidence. Vyplatí se to jen někomu.",
    tone: "maybe",
    href: "/kalkulacka-eet-off",
    linkLabel: "Kalkulačka EET OFF",
  },
  {
    title: "Prodej mimo provozovnu",
    text: "Řemeslníci u zákazníka, trhy, rozvoz – evidují se také, jen jinou evidenční jednotkou.",
    tone: "yes",
    href: "/evidencni-jednotky",
    linkLabel: "Průvodce evidenčními jednotkami",
  },
  {
    title: "Tržba za jiného",
    text: "Masér v hotelu, prodej v cizím obchodě – evidovat může i pověřený podnikatel.",
    tone: "maybe",
    href: "/navody/trzba-za-jineho",
    linkLabel: "Tržba za jiného",
  },
  {
    title: "Platby jen převodem na účet",
    text: "Pokud zákazníci platí výhradně bankovním převodem na základě faktury, evidence se vás pravděpodobně netýká.",
    tone: "no",
    href: "/navody/kontaktni-platba",
    linkLabel: "Co se eviduje a co ne",
  },
];

export const LANDING_FAQ: readonly FaqItem[] = [
  {
    q: "Od kdy platí EET 2.0?",
    a: "Podle harmonogramu Finanční správy začíná evidence 1. 1. 2027 a ostrý provoz 1. 2. 2027. Přípravu (aktivace DIS+, oznámení evidenčních jednotek, certifikát) lze zahájit od 1. 11. 2026.",
  },
  {
    q: "Je pokladna EvidujZdarma opravdu zdarma?",
    a: "Ano. Evidence tržeb, práce bez signálu, až 5 uživatelů, 3 evidenční jednotky, účtenka e-mailem a QR a export CSV jsou zdarma navždy. Platí se jen za doplňky, které nás stojí peníze nebo šetří hodiny práce – například SMS účtenky nebo export do Pohody.",
  },
  {
    q: "Jste státní aplikace?",
    a: "Ne. EvidujZdarma je nezávislá služba, kterou provozuje soukromá firma. Státní aplikace se jmenuje MOJE eet a najdete ji na eet.gov.cz. Obě řešení můžete porovnat v naší tabulce.",
  },
  {
    q: "Co když nemám signál?",
    a: "Pokladna tržbu uloží v zařízení, vydá účtenku a odešle tržbu automaticky, jakmile je připojení. Na obrazovce uvidíte, kolik času zbývá do konce lhůty pro dodatečné odeslání.",
  },
  {
    q: "Co je evidenční jednotka?",
    a: "Místo nebo způsob, kde přijímáte tržby – provozovna, e-shop, vozidlo nebo prodej mimo provozovnu. Evidenční jednotky se oznamují Finanční správě v DIS+. Pomůže vám náš průvodce evidenčními jednotkami.",
  },
  {
    q: "Co je EET OFF?",
    a: "Možnost pro část OSVČ v paušálním režimu platit vyšší paušální daň a tržby neevidovat. Zda se to vyplatí, spočítáte v naší kalkulačce EET OFF.",
  },
  {
    q: "Jak získám certifikát pro evidenci tržeb?",
    a: "Certifikát se stahuje v DIS+ (daňový informační systém Finanční správy). Postup se snímky obrazovky najdete v návodu Jak aktivovat DIS+ a stáhnout certifikát.",
  },
  {
    q: "Je bezpečné nahrát k vám certifikát?",
    a: "Privátní klíč šifrujeme samostatným klíčem pro každý účet a ukládáme na serverech v EU. Kdo chce, může ponechat klíč jen ve svém zařízení. Přístupy k certifikátům auditujeme.",
  },
  {
    q: "Na čem pokladna funguje?",
    a: "V prohlížeči na telefonu, tabletu i počítači. Lze ji nainstalovat jako aplikaci (PWA). Podporujeme Bluetooth tiskárny účtenek a čtečky čárových kódů.",
  },
  {
    q: "Jsem účetní. Co pro mě máte?",
    a: "Bezplatný účetní kabinet: hromadnou kontrolu IČO klientů, přehled jejich připravenosti na EET, export tržeb a šablony dopisů klientům. Partnerům nabízíme podíl z placených tarifů jejich klientů.",
  },
];
