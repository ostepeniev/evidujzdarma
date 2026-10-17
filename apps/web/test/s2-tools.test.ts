/**
 * S2 B1 (17. 10. 2026): bezplatná ověření a kalkulačky – IČO, DIČ, IBAN, účet ↔ IBAN, datum splatnosti, DPH,
 * úrok z prodlení. Logika (packages/cz, lib/*.ts) a registrace stránek (sitemap, /nastroje, llms.txt, patička).
 * Příklady účtů a IBAN jsou veřejné vzory ČNB a ECBS, ne soukromé účty.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BANK_CODES, bankByCode } from "@ez/cz/bank-codes";
import { czIbanToAccount, formatCzAccount, ibanChecksumOk, isValidCzAccountPart } from "@ez/cz/bank";
import { analyzeDic, checkRodneCislo } from "@ez/cz/dic";
import { addDays, czHolidays, daysBetween, easterSunday, isCzWorkingDay, nextCzWorkingDay, weekdayCs } from "@ez/cz/holidays";
import { dueDate } from "@/lib/due-date";
import { icoFromHash } from "@/lib/ico-param";
import { CNB_REPO_HISTORY, cnbRepoOn, halfYearLabel, halfYearStart, lateInterest, lateInterestRate, lateInterestTable } from "@/lib/late-interest";
import { STATIC_PAGES } from "@/lib/static-pages";
import { absoluteUrl } from "@/lib/site";
import { accountToIban, checkIban, checkIco, fragmentParam } from "@/lib/validators";
import { cashRounding, vatFromBase, vatFromTakings, vatFromTotal, vatFromVat } from "@/lib/vat";
import { pageText } from "./helpers/render-text";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }) }));

const SRC = join(__dirname, "../src");
const src = (p: string) => readFileSync(join(SRC, p), "utf8");
const TODAY = new Date("2026-10-17T12:00:00Z");

const PAGES = [
  ["/nastroje/overeni-ico", "app/(site)/nastroje/overeni-ico/page.tsx", "Ověření IČO"],
  ["/nastroje/overeni-dic", "app/(site)/nastroje/overeni-dic/page.tsx", "Ověření DIČ"],
  ["/nastroje/overeni-iban", "app/(site)/nastroje/overeni-iban/page.tsx", "Ověření IBAN"],
  ["/nastroje/ucet-na-iban", "app/(site)/nastroje/ucet-na-iban/page.tsx", "Číslo účtu na IBAN"],
  ["/nastroje/datum-splatnosti", "app/(site)/nastroje/datum-splatnosti/page.tsx", "Datum splatnosti faktury"],
  ["/kalkulacka-dph", "app/(site)/kalkulacka-dph/page.tsx", "Kalkulačka DPH"],
  ["/kalkulacka-urok-z-prodleni", "app/(site)/kalkulacka-urok-z-prodleni/page.tsx", "Kalkulačka úroku z prodlení"],
] as const;

type PageModule = { default: FC; metadata: { description: string; robots?: unknown } };
const LOAD: Record<(typeof PAGES)[number][0], () => Promise<PageModule>> = {
  "/nastroje/overeni-ico": () => import("@/app/(site)/nastroje/overeni-ico/page") as Promise<PageModule>,
  "/nastroje/overeni-dic": () => import("@/app/(site)/nastroje/overeni-dic/page") as Promise<PageModule>,
  "/nastroje/overeni-iban": () => import("@/app/(site)/nastroje/overeni-iban/page") as Promise<PageModule>,
  "/nastroje/ucet-na-iban": () => import("@/app/(site)/nastroje/ucet-na-iban/page") as Promise<PageModule>,
  "/nastroje/datum-splatnosti": () => import("@/app/(site)/nastroje/datum-splatnosti/page") as Promise<PageModule>,
  "/kalkulacka-dph": () => import("@/app/(site)/kalkulacka-dph/page") as Promise<PageModule>,
  "/kalkulacka-urok-z-prodleni": () => import("@/app/(site)/kalkulacka-urok-z-prodleni/page") as Promise<PageModule>,
};

const COMPONENTS = [
  "components/tools/ico-validator.tsx",
  "components/tools/dic-validator.tsx",
  "components/tools/iban-validator.tsx",
  "components/tools/account-iban-converter.tsx",
  "components/tools/due-date-calculator.tsx",
  "components/tools/vat-calculator.tsx",
  "components/tools/late-interest-calculator.tsx",
  "components/tools/copy-value.tsx",
];

describe("S2 B1 – IČO", () => {
  it("gate: mod 11 with the breakdown (incl. remainders 0, 1 and the padded form)", () => {
    const a = checkIco("12345679");
    expect("error" in a).toBe(false);
    if ("error" in a) return;
    expect(a).toMatchObject({ ok: true, sum: 112, remainder: 2, expected: 9, actual: 9, padded: false });
    expect(a.products.map((p) => p.weight)).toEqual([8, 7, 6, 5, 4, 3, 2]);
    // ČNB (zbytek 1 → 0), MF (bez úvodních nul), zbytek 0 → 1
    expect(checkIco("48136450")).toMatchObject({ ok: true, remainder: 1, expected: 0 });
    expect(checkIco("6947")).toMatchObject({ ok: true, ico: "00006947", padded: true });
    expect(checkIco("00000141")).toMatchObject({ ok: true, remainder: 0, expected: 1 });
    expect(checkIco("12345678")).toMatchObject({ ok: false, expected: 9, actual: 8 });
    expect(checkIco("")).toEqual({ ok: false, error: "empty" });
    expect(checkIco("1234567a")).toEqual({ ok: false, error: "format" });
    expect(checkIco("123456789")).toEqual({ ok: false, error: "format" });
    expect(checkIco("0")).toEqual({ ok: false, error: "zeros" });
  });

  it("gate: the EET link carries the IČO in the fragment; /kontrola-ico reads it", () => {
    expect(icoFromHash("#ico=12345679")).toBe("12345679");
    expect(icoFromHash("#a=1&ico=6947")).toBe("00006947");
    expect(icoFromHash("#ico=12345678")).toBeNull();
    expect(icoFromHash("#icox=12345679")).toBeNull();
    expect(icoFromHash("")).toBeNull();
    expect(src("components/tools/ico-validator.tsx")).toContain("href={`/kontrola-ico#ico=${r.ico}`}");
    expect(src("components/ico-quick-check.tsx")).toContain("icoFromHash(window.location.hash)");
  });
});

describe("S2 B1 – DIČ (§ 130 daňového řádu, § 13 zákona č. 133/2000 Sb.)", () => {
  it("gate: legal person = CZ + IČO with a valid check digit", () => {
    expect(analyzeDic("CZ48136450", TODAY)).toEqual({ ok: true, dic: "CZ48136450", kind: "legal" });
    expect(analyzeDic(" cz 4813 6450 ", TODAY)).toMatchObject({ ok: true, dic: "CZ48136450" });
    expect(analyzeDic("48136450", TODAY)).toMatchObject({ ok: true, kind: "legal" });
    expect(analyzeDic("CZ48136451", TODAY)).toMatchObject({ ok: false, error: "ico-checksum" });
  });

  it("gate: natural person = CZ + rodné číslo (10 digits divisible by 11, +50 / +20 / +70, 9 digits before 1954)", () => {
    expect(analyzeDic("CZ8001010105", TODAY)).toMatchObject({ ok: true, kind: "natural" });
    expect(analyzeDic("CZ8051010110", TODAY)).toMatchObject({ ok: true, kind: "natural" });
    expect(analyzeDic("CZ0471010111", TODAY)).toMatchObject({ ok: true, kind: "natural" });
    expect(analyzeDic("CZ8001010106", TODAY)).toMatchObject({ ok: false, error: "rc-checksum" });
    expect(analyzeDic("CZ8002300100", TODAY)).toMatchObject({ ok: false, error: "rc-date" });
    expect(analyzeDic("CZ3001010111", TODAY)).toMatchObject({ ok: false, error: "rc-date" }); // rok 2030
    expect(checkRodneCislo("530101123", TODAY)).toEqual({ ok: true });
    expect(checkRodneCislo("540101123", TODAY)).toEqual({ ok: false, error: "rc-9-digits" });
    expect(checkRodneCislo("530230123", TODAY)).toEqual({ ok: false, error: "rc-date" });
    expect(checkRodneCislo("530101000", TODAY)).toEqual({ ok: false, error: "rc-date" });
  });

  it("gate: the old exception (remainder 10, check digit 0) is flagged, only up to 1985", () => {
    expect(analyzeDic("CZ6001010060", TODAY)).toEqual({ ok: true, dic: "CZ6001010060", kind: "natural", rcException: true });
    expect(analyzeDic("CZ9001010030", TODAY)).toMatchObject({ ok: false, error: "rc-checksum" });
  });

  it("gate: VČP = 9 digits starting with 6; foreign and malformed inputs", () => {
    expect(analyzeDic("CZ699123456", TODAY)).toEqual({ ok: true, dic: "CZ699123456", kind: "vcp" });
    expect(analyzeDic("SK2020317068", TODAY)).toEqual({ ok: false, dic: null, error: "foreign", country: "SK" });
    expect(analyzeDic("CZ1234567", TODAY)).toMatchObject({ ok: false, error: "format" });
    expect(analyzeDic("CZ12345678901", TODAY)).toMatchObject({ ok: false, error: "format" });
    expect(analyzeDic("", TODAY)).toMatchObject({ ok: false, error: "empty" });
  });

  it("gate: DIČ never leaves the browser – no fetch in the validator, registry only as a link", () => {
    const c = src("components/tools/dic-validator.tsx");
    expect(c).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon/);
    expect(c).toContain("SOURCES.registrDph.url");
  });
});

describe("S2 B1 – IBAN and account ↔ IBAN (ČNB examples, ECBS examples)", () => {
  it("gate: ČNB examples both ways, with the bank from the ČNB list", () => {
    const a = checkIban("CZ65 0800 0000 1920 0014 5399");
    expect(a).toMatchObject({ ok: true, iban: "CZ6508000000192000145399", formatted: "CZ65 0800 0000 1920 0014 5399", country: "CZ" });
    expect(a.ok && a.cz).toMatchObject({ account: "19-2000145399/0800", bankCode: "0800", partsOk: true, bank: { name: "Česká spořitelna, a.s.", bic: "GIBACZPX" } });
    const b = checkIban("cz69 0710 1781 2400 0000 4159");
    expect(b.ok && b.cz).toMatchObject({ account: "178124-4159/0710", bank: { name: "ČESKÁ NÁRODNÍ BANKA" } });
    expect(accountToIban("19-2000145399/0800")).toMatchObject({ ok: true, iban: "CZ6508000000192000145399", formatted: "CZ65 0800 0000 1920 0014 5399" });
    expect(accountToIban(" 178124-4159 / 0710 ")).toMatchObject({ ok: true, iban: "CZ6907101781240000004159", formattedAccount: "178124-4159/0710" });
    expect(accountToIban("000019-2000145399/0800")).toMatchObject({ ok: true, formattedAccount: "19-2000145399/0800" });
  });

  it("gate: errors – checksum, length, prefix and number mod 11 (vyhláška č. 169/2011 Sb.)", () => {
    expect(checkIban("CZ66 0800 0000 1920 0014 5399")).toMatchObject({ ok: false, error: "checksum" });
    expect(checkIban("CZ65 0800 0000 1920 0014 539")).toMatchObject({ ok: false, error: "cz-length" });
    expect(checkIban("CZ65 0800 0000 1920 0014 539A")).toMatchObject({ ok: false, error: "format" });
    expect(checkIban("12 3456")).toMatchObject({ ok: false, error: "format" });
    expect(checkIban("")).toMatchObject({ ok: false, error: "empty" });
    expect(accountToIban("18-2000145399/0800")).toEqual({ ok: false, error: "prefix" });
    expect(accountToIban("19-2000145398/0800")).toEqual({ ok: false, error: "number" });
    expect(accountToIban("2000145399")).toEqual({ ok: false, error: "format" });
    expect(accountToIban("0/0800")).toEqual({ ok: false, error: "zeros" });
    expect(isValidCzAccountPart("19")).toBe(true);
    expect(isValidCzAccountPart("18")).toBe(false);
  });

  it("gate: any country (mod 97) – ECBS examples DE and GB; no CZ details for them", () => {
    expect(checkIban("DE89 3704 0044 0532 0130 00")).toMatchObject({ ok: true, country: "DE", cz: null });
    expect(checkIban("GB82 WEST 1234 5698 7654 32")).toMatchObject({ ok: true, country: "GB", formatted: "GB82 WEST 1234 5698 7654 32" });
    expect(ibanChecksumOk("GB82WEST12345698765433")).toBe(false);
  });

  it("gate: CZ IBAN with a bad inner account is flagged, unknown bank code is null", () => {
    // kontrolní číslice IBAN dopočtené k účtu 19-2000145398/0800, který nesplňuje mod 11
    expect(czIbanToAccount("CZ9208000000192000145398")).toEqual({ prefix: "19", number: "2000145398", bankCode: "0800", partsOk: false });
    expect(checkIban("CZ92 0800 0000 1920 0014 5398")).toMatchObject({ ok: true, cz: { partsOk: false, account: "19-2000145398/0800" } });
    expect(formatCzAccount({ prefix: "", number: "123", bankCode: "0100" })).toBe("123/0100");
    expect(bankByCode("9999")).toBeNull();
    expect(bankByCode("2010")?.name).toBe("Fio banka, a.s.");
    expect(BANK_CODES.length).toBeGreaterThan(40);
  });
});

describe("S2 B1 – due date and holidays (zákon č. 245/2000 Sb., § 605/607 OZ)", () => {
  it("gate: Easter and the holiday list 2026–2027", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    const h26 = czHolidays(2026).map((h) => h.date);
    expect(h26).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-06",
      "2026-05-01",
      "2026-05-08",
      "2026-07-05",
      "2026-07-06",
      "2026-09-28",
      "2026-10-28",
      "2026-11-17",
      "2026-12-24",
      "2026-12-25",
      "2026-12-26",
    ]);
    expect(czHolidays(2027).filter((h) => /Velk|Velikon/.test(h.name)).map((h) => h.date)).toEqual(["2027-03-26", "2027-03-29"]);
  });

  it("gate: date arithmetic and working days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-06-30", "2026-07-30")).toBe(30);
    expect(weekdayCs("2026-10-17")).toBe("sobota");
    expect(isCzWorkingDay("2026-10-28")).toBe(false);
    expect(nextCzWorkingDay("2026-12-24")).toBe("2026-12-28");
  });

  it("gate: issue date + N days; weekend, holiday, 60+ days, unknown years", () => {
    expect(dueDate("2026-10-01", 14)).toMatchObject({ ok: true, due: "2026-10-15", weekday: "čtvrtek", weekend: false, holiday: null, nextWorking: "2026-10-15" });
    expect(dueDate("2026-10-14", 14)).toMatchObject({ ok: true, due: "2026-10-28", holiday: "Den vzniku samostatného československého státu", nextWorking: "2026-10-29" });
    expect(dueDate("2026-10-03", 14)).toMatchObject({ ok: true, due: "2026-10-17", weekend: true, nextWorking: "2026-10-19", nextWorkingWeekday: "pondělí" });
    expect(dueDate("2026-12-10", 14)).toMatchObject({ ok: true, due: "2026-12-24", nextWorking: "2026-12-28" });
    expect(dueDate("2026-10-01", 61)).toMatchObject({ ok: true, longB2b: true });
    expect(dueDate("2026-10-01", 60)).toMatchObject({ ok: true, longB2b: false });
    expect(dueDate("2031-01-01", 0)).toMatchObject({ ok: true, holidaysUnknown: true, holiday: null });
    expect(dueDate("2026-02-30", 14)).toEqual({ ok: false, error: "date" });
    expect(dueDate("2026-10-01", 1.5)).toEqual({ ok: false, error: "days" });
    expect(dueDate("2026-10-01", -1)).toEqual({ ok: false, error: "days" });
  });

  it("gate: the due date links to the interest calculator through the fragment", () => {
    expect(src("components/tools/due-date-calculator.tsx")).toContain("href={`/kalkulacka-urok-z-prodleni#splatnost=${r.due}`}");
    expect(fragmentParam("#splatnost=2026-10-31", "splatnost")).toBe("2026-10-31");
    expect(fragmentParam("#a=1&splatnost=2026-10-31", "splatnost")).toBe("2026-10-31");
    expect(fragmentParam("#a=1", "splatnost")).toBeNull();
  });
});

describe("S2 B1 – VAT (§ 37 a § 47 zákona č. 235/2004 Sb.)", () => {
  it("gate: FS example 200 000 / 242 000 both ways", () => {
    expect(vatFromBase(200_000, 21)).toEqual({ base: 200_000, vat: 42_000, total: 242_000, rate: 21 });
    expect(vatFromTotal(242_000, 21)).toEqual({ base: 200_000, vat: 42_000, total: 242_000, rate: 21 });
  });

  it("gate: rounding to haléře (half up), both rates, from the VAT amount", () => {
    expect(vatFromTotal(100, 21)).toEqual({ base: 82.64, vat: 17.36, total: 100, rate: 21 });
    expect(vatFromTotal(100, 12)).toEqual({ base: 89.29, vat: 10.71, total: 100, rate: 12 });
    expect(vatFromBase(99.99, 21)).toEqual({ base: 99.99, vat: 21, total: 120.99, rate: 21 });
    expect(vatFromBase(0.1, 12)).toEqual({ base: 0.1, vat: 0.01, total: 0.11, rate: 12 });
    // 1,26 Kč × 12/112 = 0,135 Kč → přesně polovina haléře, zaokrouhlí se nahoru
    expect(vatFromTotal(1.26, 12)).toEqual({ base: 1.12, vat: 0.14, total: 1.26, rate: 12 });
    expect(vatFromVat(21, 21)).toEqual({ base: 100, vat: 21, total: 121, rate: 21 });
    expect(vatFromTotal(-121, 21)).toEqual({ base: -100, vat: -21, total: -121, rate: 21 });
  });

  it("gate: cash rounding to whole crowns (FS seminar example 78,90 → 79) and takings by rate", () => {
    expect(cashRounding(78.9)).toEqual({ rounded: 79, difference: 0.1 });
    expect(cashRounding(78.49)).toEqual({ rounded: 78, difference: -0.49 });
    expect(cashRounding(78.5)).toEqual({ rounded: 79, difference: 0.5 });
    const t = vatFromTakings([
      { total: 1210, rate: 21 },
      { total: 1120, rate: 12 },
    ]);
    expect(t).toMatchObject({ base: 2000, vat: 330, total: 2330 });
    expect(vatFromTakings([{ total: 0, rate: 21 }, { total: 112, rate: 12 }]).rows).toHaveLength(1);
  });
});

describe("S2 B1 – late-payment interest (NV č. 351/2013 Sb., ČNB 2T repo)", () => {
  it("gate: the ČNB table is sorted and ends with 3,75 % from 19. 6. 2026", () => {
    const dates = CNB_REPO_HISTORY.map(([d]) => d);
    expect([...dates].sort()).toEqual(dates);
    expect(CNB_REPO_HISTORY.at(-1)).toEqual(["2026-06-19", 3.75]);
    expect(cnbRepoOn("2026-06-18")).toBe(3.5);
    expect(cnbRepoOn("2026-06-19")).toBe(3.75);
    expect(cnbRepoOn("2027-01-01")).toBeNull();
  });

  it("gate: the rate for the half-year in which the delay started (repo on its first day + 8 p. b.)", () => {
    expect(halfYearStart("2026-06-30")).toBe("2026-01-01");
    expect(halfYearStart("2026-07-01")).toBe("2026-07-01");
    expect(halfYearLabel("2026-07-01")).toBe("2. pololetí 2026");
    expect(lateInterestRate("2024-01-15")).toEqual({ ok: true, halfYear: "2024-01-01", repo: 6.75, rate: 14.75 });
    expect(lateInterestRate("2024-07-01")).toEqual({ ok: true, halfYear: "2024-07-01", repo: 4.75, rate: 12.75 });
    expect(lateInterestRate("2025-03-01")).toEqual({ ok: true, halfYear: "2025-01-01", repo: 4, rate: 12 });
    expect(lateInterestRate("2025-12-31")).toEqual({ ok: true, halfYear: "2025-07-01", repo: 3.5, rate: 11.5 });
    expect(lateInterestRate("2026-06-30")).toEqual({ ok: true, halfYear: "2026-01-01", repo: 3.5, rate: 11.5 });
    expect(lateInterestRate("2026-07-01")).toEqual({ ok: true, halfYear: "2026-07-01", repo: 3.75, rate: 11.75 });
    expect(lateInterestRate("2014-03-01")).toEqual({ ok: true, halfYear: "2014-01-01", repo: 0.05, rate: 8.05 });
    expect(lateInterestRate("2013-12-31")).toMatchObject({ ok: false, error: "before-2014" });
    expect(lateInterestRate("2027-01-01")).toMatchObject({ ok: false, error: "not-verified" });
    expect(lateInterestTable(2024).map((r) => r.rate)).toEqual([14.75, 12.75, 12, 11.5, 11.5, 11.75]);
  });

  it("gate: interest = principal × rate × days / 365, the rate does not change across half-years", () => {
    expect(lateInterest({ amount: 100_000, dueDate: "2026-06-30", paidDate: "2026-07-30" })).toEqual({
      ok: true,
      firstDay: "2026-07-01",
      days: 30,
      halfYear: "2026-07-01",
      repo: 3.75,
      rate: 11.75,
      interest: 965.75,
      perDay: 32.19,
    });
    // prodlení od 1. 1. 2026 přes dvě pololetí – celé za 11,5 %
    expect(lateInterest({ amount: 100_000, dueDate: "2025-12-31", paidDate: "2026-07-31" })).toMatchObject({ ok: true, days: 212, rate: 11.5, interest: 6679.45 });
    expect(lateInterest({ amount: 12_345.67, dueDate: "2024-02-29", paidDate: "2024-03-01" })).toMatchObject({ ok: true, days: 1, rate: 14.75, interest: 4.99 });
    expect(lateInterest({ amount: 1000, dueDate: "2026-10-15", paidDate: "2026-10-15" })).toEqual({ ok: false, error: "no-delay" });
    expect(lateInterest({ amount: 0, dueDate: "2026-10-15", paidDate: "2026-10-20" })).toEqual({ ok: false, error: "input" });
    expect(lateInterest({ amount: 1000, dueDate: "2026-12-31", paidDate: "2027-01-20" })).toMatchObject({ ok: false, error: "not-verified", halfYear: "2027-01-01" });
  });

  it("gate: 1 200 Kč minimum costs and the sources are on the page", () => {
    const facts = src("content/facts.ts");
    expect(facts).toContain("https://www.zakonyprolidi.cz/cs/2013-351");
    expect(facts).toContain("https://www.cnb.cz/cs/casto-kladene-dotazy/Jak-se-vyvijela-dvoutydenni-repo-sazba-CNB/");
    expect(src("lib/late-interest.ts")).toContain("export const MIN_RECOVERY_COSTS = 1200;");
  });
});

describe("S2 B1 – pages and registration (COMMON 4)", () => {
  it("gate: STATIC_PAGES, /nastroje (group Kalkulačky a ověření), llms.txt, footer", async () => {
    const hub = src("app/(site)/nastroje/page.tsx");
    expect(hub).toContain('id="kalkulacky"');
    expect(hub).toContain("Kalkulačky a ověření");
    const { llmsTxt } = await import("@/lib/llms");
    const llms = llmsTxt();
    for (const [path] of PAGES) {
      const page = STATIC_PAGES.find((p) => p.path === path);
      expect(page, path).toBeTruthy();
      expect(page!.modified, path).toBe("2026-10-17");
      expect(hub, path).toContain(`href: "${path}"`);
      expect(llms, path).toContain(absoluteUrl(path));
    }
    expect(src("components/site-footer.tsx")).toContain('href: "/nastroje#kalkulacky"');
  });

  it("gate: every page renders – h1, FAQ JSON-LD with 3–5 questions, sources, related guides, CTA; description 120–160", async () => {
    for (const [path, , h1] of PAGES) {
      const mod = await LOAD[path]();
      const html = renderToStaticMarkup(createElement(mod.default));
      const text = pageText(mod.default);
      expect(text, path).toContain(h1);
      const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .flatMap((m) => [JSON.parse(m[1]!)].flat())
        .find((d: { "@type"?: string }) => d["@type"] === "FAQPage") as { mainEntity: unknown[] } | undefined;
      expect(faq, path).toBeTruthy();
      expect(faq!.mainEntity.length, path).toBeGreaterThanOrEqual(3);
      expect(faq!.mainEntity.length, path).toBeLessThanOrEqual(5);
      expect(text, path).toContain("Zdroje:");
      expect(text, path).toContain("Související návody");
      expect(text, path).toContain("Předregistrovat zdarma");
      expect(mod.metadata.robots, path).toBeUndefined();
      expect(mod.metadata.description.length, path).toBeGreaterThanOrEqual(120);
      expect(mod.metadata.description.length, path).toBeLessThanOrEqual(160);
    }
  });

  it("gate: key facts on the pages (VAT rates, EET note, interest table, holidays)", async () => {
    const t = async (path: keyof typeof LOAD) => pageText((await LOAD[path]()).default);
    const dph = await t("/kalkulacka-dph");
    expect(dph).toContain("Základní sazba 21 % a snížená sazba 12 %");
    expect(dph).toContain("Do EET 2.0 se eviduje skutečně přijatá částka");
    const urok = await t("/kalkulacka-urok-z-prodleni");
    expect(urok).toContain("2. pololetí 2026");
    expect(urok).toContain("11,75 %");
    expect(urok).toContain("1 200 Kč");
    const splatnost = await t("/nastroje/datum-splatnosti");
    expect(splatnost).toContain("3. 4. 2026");
    expect(splatnost).toContain("29. 3. 2027");
    expect(splatnost).toContain("§ 607");
    const dic = await t("/nastroje/overeni-dic");
    expect(dic).toContain("Registru DPH");
  });

  it("gate: no browser storage, no IČO in a query string, no external calls in the new components", () => {
    for (const f of COMPONENTS) {
      const c = src(f);
      expect(c, f).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
      expect(c, f).not.toMatch(/\?ico=/);
      expect(c, f).not.toMatch(/fetch\(/);
    }
    for (const [, file] of PAGES) expect(src(file), file).not.toMatch(/\?ico=/);
  });
});
