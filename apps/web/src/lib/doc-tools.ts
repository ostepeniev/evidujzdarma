/**
 * S1 (17. 10. 2026): výpočty a texty pro nástroje „Doklad o prodeji“ (§ 16 zákona č. 634/1992 Sb.) a „Vzor pověření“
 * (§ 10 zákona č. 180/2026 Sb.). Čisté funkce bez DOM – vše se počítá v prohlížeči, na server nic neodchází.
 */

export interface SaleItem {
  name: string;
  qty: string;
  price: string;
}

/** „1 234,50“ / „1234.5“ / „ 99 “ → číslo; prázdné nebo nesmysl → null. */
export function parseCzNumber(raw: string): number | null {
  const s = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!s) return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Zaokrouhlení na haléře (bez chyb plovoucí čárky). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Řádek dokladu: množství × cena; prázdné množství = 1. Neplatný řádek → null. */
export function lineTotal(item: SaleItem): number | null {
  const qty = item.qty.trim() ? parseCzNumber(item.qty) : 1;
  const price = parseCzNumber(item.price);
  if (qty === null || price === null || qty <= 0) return null;
  return round2(qty * price);
}

/** Vyplněné řádky (s názvem nebo cenou). */
export const filledItems = (items: readonly SaleItem[]) => items.filter((i) => i.name.trim() || i.price.trim());

export function saleTotal(items: readonly SaleItem[]): number {
  return round2(filledItems(items).reduce((sum, i) => sum + (lineTotal(i) ?? 0), 0));
}

/** 1234.5 → „1 234,50 Kč“ (nezlomitelné mezery jako v Intl cs-CZ). */
export function formatCzk(n: number): string {
  return `${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} Kč`;
}

/** „2026-10-17“ → „17. 10. 2026“. */
export function formatCzDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
}

export const PAYMENT_METHODS = {
  hotove: "hotově",
  kartou: "platební kartou",
  qr: "QR kódem (převodem na místě)",
  prevodem: "převodem na účet",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** Co doklad podle § 16 odst. 1 ZOS musí mít – chybějící údaje vrací jako seznam vět pro upozornění. */
export function missingSaleFields(d: { sellerName: string; ico: string; date: string; items: readonly SaleItem[] }): string[] {
  const out: string[] = [];
  if (!d.sellerName.trim()) out.push("Doplňte jméno a příjmení nebo název prodávajícího.");
  if (!d.ico.trim()) out.push("Doplňte IČO prodávajícího.");
  if (!d.date) out.push("Doplňte datum prodeje.");
  const filled = filledItems(d.items);
  if (filled.length === 0) out.push("Přidejte aspoň jednu položku (zboží nebo službu) s cenou.");
  else if (filled.some((i) => !i.name.trim())) out.push("U každé položky uveďte, o jaké zboží nebo službu jde.");
  else if (filled.some((i) => lineTotal(i) === null)) out.push("U každé položky uveďte platnou cenu (a množství větší než 0).");
  return out;
}

/* ------------------------------------------------------------------ pověření (§ 10) */

export interface Party {
  name: string;
  ico: string;
  eic: string;
  address: string;
}

export interface Authorization {
  principal: Party; // pověřující poplatník – tržba mu plyne
  agent: Party; // pověřený poplatník – tržbu eviduje
  scope: string; // jaké tržby
  place: string; // kde, včetně předložky: „v provozovně …“, „na recepci hotelu …“
  from: string; // ISO datum
  to: string; // ISO datum nebo prázdné = na dobu neurčitou
  handover: string; // jak se předávají peníze a přehledy
  noticeDays: string; // výpovědní lhůta ve dnech
  signPlace: string;
  signDate: string; // ISO
}

const partyLines = (role: string, p: Party) =>
  [
    `${role}:`,
    p.name.trim() || "⟨jméno a příjmení / název⟩",
    `IČO: ${p.ico.trim() || "⟨IČO⟩"}`,
    `Evidenční identifikační číslo (DIČ): ${p.eic.trim() || "⟨DIČ⟩"}`,
    `Sídlo / místo podnikání: ${p.address.trim() || "⟨adresa⟩"}`,
  ].join("\n");

/** Text pověření jako prostý text (tisk, kopírování). Prázdná pole zůstávají jako ⟨…⟩, aby šla doplnit ručně. */
export function authorizationText(a: Authorization): string {
  const from = a.from ? formatCzDate(a.from) : "⟨datum⟩";
  const period = a.to ? `od ${from} do ${formatCzDate(a.to)}` : `od ${from} na dobu neurčitou`;
  const notice = a.noticeDays.trim() || "30";
  return [
    "POVĚŘENÍ K EVIDOVÁNÍ TRŽEB",
    "podle § 10 zákona č. 180/2026 Sb., o evidenci tržeb",
    "",
    partyLines("Pověřující poplatník", a.principal),
    "",
    partyLines("Pověřený poplatník", a.agent),
    "",
    `1. Pověřující poplatník pověřuje pověřeného poplatníka, aby za něj evidoval tyto evidované tržby: ${a.scope.trim() || "⟨jaké tržby, např. platby za masáže⟩"}, přijímané ${a.place.trim() || "⟨kde, např. v provozovně na adrese …⟩"}.`,
    `2. Pověření platí ${period}.`,
    "3. Pověřený poplatník bude tyto tržby evidovat na svém pokladním zařízení a v datové zprávě uvede evidenční identifikační číslo pověřujícího poplatníka (§ 17 odst. 2 písm. c) zákona o evidenci tržeb).",
    "4. Pověřený poplatník má v rozsahu pověření povinnost evidovat tržby pověřujícího poplatníka a plní i jeho ostatní povinnosti podle zákona o evidenci tržeb; za jejich porušení odpovídá (§ 10 odst. 1).",
    "5. Strany berou na vědomí, že pověřující poplatník neodpovídá za porušení povinností, které má plnit pověřený poplatník, s výjimkou povinnosti evidovat tržbu (§ 10 odst. 2). Pověřující si proto průběžně kontroluje přehledy evidovaných tržeb.",
    `6. Předávání tržeb a přehledů: ${a.handover.trim() || "⟨např. pověřený předá přijaté tržby a přehled evidovaných tržeb každý týden⟩"}.`,
    `7. Pověření může kterákoli strana písemně vypovědět; pověření zaniká uplynutím ${notice} dnů od doručení výpovědi.`,
    "",
    `V ${a.signPlace.trim() || "⟨místo⟩"} dne ${a.signDate ? formatCzDate(a.signDate) : "⟨datum⟩"}`,
    "",
    "",
    "………………………………………",
    "pověřující poplatník",
    "",
    "",
    "………………………………………",
    "pověřený poplatník",
  ].join("\n");
}
