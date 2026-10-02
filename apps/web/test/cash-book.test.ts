import { describe, expect, it } from "vitest";
import { buildCashBook, cashBookCsv, DeviceClosingSchema } from "@/lib/server/closings";

const totals = (o: Partial<Record<string, unknown>> = {}) => ({
  salesCount: 3,
  refundsCount: 0,
  gross: 100000,
  refundsTotal: 0,
  byMethod: { cash: 60000, card: 40000, qr: 0, transfer: 0, voucher: 0 },
  tips: 0,
  discounts: 0,
  evidencedTotal: 100000,
  notEvidencedTotal: 0,
  openingCash: 200000,
  cashSales: 60000,
  deposits: 10000,
  withdrawals: 20000,
  expectedCash: 250000,
  countedCash: 245000,
  difference: -5000,
  cashOut: 145000,
  closingCash: 100000,
  pending: 0,
  rejected: 0,
  firstSequence: "P1-000001",
  lastSequence: "P1-000003",
  ...o,
});

const row = (n: number, from: string | null, at: string, t: ReturnType<typeof totals>) => ({
  id: `c${n}`,
  accountId: "a",
  deviceId: "d",
  registerId: "P1",
  number: n,
  periodFrom: from ? new Date(from) : null,
  closedAt: new Date(at),
  openingCash: t.openingCash,
  expectedCash: t.expectedCash,
  countedCash: t.countedCash,
  difference: t.difference,
  cashOut: t.cashOut,
  closingCash: t.closingCash,
  totals: t,
  denominations: null,
  note: n === 1 ? "chyběla mince" : null,
  staffId: null,
  staffName: "Jana",
  mode: "production",
  createdAt: new Date(at),
});

const mv = (id: string, at: string, type: "deposit" | "withdrawal", amount: number) => ({
  id,
  accountId: "a",
  deviceId: "d",
  registerId: "P1",
  at: new Date(at),
  type,
  amount,
  note: null,
  staffId: null,
  staffName: "Jana",
  createdAt: new Date(at),
});

describe("cash book", () => {
  it("chains closings into a running balance", () => {
    const c1 = row(1, "2027-01-14T23:00:00Z", "2027-01-15T17:00:00Z", totals());
    // druhý den: počáteční stav = zůstatek předchozí uzávěrky, bez rozdílu a odvodu
    const t2 = totals({ openingCash: 100000, cashSales: 30000, deposits: 0, withdrawals: 0, expectedCash: 130000, countedCash: 130000, difference: 0, cashOut: 0, closingCash: 130000 });
    const c2 = row(2, "2027-01-15T17:00:00Z", "2027-01-16T17:00:00Z", t2);
    const rows = buildCashBook([c1, c2], [mv("m1", "2027-01-15T08:00:00Z", "deposit", 10000), mv("m2", "2027-01-15T12:00:00Z", "withdrawal", 20000)]);
    expect(rows.map((r) => r.text)).toEqual([
      "Počáteční stav pokladny",
      "Vklad",
      "Výběr",
      "Tržby v hotovosti (doklady P1-000001–P1-000003)",
      "Manko při uzávěrce",
      "Odvod hotovosti při uzávěrce",
      "Tržby v hotovosti (doklady P1-000001–P1-000003)",
    ]);
    // zůstatek po 1. uzávěrce = spočítáno − odvod; po 2. = 1000 + 300 Kč
    expect(rows[5]!.balance).toBe(100000);
    expect(rows.at(-1)!.balance).toBe(130000);
    const csv = cashBookCsv(rows);
    expect(csv.startsWith("\uFEFFDatum a čas;Pokladna")).toBe(true);
    expect(csv).toContain("Manko při uzávěrce;;50,00;");
  });

  it("flags an opening balance that does not follow the previous closing", () => {
    const c1 = row(1, "2027-01-14T23:00:00Z", "2027-01-15T17:00:00Z", totals());
    const t2 = totals({ openingCash: 90000, cashSales: 0, deposits: 0, withdrawals: 0, expectedCash: 90000, countedCash: 90000, difference: 0, cashOut: 0, closingCash: 90000 });
    const rows = buildCashBook([c1, row(2, "2027-01-15T17:00:00Z", "2027-01-16T17:00:00Z", t2)], []);
    // první uzávěrka hlásí vklady/výběry, které na serveru nejsou → vyrovnání na zůstatek
    expect(rows.find((r) => r.text.startsWith("Vklady/výběry podle uzávěrky"))?.expense).toBe(10000);
    const adj = rows.find((r) => r.text.startsWith("Úprava počátečního stavu"));
    expect(adj?.expense).toBe(10000);
    expect(rows.at(-1)!.balance).toBe(90000);
  });

  it("rejects internally inconsistent closings from devices", () => {
    const base = { id: "3f2a8c1e-6b7d-4c2a-9e1f-0a1b2c3d4e5f", number: 1, periodFrom: null, closedAt: "2027-01-15T17:00:00Z", mode: "production" as const };
    expect(DeviceClosingSchema.safeParse({ ...base, totals: totals() }).success).toBe(true);
    // pokladna se starší verzí neposílá nové způsoby platby (R5.10) → doplní se nulou
    const legacy = DeviceClosingSchema.safeParse({ ...base, totals: totals() });
    expect(legacy.success && legacy.data.totals.byMethod).toMatchObject({ meal_voucher: 0, credit: 0, gift_voucher: 0 });
    expect(DeviceClosingSchema.safeParse({ ...base, totals: totals({ difference: 0 }) }).success).toBe(false);
    expect(DeviceClosingSchema.safeParse({ ...base, totals: totals({ closingCash: 1 }) }).success).toBe(false);
  });
});
