/**
 * Рецензія №3, B – дрібне (bez databáze): Д3-1 CSV vzorce, Д3-2 UUID v kabinetu, Д3-3 RichText „/\host“,
 * Д3-4 ARES_MEMORY_MAX ≤ 0, Д3-6 e-mail DIS+ bez „snímků“, Д3-10 timeouty SMTP.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { PATCH, DELETE } from "@/app/api/kabinet/klienti/[id]/route";
import { POST as invitePost } from "@/app/api/kabinet/klienti/[id]/pozvanka/route";
import { RichText } from "@/components/rich-text";
import { renderEmail } from "@/lib/emails";
import { __aresCacheForTests } from "@/lib/server/ares";
import { cashBookCsv } from "@/lib/server/closings";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

describe("Д3-1 – CSV exports neutralise formulas", () => {
  it("gate: pokladní kniha – a note '=1+1' is written as text", () => {
    const csv = cashBookCsv([{ at: new Date("2027-01-15T10:00:00Z"), registerId: "P1", doc: "V1", text: "Výběr", income: 0, expense: 10000, balance: 0, staff: "@admin", note: "=1+1" }]);
    expect(csv).toContain(";'=1+1");
    expect(csv).toContain(";'@admin;");
  });

  it("gate: accountant export uses the shared csvCell", () => {
    const route = src("app/api/kabinet/export/route.ts");
    expect(route).toMatch(/csvCell/);
    expect(route).not.toMatch(/const cell = \(v: unknown\)/);
  });
});

describe("Д3-2 – accountant cabinet [id] must be a UUID", () => {
  const params = { params: Promise.resolve({ id: "not-a-uuid" }) } as never;
  it.each([
    ["PATCH", () => PATCH(new Request("http://localhost/api/kabinet/klienti/not-a-uuid", { method: "PATCH", body: "{}" }), params)],
    ["DELETE", () => DELETE(new Request("http://localhost/api/kabinet/klienti/not-a-uuid", { method: "DELETE" }), params)],
    ["POST pozvanka", () => invitePost(new Request("http://localhost/api/kabinet/klienti/not-a-uuid/pozvanka", { method: "POST" }), params)],
  ])("gate: %s /api/kabinet/klienti/not-a-uuid → 404 before the handler runs", async (_m, call) => {
    const res = await call();
    expect(res.status).toBe(404);
  });
});

describe("Д3-3 – RichText: '/\\host' is not an internal link", () => {
  it("gate: [x](/\\evil.example) is not rendered as a link", () => {
    const html = renderToStaticMarkup(createElement(RichText, { text: "Viz [x](/\\evil.example) a [návod](/navody/eet-off)." }));
    expect(html).not.toMatch(/href="\/\\evil/);
    expect(html).toContain('href="/navody/eet-off"');
  });
});

describe("Д3-4 – ARES_MEMORY_MAX must be a positive integer", () => {
  afterEach(() => {
    delete process.env.ARES_MEMORY_MAX;
  });
  it("gate: -1, 0, 1.5 or garbage fall back to a sane limit; cached() returns", async () => {
    const hooks = __aresCacheForTests as typeof __aresCacheForTests & { max: () => number };
    for (const v of ["-1", "0", "1.5", "abc"]) {
      process.env.ARES_MEMORY_MAX = v;
      expect(hooks.max(), v).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(hooks.max()), v).toBe(true);
    }
    process.env.ARES_MEMORY_MAX = "-1";
    hooks.clear();
    await expect(hooks.cached("subject:x", async () => ({ x: 1 }))).resolves.toBeTruthy();
    expect(hooks.size()).toBeLessThanOrEqual(2_000);
  });
});

describe("Д3-6 – the DIS+ e-mail does not promise screenshots", () => {
  it("gate: dis-launch text and html contain no 'snímky'", () => {
    const m = renderEmail("dis-launch", { unsubscribeToken: "t" });
    expect(m.text).not.toMatch(/snímk/i);
    expect(m.html).not.toMatch(/snímk/i);
  });
});

describe("Д3-10 – SMTP timeouts below the outbox stale threshold", () => {
  it("gate: createTransport gets explicit connection and socket timeouts", () => {
    const mail = src("lib/server/mail.ts");
    expect(mail).toMatch(/connectionTimeout/);
    expect(mail).toMatch(/socketTimeout/);
  });
});
