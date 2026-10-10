/**
 * R17.3 (docs/tasks/2026-10-10-r17.md) – krok 1 „Firma“ s kartou ARES.
 *  - IČO z předregistrace (stejný e-mail) se doplní a hned se načte ARES; nad kartou věta o předregistraci;
 *  - po zadání platného IČO (8 číslic) se ARES načte sám (tlačítko zůstává);
 *  - karta „Je to vaše firma?“ (Název, Sídlo, DIČ, Plátce DPH), tlačítka a poznámka doslovně;
 *  - zaniklý subjekt (assess → dissolved) bez karty a bez „Ano“; nenalezený – text doslovně.
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }) }));

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const T = {
  prereg: "IČO jsme doplnili z vaší předregistrace.",
  title: "Je to vaše firma?",
  use: "Ano, použít údaje z ARES",
  manual: "Vyplnit ručně",
  note: "Údaje jsme načetli z veřejného registru ARES. Zkontrolujte je – tisknou se na účtenku.",
  dissolved: "Podle ARES tento subjekt zanikl. Zkontrolujte, zda je IČO správné.",
  notFound: "Subjekt s tímto IČO jsme v ARES nenašli. Údaje vyplňte ručně.",
};

describe("R17.3 – IČO from the pre-registration", () => {
  it("gate: accountState of a user without an account carries the IČO of their pre-registration (case-insensitive e-mail)", async () => {
    const { accountState } = await import("@/lib/server/account");
    const db = getDb();
    await db.insert(schema.preregistrations).values({ email: "Jana@Kadernictvi.cz", ico: "12345679", referralCode: "janacode", confirmTokenHash: "a".repeat(64) });
    const [user] = await db.insert(schema.users).values({ email: "jana@kadernictvi.cz" }).returning();
    const state = await accountState({ id: user!.id, email: user!.email, name: null, memberships: [] });
    expect(state).toMatchObject({ account: null, preregIco: "12345679" });
    const [other] = await db.insert(schema.users).values({ email: "nobody@example.cz" }).returning();
    expect(await accountState({ id: other!.id, email: other!.email, name: null, memberships: [] })).toMatchObject({ account: null, preregIco: null });
  });

  it("gate: the Firma step starts with that IČO and says where it came from", async () => {
    const { SetupApp } = await import("@/components/setup/setup-app");
    const html = renderToStaticMarkup(createElement(SetupApp, { initial: { user: { email: "jana@kadernictvi.cz" }, account: null, preregIco: "12345679" } }));
    expect(html).toMatch(/<input id="f-ico"[^>]*value="12345679"/);
    expect(text(html)).toContain(T.prereg);
    const without = renderToStaticMarkup(createElement(SetupApp, { initial: { user: { email: "x@example.cz" }, account: null, preregIco: null } }));
    expect(text(without)).not.toContain(T.prereg);
  });

  it("gate: ARES loads by itself for a valid 8-digit IČO (the button stays)", async () => {
    const { isCompleteIco } = await import("@/components/setup/ares-card");
    expect(isCompleteIco("12345679")).toBe(true);
    expect(isCompleteIco(" 123 456 79 ")).toBe(true);
    for (const v of ["", "1234567", "12345678", "123456790", "abcdefgh"]) expect(isCompleteIco(v), v).toBe(false);
    const src = readFileSync(new URL("../../src/components/setup/setup-app.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/isCompleteIco\(/);
    expect(src).toMatch(/>\s*ARES\s*</);
  });
});

describe("R17.3 – the ARES card", () => {
  const found = {
    subject: { ico: "12345679", name: "Kadeřnictví Jana s.r.o.", dic: "CZ12345679", vatPayer: true, address: { text: "Hlavní 1, 110 00 Praha 1", street: "Hlavní 1", city: "Praha", postalCode: "11000" } },
    assessment: { verdict: "likely" },
  };

  it("gate: the API answer maps to found / dissolved (same assess() verdict) / not found / error", async () => {
    const { aresOutcome } = await import("@/components/setup/ares-card");
    expect(aresOutcome(200, found)).toEqual({ kind: "found", subject: { name: "Kadeřnictví Jana s.r.o.", address: "Hlavní 1, 110 00 Praha 1", dic: "CZ12345679", vatPayer: true } });
    expect(aresOutcome(200, { ...found, assessment: { verdict: "dissolved" } })).toEqual({ kind: "dissolved" });
    expect(aresOutcome(404, { error: "Subjekt s tímto IČO v ARES není" })).toEqual({ kind: "notfound" });
    expect(aresOutcome(503, { error: "Registr ARES je dočasně nedostupný, zkuste to prosím za chvíli." })).toEqual({ kind: "error", message: "Registr ARES je dočasně nedostupný, zkuste to prosím za chvíli." });
  });

  it("gate: found – „Je to vaše firma?“ with Název, Sídlo, DIČ, Plátce DPH and both buttons; texts verbatim", async () => {
    const { AresCard, aresOutcome } = await import("@/components/setup/ares-card");
    const h = text(renderToStaticMarkup(createElement(AresCard, { outcome: aresOutcome(200, found), onUse: () => {}, onManual: () => {} })));
    for (const s of [T.title, "Název", "Kadeřnictví Jana s.r.o.", "Sídlo", "Hlavní 1, 110 00 Praha 1", "DIČ", "CZ12345679", "Plátce DPH", "Ano", T.use, T.manual, T.note]) expect(h, s).toContain(s);
    const notPayer = text(renderToStaticMarkup(createElement(AresCard, { outcome: aresOutcome(200, { ...found, subject: { ...found.subject, vatPayer: false } }), onUse: () => {}, onManual: () => {} })));
    expect(notPayer).toMatch(/Plátce DPH\s+Ne/);
  });

  it("gate: dissolved – the text, no card, no „Ano“; not found – the text", async () => {
    const { AresCard } = await import("@/components/setup/ares-card");
    const d = text(renderToStaticMarkup(createElement(AresCard, { outcome: { kind: "dissolved" }, onUse: () => {}, onManual: () => {} })));
    expect(d).toContain(T.dissolved);
    expect(d).not.toContain(T.title);
    expect(d).not.toContain(T.use);
    const n = text(renderToStaticMarkup(createElement(AresCard, { outcome: { kind: "notfound" }, onUse: () => {}, onManual: () => {} })));
    expect(n).toContain(T.notFound);
    expect(n).not.toContain(T.use);
  });
});
