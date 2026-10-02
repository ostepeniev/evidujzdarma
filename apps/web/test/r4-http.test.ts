/**
 * R4 – HTTP hardening (B r1 Дрібне 1, 3, 4, 13, 16; B r2 Н2-2).
 *  - Н2-2: tělo API nad 1 MB → 413 ještě před čtením (aplikace nespoléhá jen na limit proxy).
 *  - Дрібне 1: API s cookie session přijímá změny jen ze stejného původu a jen jako JSON / multipart.
 *  - Дрібне 13: odpovědi /api/ucet a /api/kabinet mají Cache-Control: no-store.
 *  - Дрібне 3: [id], které není UUID, je 404 (ne 500 s parametry v logu).
 *  - Дрібне 4: CSV export neutralizuje vzorce (= + - @) v textových buňkách.
 *  - Дрібне 16: RichText nebere //host jako interní odkaz.
 */
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) => new NextRequest(`http://localhost${path}`, { method: init.method ?? "GET", headers: init.headers });

describe("Н2-2 – body limit before the body is read", () => {
  it("gate: POST of 5 MB to /api/auth/login → 413", () => {
    const res = proxy(req("/api/auth/login", { method: "POST", headers: { "content-length": String(5 * 1024 * 1024), "content-type": "application/json" } }));
    expect(res.status).toBe(413);
  });

  it("a normal-sized request passes", () => {
    const res = proxy(req("/api/auth/login", { method: "POST", headers: { "content-length": "60", "content-type": "application/json", origin: "http://localhost" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("Дрібне 1 – cookie APIs accept changes only from our origin, as JSON", () => {
  const post = (path: string, headers: Record<string, string>) => proxy(req(path, { method: "POST", headers: { "content-length": "20", ...headers } }));

  it("gate: a cross-site POST to /api/ucet/* is refused", () => {
    expect(post("/api/ucet/katalog", { origin: "https://evil.example", "content-type": "application/json" }).status).toBe(403);
    expect(post("/api/kabinet/klienti", { origin: "https://evil.example", "content-type": "application/json" }).status).toBe(403);
    expect(post("/api/ucet/katalog", { "sec-fetch-site": "cross-site", "content-type": "application/json" }).status).toBe(403);
  });

  it("behind nginx the public Host counts, not the internal URL; Origin 'null' is refused", () => {
    const behindProxy = (origin: string) =>
      proxy(
        new NextRequest("http://127.0.0.1:3100/api/ucet/katalog", {
          method: "POST",
          headers: { "content-length": "20", "content-type": "application/json", host: "staging.evidujzdarma.cz", "x-forwarded-host": "staging.evidujzdarma.cz", origin },
        }),
      );
    expect(behindProxy("https://staging.evidujzdarma.cz").status).toBe(200);
    expect(behindProxy("https://evil.example").status).toBe(403);
    expect(behindProxy("null").status).toBe(403);
  });

  it("gate: text/plain with a JSON body is refused (no simple-request CSRF)", () => {
    expect(post("/api/ucet/katalog", { origin: "http://localhost", "content-type": "text/plain" }).status).toBe(415);
  });

  it("same origin JSON and multipart pass; public machine endpoints are not origin-checked", () => {
    expect(post("/api/ucet/katalog", { origin: "http://localhost", "content-type": "application/json" }).status).toBe(200);
    expect(post("/api/ucet/certifikat", { origin: "http://localhost", "content-type": "multipart/form-data; boundary=x" }).status).toBe(200);
    expect(post("/api/mcp", { origin: "https://claude.ai", "content-type": "application/json" }).status).toBe(200);
    // dokončení přihlášení je HTML formulář na naší stránce
    expect(post("/api/auth/callback", { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }).status).toBe(200);
    expect(post("/api/ucet/katalog", { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }).status).toBe(415);
  });
});

describe("Дрібне 13 – no-store on account APIs", () => {
  it("gate: GET /api/ucet and the export carry Cache-Control: no-store", () => {
    expect(proxy(req("/api/ucet")).headers.get("cache-control")).toMatch(/no-store/);
    expect(proxy(req("/api/ucet/export?od=2026-10-01&do=2026-10-02")).headers.get("cache-control")).toMatch(/no-store/);
    expect(proxy(req("/api/kabinet")).headers.get("cache-control")).toMatch(/no-store/);
  });
});

describe("Дрібне 3 – [id] must be a UUID", () => {
  it("gate: ownerRoute answers 404 for a non-UUID id without touching the handler", async () => {
    const { ownerRoute } = await import("@/lib/server/route-helpers");
    let called = false;
    const handler = ownerRoute<{ id: string }>(async () => ((called = true), Response.json({})));
    const res = await handler(new Request("http://localhost/api/ucet/katalog/not-a-uuid", { method: "PATCH" }), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(404);
    expect(called).toBe(false);
  });
});

describe("Дрібне 4 – CSV formulas", () => {
  it("gate: text cells starting with = + - @ are neutralised, numbers are not", async () => {
    const csv = (await import("@/lib/csv")) as { csvCell?: (v: unknown) => string };
    expect(typeof csv.csvCell).toBe("function");
    expect(csv.csvCell!("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csv.csvCell!("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csv.csvCell!("+420 777")).toBe("'+420 777");
    expect(csv.csvCell!("-350,00")).toBe("-350,00");
    expect(csv.csvCell!(-35000)).toBe("-35000");
    expect(csv.csvCell!("Střih; mytí")).toBe(`"Střih; mytí"`);
  });
});

describe("Дрібне 16 – RichText and protocol-relative links", () => {
  it("gate: //host is not rendered as an internal link", async () => {
    const { RichText } = await import("@/components/rich-text");
    const html = renderToStaticMarkup(createElement(RichText, { text: "Viz [tady](//evil.example/x) a [návod](/navody/eet-off)." }));
    expect(html).not.toContain('href="//evil.example/x"');
    expect(html).toContain('href="/navody/eet-off"');
  });
});
