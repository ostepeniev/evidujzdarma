/**
 * S3-POKLADNA (17. 10. 2026) – opravy pokladny nalezené při psaní nápovědy (S2-A):
 *  1. QR platba: variabilní symbol jiný pro každý doklad (z čísla dokladu), SPAYD max. 10 číslic VS;
 *  2. dobití kreditu (čip, předplacená karta) jako položka s částkou určenou k čerpání (Ф11);
 *  3. částečná vratka, vratka dokladu z jiné pokladny účtu (dohledání na serveru), bez lhůty 7 dní;
 *  4. automatické zamčení po 15 minutách nečinnosti i v otevřené aplikaci;
 *  5. úprava jednotky (název, adresa), položky katalogu (název, cena, DPH, rychlé tlačítko) a záhlaví účtenky;
 *  6. ověřovací tržba za vybranou nebo každou evidenční jednotku;
 *  7. text „Odeslat ověřovací tržbu“ jednotně;
 *  8. dny v pražském čase (kabinet, přehled, uzávěrka);
 *  + katalog: kategorie a kód / EAN se ukládají, strop 5 000 položek i u ručního přidání.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildEetMessage, buildSale, evidencedAmounts, type Payment, type SaleLine } from "@ez/fiscal-core";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSpayd } from "@ez/cz/spayd";
import { hashPin } from "@/lib/pos/pin";
import { IDLE_CHECK_MS, AUTO_LOCK_MS, watchIdle } from "@/lib/pos/idle-lock";
import { catalogMatches } from "@/lib/pos/catalog-search";
import { posQrPayload, qrPaymentMessage, qrVariableSymbol } from "@/lib/pos/qr-payment";
import { fullSelection, refundCapacityIssue, refundPayments, refundableLines } from "@/lib/pos/refund";
import { refundDraft, refundRemaining, refundSourceFromLocal, refundSourceFromServer, refundUnavailableReason } from "@/lib/pos/sale-factory";
import { IMPORT_LIMITS, buildPreview, readImportFile } from "@/lib/pos/import-products";
import { pragueDayStart, pragueToday } from "@/lib/prague-time";
import type { LocalSale, PosConfig } from "@/lib/pos/types";
import { ingestSales } from "@/lib/server/sales";
import { findSaleForRefund } from "@/lib/server/refund-lookup";
import { verifyStaffPinOnline } from "@/lib/server/staff-pin";
import { sha256 } from "@/lib/server/tokens";
import { CatalogImportInput, CatalogInput, CatalogPatch, UnitPatch } from "@/lib/server/schemas";
import { deviceContext, deviceSale, seedAccount } from "./helpers/fixtures";
import { createTestDb, type TestDb } from "./helpers/test-db";

let sessionToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ez_session" && sessionToken ? { value: sessionToken } : undefined) }),
}));

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

/* ───────────── 1. QR platba ───────────── */

