/**
 * Kódy platebního styku v ČR (kód banky ve tvaru „číslo/kód“) → název poskytovatele a BIC.
 * Zdroj: ČNB, Číselník kódů platebního styku v ČR č. 255 platný od 1. 10. 2026
 * (https://www.cnb.cz/cs/platebni-styk/ucty-kody-bank/, CSV staženo 17. 10. 2026). Při novém číselníku přepište tabulku
 * a BANK_CODES_VALID_FROM.
 */

export const BANK_CODES_VALID_FROM = "2026-10-01";
export const BANK_CODES_SOURCE = {
  label: "ČNB: Číselník kódů platebního styku v ČR (č. 255, platný od 1. 10. 2026)",
  url: "https://www.cnb.cz/cs/platebni-styk/ucty-kody-bank/",
} as const;

export interface BankInfo {
  code: string;
  name: string;
  /** BIC (SWIFT); některé subjekty ho v číselníku nemají */
  bic: string | null;
}

const ROWS: readonly (readonly [string, string, string | null])[] = [
  ["0100", "Komerční banka, a.s.", "KOMBCZPP"],
  ["0300", "Československá obchodní banka, a. s.", "CEKOCZPP"],
  ["0600", "MONETA Money Bank, a.s.", "AGBACZPP"],
  ["0710", "ČESKÁ NÁRODNÍ BANKA", "CNBACZPP"],
  ["0800", "Česká spořitelna, a.s.", "GIBACZPX"],
  ["2010", "Fio banka, a.s.", "FIOBCZPP"],
  ["2060", "Citfin, spořitelní družstvo", "CITFCZPP"],
  ["2070", "TRINITY BANK a.s.", "MPUBCZPP"],
  ["2100", "ČSOB Hypoteční banka, a.s.", null],
  ["2200", "Peněžní dům, spořitelní družstvo", null],
  ["2220", "Artesa, spořitelní družstvo", "ARTTCZPP"],
  ["2250", "Banka CREDITAS a.s.", "CTASCZ22"],
  ["2600", "Citibank Europe plc, organizační složka", "CITICZPX"],
  ["2700", "UniCredit Bank Czech Republic and Slovakia, a.s.", "BACXCZPP"],
  ["3030", "Air Bank a.s.", "AIRACZPP"],
  ["3060", "PKO BP S.A., Czech Branch", "BPKOCZPP"],
  ["3500", "ING Bank N.V.", "INGBCZPP"],
  ["4300", "Národní rozvojová banka, a.s.", "NROZCZPP"],
  ["5500", "Raiffeisenbank a.s.", "RZBCCZPP"],
  ["5800", "J&T BANKA, a.s.", "JTBPCZPP"],
  ["6000", "PPF banka a.s.", "PMBPCZPP"],
  ["6200", "COMMERZBANK Aktiengesellschaft, pobočka Praha", "COBACZPX"],
  ["6210", "mBank S.A., organizační složka", "BREXCZPP"],
  ["6300", "BNP Paribas S.A., pobočka Česká republika", "GEBACZPP"],
  ["6363", "Partners Banka, a.s.", "PTBNCZPP"],
  ["6600", "Banking Circle S.A., Czech Republic", null],
  ["6700", "Všeobecná úverová banka a.s., pobočka Praha", "SUBACZPP"],
  ["6800", "Sberbank CZ, a.s. v likvidaci", "VBOECZ2X"],
  ["7910", "Deutsche Bank Aktiengesellschaft Filiale Prag, organizační složka", "DEUTCZPX"],
  ["7950", "Raiffeisen stavební spořitelna a.s.", null],
  ["7960", "ČSOB Stavební spořitelna, a.s.", null],
  ["7970", "MONETA Stavební Spořitelna, a.s.", null],
  ["7990", "Modrá pyramida stavební spořitelna, a.s.", null],
  ["8030", "Volksbank Raiffeisenbank Nordoberpfalz eG pobočka Cheb", "GENOCZ21"],
  ["8040", "Oberbank AG pobočka Česká republika", "OBKLCZ2X"],
  ["8060", "Stavební spořitelna České spořitelny, a.s.", null],
  ["8090", "Česká exportní banka, a.s.", "CZEECZPP"],
  ["8150", "HSBC Continental Europe, Czech Republic", "MIDLCZPP"],
  ["8198", "FAS finance company s.r.o.", "FFCSCZP1"],
  ["8220", "Payment execution s.r.o.", "PAERCZP1"],
  ["8250", "Bank of China (CEE) Ltd. Prague Branch", "BKCHCZPP"],
  ["8255", "Bank of Communications Co., Ltd., Prague Branch odštěpný závod", "COMMCZPP"],
  ["8265", "Industrial and Commercial Bank of China Limited, Prague Branch, odštěpný závod", "ICBKCZPP"],
  ["8500", "Multitude Bank p.l.c.", null],
  ["8610", "Devizová burza a.s.", null],
  ["8620", "Comgate a.s.", null],
  ["8660", "PAYMONT, UAB", null],
];

const BY_CODE = new Map<string, BankInfo>(ROWS.map(([code, name, bic]) => [code, { code, name, bic }]));

/** Poskytovatel podle čtyřmístného kódu banky, nebo null, není-li kód v číselníku. */
export function bankByCode(code: string): BankInfo | null {
  return BY_CODE.get(code.trim()) ?? null;
}

export const BANK_CODES: readonly BankInfo[] = [...BY_CODE.values()];
