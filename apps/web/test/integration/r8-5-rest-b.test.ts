/**
 * R8.5 (рецензія №5, B Д-5, Д-8, Д-9, Д-10, Permissions-Policy; Д-7 je v test/infra.test.ts):
 *  - Д-5: veřejné POST /api/preregistrace a /api/namitka přijmou jen application/json – cizí formulář s enctype=text/plain
 *    tak narazí na CORS preflight;
 *  - Д-8: isNaturalPerson pozná i zahraniční fyzické osoby (424, 425) a neznámou formu bere jako fyzickou osobu (fail-closed);
 *  - Д-9: <time dateTime> v zásadách a podmínkách je ISO datum, ne verze s příponou;
 *  - Д-10: žádné zastaralé TODO (localStorage pro kód doporučení, „60 dní výpověď“);
 *  - Permissions-Policy bez „bluetooth“ (Chrome hlásí „Unrecognized feature“).
 */
import { readFileSync } from "node:fs";
import { getDb, schema } from "@ez/db";
import { eq } from "drizzle-orm";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isNaturalPerson, legalFormShort } from "@ez/cz";
import { createTestDb, type TestDb } from "../helpers/test-db";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

const { POST: preregister } = await import("@/app/api/preregistrace/route");
const { POST: objection } = await import("@/app/api/namitka/route");

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.close());
beforeEach(async () => t.reset());

let ip = 0;
const req = (path: string, contentType: string, body: unknown) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": contentType, origin: "https://evil.example", "x-real-ip": `10.85.0.${++ip}` }, body: JSON.stringify(body) });
const mails = (to: string) => getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, to));

describe("R8.5 – rest of B", () => {
  it("gate Д-5: text/plain (a cross-site form without preflight) → 415, nothing stored, no e-mail", async () => {
    const r1 = await preregister(req("/api/preregistrace", "text/plain", { email: "d5@example.cz", interest: "webinar" }));
    expect(r1.status).toBe(415);
    expect(await mails("d5@example.cz")).toHaveLength(0);
    const r2 = await objection(req("/api/namitka", "text/plain", { ico: "12345679", name: "Jan Novák", email: "d5n@example.cz", message: "Prosím o odstranění." }));
    expect(r2.status).toBe(415);
    expect(await mails("d5n@example.cz")).toHaveLength(0);
    const r3 = await preregister(req("/api/preregistrace", "application/x-www-form-urlencoded", { email: "d5f@example.cz" }));
    expect(r3.status).toBe(415);
  });

  it("control Д-5: application/json (also with charset) still works", async () => {
    expect((await preregister(req("/api/preregistrace", "application/json; charset=utf-8", { email: "ok@example.cz" }))).status).toBe(200);
    expect(await mails("ok@example.cz")).toHaveLength(1);
  });

  it("gate Д-8: foreign natural persons (424, 425) and an unknown form count as natural persons (fail-closed)", () => {
    for (const code of ["101", "102", "105", "107", "424", "425", null, undefined, ""]) expect(isNaturalPerson(code), String(code)).toBe(true);
    for (const code of ["112", "121", "111", "205", "706", "801", "421", "426"]) expect(isNaturalPerson(code), code).toBe(false);
    // neznámá forma se nepředstírá jako OSVČ ani jako právnická osoba
    expect(legalFormShort(null)).toBe("neuvedeno");
    expect(legalFormShort("424")).toBe("OSVČ");
    expect(legalFormShort("112")).toBe("s.r.o.");
  });

  it("gate Д-9: <time dateTime> on the legal pages is an ISO date", async () => {
    const { TERMS_DATE_ISO, PRIVACY_DATE_ISO } = await import("@/lib/legal");
    expect(TERMS_DATE_ISO).toBe("2026-10-03");
    expect(PRIVACY_DATE_ISO).toBe("2026-10-03");
    const Z = (await import("@/app/(site)/ochrana-osobnich-udaju/page")).default as FC;
    const P = (await import("@/app/(site)/podminky/page")).default as FC;
    const values = [renderToStaticMarkup(createElement(Z)), renderToStaticMarkup(createElement(P))].flatMap((h) => [...h.matchAll(/<time dateTime="([^"]+)"/g)].map((m) => m[1]!));
    expect(values.length).toBeGreaterThanOrEqual(2);
    for (const v of values) expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gate Д-10: no stale TODOs in the privacy policy and the terms", () => {
    const z = readFileSync(new URL("../../src/app/(site)/ochrana-osobnich-udaju/page.tsx", import.meta.url), "utf8");
    const p = readFileSync(new URL("../../src/app/(site)/podminky/page.tsx", import.meta.url), "utf8");
    expect(z).not.toMatch(/localStorage pro kód doporučení/);
    expect(p).not.toMatch(/60 dní výpověď/);
  });

  it("gate: Permissions-Policy has no 'bluetooth'", () => {
    const cfg = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    const policy = /"Permissions-Policy", value: "([^"]+)"/.exec(cfg)![1]!;
    expect(policy).not.toMatch(/bluetooth/);
    expect(policy).toContain("camera=(self)");
  });
});