describe("S3-POKLADNA 1 – QR payment: a unique variable symbol for every receipt", () => {
  it("gate: VS comes from the receipt number (counter on the device) – two sales never share it; ≤ 10 digits", () => {
    const a = qrVariableSymbol("P1-K7Q2-000123");
    const b = qrVariableSymbol("P1-K7Q2-000124");
    expect(a).toBe("172000123");
    expect(b).toBe("172000124");
    expect(a).not.toBe(b);
    // tisíce dokladů jednoho zařízení – všechny jiné, vždy 1–10 číslic
    const all = Array.from({ length: 5000 }, (_, i) => qrVariableSymbol(`KASA12-AB34-${String(i + 1).padStart(6, "0")}`));
    expect(new Set(all).size).toBe(5000);
    for (const v of all) expect(v).toMatch(/^\d{1,10}$/);
    // prefix bez číslic, dlouhý čítač
    expect(qrVariableSymbol("P-ABCD-000001")).toBe("000001");
    expect(qrVariableSymbol("P99-1234-12345678901")).toMatch(/^\d{10}$/);
  });

  it("gate: SPAYD has X-VS and the receipt number in MSG (before the name, never cut off)", () => {
    const spd = posQrPayload({ iban: "CZ6508000000192000145399", amount: 12350, sequence: "P1-K7Q2-000123", merchantName: "Kadeřnictví Jana s velmi dlouhým názvem firmy, který se nevejde" });
    expect(spd.startsWith("SPD*1.0*ACC:CZ6508000000192000145399*AM:123.50*CC:CZK*")).toBe(true);
    expect(spd).toContain("*X-VS:172000123");
    expect(spd).toMatch(/\*MSG:P1-K7Q2-000123 Kaderni/);
    expect(qrPaymentMessage("P1-K7Q2-000123", "x".repeat(100)).length).toBe(60);
    // SPAYD sám VS nad 10 číslic odmítne
    expect(() => buildSpayd({ account: "CZ6508000000192000145399", variableSymbol: "12345678901" })).toThrow(/1–10 číslic/);
  });

  it("gate: the payment sheet builds the QR from the next receipt number, not from the device prefix", () => {
    const sheet = src("components/pos/payment-sheet.tsx");
    expect(sheet).toMatch(/posQrPayload\(\{[^}]*sequence: qrSequence/);
    expect(sheet).not.toMatch(/sequenceHint/);
    const app = src("components/pos/pos-app.tsx");
    expect(app).toMatch(/peekSequence\(device\.sequencePrefix\)/);
    expect(app).not.toMatch(/sequenceHint=\{device\.sequencePrefix\}/);
  });
});

/* ───────────── 2. Dobití kreditu ───────────── */

describe("S3-POKLADNA 2 – credit top-up (Ф11)", () => {
  const base = { id: randomUUID(), deviceId: "d", registerId: "P1", unitId: "303", sequence: "P1-1", soldAt: "2027-01-15T10:30:00.000Z", vatPayer: true, mode: "test" as const };
  it("gate: a top-up line goes to celk_trzba and urceno_cerp_zuct; paying with credit later is cerp_zuct", () => {
    const topUp = buildSale({ ...base, lines: [{ name: "Dobití kreditu", qty: 1, unitPrice: 50000, vatRate: 0, kind: "prepayment" }], payments: [{ method: "cash", amount: 50000 }] });
    const d = buildEetMessage(topUp, { eic: "CZ00000019", messageUuid: randomUUID(), sentAt: new Date("2027-01-15T10:30:05Z"), firstAttempt: true, verifyOnly: false }).data;
    expect(d).toMatchObject({ celk_trzba: "500.00", urceno_cerp_zuct: "500.00" });
    expect(d.cerp_zuct).toBeUndefined();
    const use = evidencedAmounts({ lines: [{ name: "Střih", qty: 1, unitPrice: 35000, vatRate: 21 }], payments: [{ method: "credit", amount: 35000 }] });
    expect(use).toEqual({ total: 35000, prepayment: 0, redeemed: 35000 });
  });

  it("gate: the register offers the top-up (kind prepayment) and the payment sheet hides Kredit/Dárkový for it", () => {
    const reg = src("components/pos/register-screen.tsx");
    expect(reg).toContain("Dobití kreditu (čip, předplacená karta)");
    expect(reg).toMatch(/kind: "prepayment"/);
    // stejná částka jako zboží a jako dobití jsou dvě různé položky
    expect(reg).toMatch(/c\.kind === line\.kind/);
    expect(src("components/pos/payment-sheet.tsx")).toMatch(/noCredit && \(m === "credit" \|\| m === "gift_voucher"\)/);
    expect(src("components/pos/pos-app.tsx")).toMatch(/noCredit=\{!paying\.refund && cart\.some\(\(l\) => l\.kind === "prepayment"\)\}/);
  });

  it("gate: the help no longer says the top-up is missing and describes the real buttons", async () => {
    const { getHelpArticle } = await import("@/content/napoveda");
    const text = JSON.stringify(getHelpArticle("poukazy-kredit-zalohy"));
    expect(text).not.toMatch(/zatím nenabízí/);
    expect(text).toContain("**Dobití kreditu (čip, předplacená karta)**");
    expect(text).toContain("**+ Přidat dobití kreditu**");
    expect(src("components/pos/register-screen.tsx")).toContain("+ Přidat dobití kreditu");
  });
});

/* ───────────── 3. Vratky – čistá logika ───────────── */

const L = (name: string, qty: number, unitPrice: number, vatRate = 21): SaleLine => ({ name, qty, unitPrice, vatRate });

describe("S3-POKLADNA 3 – partial refunds (pure logic)", () => {
  const original = { lines: [L("Střih", 2, 35000), L("Šampon", 1, 15000)], payments: [{ method: "cash", amount: 85000 }] as Payment[], tip: 0, subtotal: 85000 };

  it("remaining quantities subtract earlier refunds (also from other devices)", () => {
    const rows = refundableLines(original.lines, [{ lines: [{ ...L("Střih", -1, 35000) }] }]);
    expect(rows.map((r) => [r.line.name, r.remainingQty, r.refundedQty])).toEqual([
      ["Střih", 1, 1],
      ["Šampon", 1, 0],
    ]);
    expect(fullSelection(rows)).toEqual({ 0: 1, 1: 1 });
  });

  it("gate: refund payments mirror only what is left – the last refund returns exactly the rest (rounding never exceeds)", () => {
    // poměr 1 : 1 a vratky po 1 haléři: proporční zaokrouhlení by vrátilo 2 Kč hotově z 1 Kč
    const o = { payments: [{ method: "cash", amount: 1 }, { method: "gift_voucher", amount: 1 }] as Payment[], tip: 0, subtotal: 2 };
    const first = refundPayments(o, [], -1);
    const second = refundPayments(o, [{ payments: first }], -1);
    const sum = (m: string) => [...first, ...second].filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);
    expect(sum("cash")).toBe(-1);
    expect(sum("gift_voucher")).toBe(-1);
    // tři třetiny: dohromady přesně originál
    const p3 = { payments: [{ method: "card", amount: 10000 }, { method: "meal_voucher", amount: 5000 }] as Payment[], tip: 0, subtotal: 15000 };
    const r1 = refundPayments(p3, [], -5000);
    const r2 = refundPayments(p3, [{ payments: r1 }], -5000);
    const r3 = refundPayments(p3, [{ payments: r1 }, { payments: r2 }], -5000);
    const all = [...r1, ...r2, ...r3];
    expect(all.filter((p) => p.method === "card").reduce((s, p) => s + p.amount, 0)).toBe(-10000);
    expect(all.filter((p) => p.method === "meal_voucher").reduce((s, p) => s + p.amount, 0)).toBe(-5000);
  });

  it("a swapped method in an earlier refund (card → cash) is taken from the shared pool", () => {
    const o = { payments: [{ method: "card", amount: 10000 }] as Payment[], tip: 0, subtotal: 10000 };
    const rest = refundPayments(o, [{ payments: [{ method: "cash", amount: -4000 }] }], -6000);
    expect(rest).toEqual([{ method: "card", amount: -6000 }]);
  });

  it("gate: capacity – quantities, money, evidenced amount and credit of all refunds together never exceed the original", () => {
    const orig = { items: original.lines, total: 85000, evidencedTotal: 85000, redeemedAmount: 0 };
    const r = (lines: SaleLine[]) => ({ items: lines, total: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), evidencedTotal: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), redeemedAmount: 0 });
    expect(refundCapacityIssue(orig, [], r([L("Střih", -1, 35000)]))).toBeNull();
    expect(refundCapacityIssue(orig, [r([L("Střih", -1, 35000)])], r([L("Střih", -1, 35000), L("Šampon", -1, 15000)]))).toBeNull();
    expect(refundCapacityIssue(orig, [r([L("Střih", -2, 35000)])], r([L("Střih", -1, 35000)]))?.code).toBe("REFUND_EXCEEDS");
    expect(refundCapacityIssue(orig, [], r([L("Kondicionér", -1, 15000)]))?.code).toBe("REFUND_EXCEEDS");
    expect(refundCapacityIssue(orig, [r([L("Střih", -2, 35000), L("Šampon", -1, 15000)])], r([L("Šampon", -1, 15000)]))).toMatchObject({ code: "REFUND_DUPLICATE", httpStatus: 409 });
    expect(refundCapacityIssue({ ...orig, evidencedTotal: 50000 }, [r([L("Střih", -1, 35000)])], r([L("Střih", -1, 35000)]))?.code).toBe("REFUND_EXCEEDS");
  });

  it("gate: a refund draft from a selection – only selected items, negative quantities, mirrored payments", () => {
    const local = { id: randomUUID(), sequence: "P1-X-000001", soldAt: new Date().toISOString(), unitId: "u1", unitLabel: "Salon", mode: "mock", status: "confirmed", refundOf: null, lines: original.lines, payments: original.payments, discount: 0, tip: 0, vat: null } as unknown as LocalSale;
    const source = refundSourceFromLocal(local, []);
    const draft = refundDraft(source, { 0: 1 });
    expect(draft.lines).toEqual([L("Střih", -1, 35000)]);
    expect(draft.total).toBe(-35000);
    expect(draft.payments).toEqual([{ method: "cash", amount: -35000 }]);
    expect(refundRemaining(source)).toBe(85000);
    const config = { units: [{ id: "u1", label: "Salon", type: "stala_provozovna", fsUnitId: 303, active: true, address: null }, { id: "u2", label: "Stánek", type: "mobilni_provozovna", fsUnitId: 304, active: true, address: null }] } as Pick<PosConfig, "units">;
    expect(refundUnavailableReason(source, config, "u1")).toBeNull();
    expect(refundUnavailableReason(source, config, "u2")).toMatch(/z evidenční jednotky Salon/);
    const done = refundSourceFromLocal(local, [{ ...local, id: randomUUID(), refundOf: local.id, lines: [L("Střih", -2, 35000), L("Šampon", -1, 15000)], total: -85000 } as LocalSale]);
    expect(refundUnavailableReason(done, config, "u1")).toBe("Doklad už byl celý vrácen.");
  });

  it("a server lookup merges refunds known to the server and to the device without duplicates", () => {
    const refundId = randomUUID();
    const s = refundSourceFromServer(
      {
        sale: { id: "o", sequence: "P2-Y-000009", soldAt: new Date().toISOString(), registerId: "P2", unitId: "u1", unitLabel: "Salon", lines: original.lines, payments: original.payments, tip: 0, discount: 0, total: 85000, mode: "mock", status: "confirmed", refundOf: null },
        refunds: [{ id: refundId, sequence: "P2-Y-000010", soldAt: new Date().toISOString(), lines: [L("Šampon", -1, 15000)], payments: [{ method: "cash", amount: -15000 }], total: -15000 }],
      },
      [{ id: refundId, lines: [L("Šampon", -1, 15000)], payments: [{ method: "cash", amount: -15000 }], total: -15000 } as unknown as LocalSale],
    );
    expect(s.remote).toBe(true);
    expect(s.refunds).toHaveLength(1);
    expect(refundRemaining(s)).toBe(70000);
  });

  it("gate: no 7-day limit and partial refunds in the register code; history has the lookup by number", () => {
    const app = src("components/pos/pos-app.tsx");
    expect(app).toMatch(/lookupRefundSale\(/);
    expect(app).toMatch(/<RefundSheet/);
    expect(app).not.toMatch(/refundInput\(/);
    expect(src("components/pos/history-view.tsx")).toMatch(/<RefundLookupForm/);
    expect(src("components/pos/receipt-view.tsx")).toMatch(/refundsOf\(saleId\)/);
  });
});

/* ───────────── 4. Zamčení po nečinnosti ───────────── */

describe("S3-POKLADNA 4 – auto-lock after 15 minutes of inactivity while the app is open", () => {
  function fake() {
    let now = 1_000_000;
    let tick: (() => void) | null = null;
    const target = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const onIdle = vi.fn();
    const stop = watchIdle(target as never, onIdle, {
      now: () => now,
      setInterval: (fn) => ((tick = fn), 1),
      clearInterval: () => (tick = null),
      doc: doc as never,
    });
    return { target, doc, onIdle, stop, advance: (ms: number) => ((now += ms), tick?.()), get running() { return tick !== null; } };
  }

  it("gate: locks after 15 min without touching, even with the app open; activity postpones it", () => {
    const f = fake();
    f.advance(AUTO_LOCK_MS - IDLE_CHECK_MS);
    expect(f.onIdle).not.toHaveBeenCalled();
    f.target.dispatchEvent(new Event("pointerdown"));
    f.advance(AUTO_LOCK_MS - 1);
    expect(f.onIdle).not.toHaveBeenCalled();
    f.advance(1);
    expect(f.onIdle).toHaveBeenCalledTimes(1);
    expect(f.running).toBe(false);
    f.advance(AUTO_LOCK_MS);
    expect(f.onIdle).toHaveBeenCalledTimes(1);
  });

  it("returning to the app after the limit locks at once; a tap after the limit does not keep it open", () => {
    // uspaný prohlížeč interval nespustil – rozhodne návrat do aplikace (visibilitychange)
    let now = 0;
    const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const onIdle = vi.fn();
    const target = new EventTarget();
    watchIdle(target as never, onIdle, { now: () => now, setInterval: () => 1, clearInterval: () => {}, doc: doc as never });
    now = AUTO_LOCK_MS + 1;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(onIdle).toHaveBeenCalledTimes(1);
    // první dotyk po lhůtě pokladnu zamkne, neprodlouží přihlášení
    const onIdle2 = vi.fn();
    const onActivity = vi.fn();
    now = 0;
    watchIdle(target as never, onIdle2, { now: () => now, setInterval: () => 1, clearInterval: () => {}, onActivity });
    now = AUTO_LOCK_MS + 1;
    target.dispatchEvent(new Event("pointerdown"));
    expect(onIdle2).toHaveBeenCalledTimes(1);
    expect(onActivity).not.toHaveBeenCalled();
  });

  it("gate: the register uses the idle watcher (not only the saved login on reopen)", () => {
    const app = src("components/pos/pos-app.tsx");
    expect(app).toMatch(/watchIdle\(\s*window/);
    expect(app).toMatch(/setPhase\("locked"\)/);
  });
});

/* ───────────── 5–8: texty a dny ───────────── */

describe("S3-POKLADNA 5–8 – settings texts, verification per unit, Prague days", () => {
  it("gate 6: the verification sale goes for the chosen unit or for all units (not units[0] only)", () => {
    const setup = src("components/setup/setup-app.tsx");
    expect(setup).not.toMatch(/json: \{ unitId: units\[0\]!\.id \}/);
    expect(setup).toContain("Všechny jednotky");
    expect(setup).toMatch(/for \(const u of targets\)/);
  });

  it("gate 7: the server says the real button name „Odeslat ověřovací tržbu“", () => {
    const account = src("lib/server/account.ts");
    expect(account).not.toMatch(/tlačítko „Ověřit“/);
    expect(account).toContain("„Odeslat ověřovací tržbu“");
    expect(src("components/setup/setup-app.tsx")).toContain("Odeslat ověřovací tržbu");
  });

  it("gate 8: day boundaries in Prague time – no UTC dates in the register, cabinet or settings", () => {
    for (const f of ["components/cabinet/cabinet-app.tsx", "components/pos/history-view.tsx", "components/pos/cash-panel.tsx", "lib/pos/cash.ts", "components/setup/setup-app.tsx", "components/accountant/bulk-check.tsx"]) {
      expect(src(f), f).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
      expect(src(f), f).not.toMatch(/setHours\(0, 0, 0, 0\)/);
    }
    expect(src("components/cabinet/cabinet-app.tsx")).toMatch(/const today = pragueToday\(\)/);
    // 23:30 UTC 17. 10. = 1:30 18. 10. v Praze → den 18. 10., půlnoc 22:00 UTC
    const late = new Date("2026-10-17T23:30:00Z");
    expect(pragueToday(late)).toBe("2026-10-18");
    expect(pragueDayStart(pragueToday(late)).toISOString()).toBe("2026-10-17T22:00:00.000Z");
  });

  it("gate 5: settings can edit unit name/address, catalog items and the receipt header", () => {
    const setup = src("components/setup/setup-app.tsx");
    expect(setup).toMatch(/method: "PATCH", json: \{ label: edit\.label, address:/);
    expect(setup).toMatch(/api\/ucet\/katalog\/\$\{i\.id\}`, \{\s*method: "PATCH"/);
    expect(setup).toContain("Rychlé tlačítko v pokladně");
    expect(setup).toContain("Záhlaví účtenky");
    expect(setup).toMatch(/receiptHeader: form\.receiptHeader\.trim\(\) \|\| null/);
    // validace
    expect(UnitPatch.safeParse({ label: "" }).success).toBe(false);
    expect(UnitPatch.safeParse({ label: "x".repeat(121) }).error?.issues[0]?.message).toBe("Název jednotky má víc než 120 znaků");
    expect(UnitPatch.parse({ address: "  " }).address).toBeNull();
    expect(CatalogPatch.safeParse({ vatRate: 15 }).success).toBe(false);
    expect(CatalogPatch.parse({ category: "  ", ean: "" })).toEqual({ category: null, ean: null });
    expect(CatalogInput.safeParse({ name: "Káva", price: 4500, vatRate: 21, ean: "859 0001" }).success).toBe(false);
    expect(CatalogInput.parse({ name: "Káva", price: 4500, vatRate: 21, ean: "8590001234567", category: "Nápoje" })).toMatchObject({ ean: "8590001234567", category: "Nápoje" });
  });

  it("catalog search matches name, category and the exact code / EAN (barcode scanner)", () => {
    const item = { name: "Espresso", category: "Nápoje", ean: "8590001234567" };
    expect(catalogMatches(item, "espr")).toBe(true);
    expect(catalogMatches(item, "nápoj")).toBe(true);
    expect(catalogMatches(item, "8590001234567")).toBe(true);
    expect(catalogMatches(item, "85900")).toBe(false);
    expect(catalogMatches({ name: "Čaj" }, "káva")).toBe(false);
  });

  it("the import keeps category and code for the server (S2-E said they were dropped)", () => {
    const csv = new TextEncoder().encode("Název;Cena;Kategorie;EAN\nKáva;45;Nápoje;8590001234567\nRohlík;5;;\n");
    const t = readImportFile(csv);
    const p = buildPreview(t, t.mapping, { vatPayer: false });
    expect(p.items).toEqual([
      { name: "Káva", price: 4500, vatRate: 0, category: "Nápoje", ean: "8590001234567" },
      { name: "Rohlík", price: 500, vatRate: 0 },
    ]);
    expect(CatalogImportInput.safeParse({ items: p.items }).success).toBe(true);
    expect(src("components/setup/catalog-import.tsx")).not.toMatch(/neukládají/);
  });
});

/* ───────────── Integrace (PGlite) ───────────── */

describe("S3-POKLADNA – server: partial and cross-device refunds, lookup, catalog (PGlite)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  }, 60_000);
  afterAll(async () => t?.close());
  beforeEach(async () => {
    await t.reset();
    sessionToken = null;
  });

  type R = { id: string; ok: boolean; quarantined?: boolean; code?: string; httpStatus?: number };
  const lines = [L("Střih", 2, 35000), L("Šampon", 1, 15000)];

  async function setup() {
    const s = await seedAccount();
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
    const ctx = await deviceContext(s.device.id);
    const original = deviceSale(s.unit.id, { lines, payments: [{ method: "cash", amount: 85000 }] });
    const [r] = (await ingestSales(ctx, [original as never])) as R[];
    expect(r!.ok).toBe(true);
    return { s, ctx, original };
  }
  async function refund(ctx: Awaited<ReturnType<typeof deviceContext>>, ownerId: string, unitId: string, originalId: string, refundLines: SaleLine[], payments?: Payment[]) {
    const total = refundLines.reduce((s, l) => s + Math.round(l.qty * l.unitPrice), 0);
    const { approval } = await verifyStaffPinOnline(ctx, ownerId, "246813", "refund", { refundOf: originalId, amount: -total });
    const sale = deviceSale(unitId, { lines: refundLines, payments: payments ?? [{ method: "cash", amount: total }], refundOf: originalId, staffId: ownerId, approval });
    const [r] = (await ingestSales(ctx, [sale as never])) as R[];
    return { r: r!, sale };
  }

  it("gate: several partial refunds of one sale; together never more than sold (items and money)", async () => {
    const { s, ctx, original } = await setup();
    expect((await refund(ctx, s.owner.id, s.unit.id, original.id, [L("Střih", -1, 35000)])).r.ok).toBe(true);
    const second = await refund(ctx, s.owner.id, s.unit.id, original.id, [L("Střih", -2, 35000)]);
    expect(second.r).toMatchObject({ ok: false, quarantined: true, code: "REFUND_EXCEEDS" });
    expect((await refund(ctx, s.owner.id, s.unit.id, original.id, [L("Střih", -1, 35000), L("Šampon", -1, 15000)])).r.ok).toBe(true);
    const third = await refund(ctx, s.owner.id, s.unit.id, original.id, [L("Šampon", -1, 15000)]);
    expect(third.r).toMatchObject({ ok: false, quarantined: true, code: "REFUND_DUPLICATE", httpStatus: 409 });
    const stored = await getDb().select().from(schema.sales).where(eq(schema.sales.refundOf, original.id));
    expect(stored.map((x) => x.total).sort()).toEqual([-35000, -50000]);
    // položka, která v originálu není
    const { s: s2, ctx: ctx2, original: o2 } = await setup();
    expect((await refund(ctx2, s2.owner.id, s2.unit.id, o2.id, [L("Kondicionér", -1, 15000)])).r).toMatchObject({ ok: false, code: "REFUND_EXCEEDS" });
  });

  it("gate: two partial refunds racing that together exceed the sale: exactly one is stored", async () => {
    const { s, ctx, original } = await setup();
    const mk = async () => {
      const total = -70000;
      const { approval } = await verifyStaffPinOnline(ctx, s.owner.id, "246813", "refund", { refundOf: original.id, amount: 70000 });
      return deviceSale(s.unit.id, { lines: [L("Střih", -2, 35000)], payments: [{ method: "cash", amount: total }], refundOf: original.id, staffId: s.owner.id, approval });
    };
    const [a, b] = [await mk(), await mk()];
    const out = (await Promise.all([ingestSales(ctx, [a as never]), ingestSales(ctx, [b as never])])).flat() as R[];
    expect(out.filter((r) => r.ok)).toHaveLength(1);
    expect(await getDb().select().from(schema.sales).where(eq(schema.sales.refundOf, original.id))).toHaveLength(1);
  });

  it("gate: a refund from another device of the same account; never across accounts", async () => {
    const { s, original } = await setup();
    const [deviceB] = await getDb()
      .insert(schema.devices)
      .values({ accountId: s.account.id, name: "Mobil", registerId: "P2", sequencePrefix: "P2-TEST-", tokenHash: randomUUID(), unitId: s.unit.id })
      .returning();
    const ctxB = await deviceContext(deviceB!.id);
    const found = await findSaleForRefund(ctxB, original.sequence.toLowerCase());
    expect(found.sale).toMatchObject({ id: original.id, sequence: original.sequence, total: 85000, unitLabel: "Salon", refundOf: null });
    expect(found.sale.lines).toEqual(lines);
    const r = await refund(ctxB, s.owner.id, s.unit.id, original.id, [L("Šampon", -1, 15000)]);
    expect(r.r.ok).toBe(true);
    expect((await getDb().query.sales.findFirst({ where: eq(schema.sales.id, r.sale.id) }))!.deviceId).toBe(deviceB!.id);
    // dohledání vidí i vratku z druhé pokladny – i podle id a odkazu na online účtenku
    const again = await findSaleForRefund(ctxB, `https://evidujzdarma.cz/u/${original.id}`);
    expect(again.refunds.map((x) => x.total)).toEqual([-15000]);
    // jiný účet doklad nenajde a vratku k němu neudělá
    const other = await seedAccount();
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, other.owner.id));
    const ctxOther = await deviceContext(other.device.id);
    await expect(findSaleForRefund(ctxOther, original.sequence)).rejects.toMatchObject({ status: 404 });
    expect((await refund(ctxOther, other.owner.id, other.unit.id, original.id, [L("Střih", -1, 35000)])).r).toMatchObject({ ok: false, code: "REFUND_UNKNOWN_ORIGINAL" });
  });

  it("gate: no 7-day limit – a sale from 40 days ago can still be refunded (negative sale, § 8)", async () => {
    const s = await seedAccount();
    await getDb().update(schema.staff).set({ pinHash: await hashPin("246813") }).where(eq(schema.staff.id, s.owner.id));
    const ctx = await deviceContext(s.device.id);
    const old = deviceSale(s.unit.id, { soldAt: new Date(Math.floor((Date.now() - 40 * 86_400_000) / 1000) * 1000).toISOString() });
    expect(((await ingestSales(ctx, [old as never])) as R[])[0]!.ok).toBe(true);
    expect((await refund(ctx, s.owner.id, s.unit.id, old.id, [L("Střih", -1, 35000)])).r.ok).toBe(true);
  });

  it("gate: GET /api/pokladna/vratka needs the device token and returns the sale with its refunds", async () => {
    const { s, original } = await setup();
    const token = randomBytes(32).toString("base64url");
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    const { GET } = await import("@/app/api/pokladna/vratka/route");
    const get = (q: string, auth = true) => GET(new Request(`http://localhost/api/pokladna/vratka?q=${encodeURIComponent(q)}`, { headers: auth ? { authorization: `Bearer ${token}` } : {} }));
    expect((await get(original.sequence, false)).status).toBe(401);
    const res = await get(original.sequence);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sale: { id: string }; refunds: unknown[] };
    expect(body.sale.id).toBe(original.id);
    expect(body.refunds).toEqual([]);
    expect((await get("P9-NEEXISTUJE-000001")).status).toBe(404);
    expect((await get("")).status).toBe(400);
  });

  it("a top-up sold in the register is stored with urceno_cerp_zuct (prepaymentAmount)", async () => {
    const s = await seedAccount();
    const ctx = await deviceContext(s.device.id);
    const sale = deviceSale(s.unit.id, { lines: [{ name: "Dobití kreditu", qty: 1, unitPrice: 50000, vatRate: 0, kind: "prepayment" }], payments: [{ method: "card", amount: 50000 }] });
    expect(((await ingestSales(ctx, [sale as never])) as R[])[0]!.ok).toBe(true);
    expect(await getDb().query.sales.findFirst({ where: eq(schema.sales.id, sale.id) })).toMatchObject({ evidencedTotal: 50000, prepaymentAmount: 50000, redeemedAmount: 0 });
  });

  async function login() {
    const s = await seedAccount();
    sessionToken = randomUUID();
    await getDb().insert(schema.sessions).values({ tokenHash: sha256(sessionToken), userId: s.user.id, expiresAt: new Date(Date.now() + 3_600_000) });
    return s;
  }
  const req = (url: string, method: string, body: unknown) => {
    const json = JSON.stringify(body);
    return new Request(`http://localhost${url}`, { method, headers: { "content-type": "application/json", origin: "http://localhost", "content-length": String(Buffer.byteLength(json)) }, body: json });
  };

  it("gate: POST /api/ucet/katalog keeps the 5 000 cap; PATCH edits name, price, VAT, quick button, category and EAN", async () => {
    const s = await login();
    const route = await import("@/app/api/ucet/katalog/route");
    const post = async (body: unknown) => {
      const res = await route.POST(req("/api/ucet/katalog", "POST", body), { params: Promise.resolve({}) } as never);
      return { status: res.status, body: (await res.json()) as { item?: { id: string }; error?: string } };
    };
    const created = await post({ name: "Káva", price: 4500, vatRate: 21, category: "Nápoje", ean: "8590001234567" });
    expect(created.status).toBe(200);
    const row = await getDb().query.catalogItems.findFirst({ where: eq(schema.catalogItems.id, created.body.item!.id) });
    expect(row).toMatchObject({ category: "Nápoje", ean: "8590001234567", active: true });

    const one = await import("@/app/api/ucet/katalog/[id]/route");
    const patch = async (body: unknown) => (await one.PATCH(req(`/api/ucet/katalog/${row!.id}`, "PATCH", body), { params: Promise.resolve({ id: row!.id }) } as never)).status;
    expect(await patch({ name: "Espresso", price: 5500, vatRate: 12, active: false, category: "", ean: "123" })).toBe(200);
    expect(await getDb().query.catalogItems.findFirst({ where: eq(schema.catalogItems.id, row!.id) })).toMatchObject({ name: "Espresso", price: 5500, vatRate: 12, active: false, category: null, ean: "123" });
    expect(await patch({})).toBe(400);
    expect(await patch({ name: "" })).toBe(400);

    await getDb()
      .insert(schema.catalogItems)
      .values(Array.from({ length: IMPORT_LIMITS.maxCatalog - 1 }, (_, i) => ({ accountId: s.account.id, name: `P${i}`, price: 100, vatRate: 21, sort: i })));
    const capped = await post({ name: "Nová", price: 100, vatRate: 21 });
    expect(capped.status).toBe(400);
    expect(capped.body.error?.replace(/\s/g, " ")).toContain("Katalog pojme nejvýš 5 000 položek");
  }, 30_000);

  it("the import stores category and code", async () => {
    const s = await login();
    const route = await import("@/app/api/ucet/katalog/import/route");
    const res = await route.POST(req("/api/ucet/katalog/import", "POST", { items: [{ name: "Káva", price: 4500, vatRate: 21, category: "Nápoje", ean: "859#0001" }, { name: "Čaj", price: 3500, vatRate: 12 }] }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const rows = await getDb().select().from(schema.catalogItems).where(eq(schema.catalogItems.accountId, s.account.id));
    expect(rows.map((r) => [r.name, r.category, r.ean]).sort()).toEqual([
      ["Káva", "Nápoje", "859#0001"],
      ["Čaj", null, null],
    ]);
  });

  it("gate: unit name and address can be edited; the receipt header is saved and goes to the register", async () => {
    const s = await login();
    const unitRoute = await import("@/app/api/ucet/jednotky/[id]/route");
    const res = await unitRoute.PATCH(req(`/api/ucet/jednotky/${s.unit.id}`, "PATCH", { label: "Salon Masarykova", address: "Masarykova 1, Karlovy Vary" }), { params: Promise.resolve({ id: s.unit.id }) } as never);
    expect(res.status).toBe(200);
    expect(await getDb().query.evidenceUnits.findFirst({ where: eq(schema.evidenceUnits.id, s.unit.id) })).toMatchObject({ label: "Salon Masarykova", address: "Masarykova 1, Karlovy Vary" });
    const bad = await unitRoute.PATCH(req(`/api/ucet/jednotky/${s.unit.id}`, "PATCH", { label: " " }), { params: Promise.resolve({ id: s.unit.id }) } as never);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe("Zadejte název jednotky");

    const acc = await import("@/app/api/ucet/route");
    const saved = await acc.POST(req("/api/ucet", "POST", { name: "Kadeřnictví Test", ico: "12345679", dic: "CZ12345679", vatPayer: false, receiptHeader: "Otevřeno Po–Pá 9–18", receiptFooter: "Děkujeme!" }));
    expect(saved.status).toBe(200);
    expect(await getDb().query.accounts.findFirst({ where: eq(schema.accounts.id, s.account.id) })).toMatchObject({ receiptHeader: "Otevřeno Po–Pá 9–18", receiptFooter: "Děkujeme!" });
    const token = randomBytes(32).toString("base64url");
    await getDb().update(schema.devices).set({ tokenHash: sha256(token) }).where(eq(schema.devices.id, s.device.id));
    const { GET } = await import("@/app/api/pokladna/config/route");
    const cfg = (await (await GET(new Request("http://localhost/api/pokladna/config", { headers: { authorization: `Bearer ${token}` } }))).json()) as PosConfig;
    expect(cfg.account.receiptHeader).toBe("Otevřeno Po–Pá 9–18");
    expect(cfg.units[0]).toMatchObject({ label: "Salon Masarykova", address: "Masarykova 1, Karlovy Vary" });
  });
});
