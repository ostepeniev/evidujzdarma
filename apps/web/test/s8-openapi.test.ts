/**
 * S8 rozd. 5.1, 3.7, 13.7 – OpenAPI 3.1 ze stejných zod schémat, kterými API validuje; každá routa /api/v1 je ve
 * specifikaci; katalog kódů chyb se nemění bez nové verze (snímek níže).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const V1 = join(__dirname, "../src/app/api/v1");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? routeFiles(p) : f === "route.ts" ? [p] : [];
  });
}

/** Routy podle souborů: /v1/sales/{id}/refund + exportované metody. */
function appRoutes(): { path: string; methods: string[] }[] {
  return routeFiles(V1).map((f) => {
    const rel = relative(V1, f).split("/").slice(0, -1).map((s) => s.replace(/^\[(.+)\]$/, "{$1}"));
    const src = readFileSync(f, "utf8");
    const methods = [...src.matchAll(/export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]!.toLowerCase());
    return { path: `/v1${rel.length ? `/${rel.join("/")}` : ""}`, methods };
  });
}

describe("S8 – OpenAPI 3.1", () => {
  it("gate: GET /api/v1/openapi.json serves a structurally valid OpenAPI 3.1 document without auth", async () => {
    const { GET } = await import("@/app/api/v1/openapi.json/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const doc = (await res.json()) as any;
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toMatchObject({ title: expect.any(String), version: "1" });
    expect(doc.servers[0].url).toMatch(/\/api$/);
    expect(doc.components.securitySchemes.bearer).toMatchObject({ type: "http", scheme: "bearer" });
    // každý $ref vede na existující schéma
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(doc.components.schemas[r], r).toBeTruthy();
    const opIds = new Set<string>();
    for (const [path, item] of Object.entries<any>(doc.paths)) {
      for (const [method, op] of Object.entries<any>(item)) {
        expect(op.operationId, `${method} ${path}`).toMatch(/^[a-zA-Z]+$/);
        expect(opIds.has(op.operationId)).toBe(false);
        opIds.add(op.operationId);
        expect(Object.keys(op.responses).length).toBeGreaterThan(0);
        for (const p of path.match(/\{(\w+)\}/g) ?? []) expect(op.parameters?.some((x: any) => `{${x.name}}` === p && x.in === "path" && x.required), `${path} ${p}`).toBe(true);
      }
    }
    // SaleV1: slovo prepayment v API není
    expect(JSON.stringify(doc.components.schemas.SaleV1)).not.toContain("prepayment");
    expect(JSON.stringify(doc.components.schemas.SaleV1)).toContain("credit_topup");
  });

  it("gate: every /api/v1 route file and method is in the specification (and nothing else)", async () => {
    const { openApiDocument } = await import("@/lib/server/api/openapi");
    const doc = openApiDocument() as any;
    const fromFiles = appRoutes()
      .flatMap((r) => r.methods.map((m) => `${m} ${r.path}`))
      .filter((x) => x !== "get /v1/openapi.json")
      .sort();
    const fromSpec = Object.entries<any>(doc.paths)
      .flatMap(([p, item]) => Object.keys(item).map((m) => `${m} ${p}`))
      .sort();
    expect(fromSpec).toEqual(fromFiles);
  });

  it("gate: the error catalog matches the contract snapshot (codes and HTTP statuses)", async () => {
    const { ERROR_CATALOG } = await import("@/lib/server/api/errors");
    expect(Object.fromEntries(Object.entries(ERROR_CATALOG).map(([k, v]) => [k, v.http]))).toEqual({
      invalid_request: 400,
      invalid_token: 401,
      token_revoked: 401,
      insufficient_scope: 403,
      account_closed: 403,
      environment_not_ready: 403,
      unit_not_found: 404,
      sale_not_found: 404,
      original_not_found: 404,
      idempotency_conflict: 409,
      external_ref_conflict: 409,
      payload_too_large: 413,
      refund_exceeds_original: 422,
      original_is_refund: 422,
      rate_limited: 429,
      internal_error: 500,
      sale_in_future: 422,
      sale_too_old: 422,
      amount_out_of_range: 422,
      unit_not_ready: 422,
      certificate_missing: 422,
      certificate_expired: 422,
      sequence_conflict: 422,
      sale_blocked: 422,
      fs_rejected: 422,
      fs_unavailable: 503,
    });
    const { openApiDocument } = await import("@/lib/server/api/openapi");
    const doc = openApiDocument() as any;
    expect(doc.components.schemas.Error.properties.error.properties.code.enum.sort()).toEqual(Object.keys(ERROR_CATALOG).sort());
  });
});

describe("S8 – /api-docs", () => {
  it("gate: Czech developer docs with the sections, curl/JS/PHP examples and the reference from OpenAPI; no external scripts", async () => {
    const { pageText } = await import("./helpers/render-text");
    const { default: Page } = await import("@/app/(site)/api-docs/page");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const html = renderToStaticMarkup(createElement(Page));
    const text = pageText(Page);
    for (const h of ["Začínáme", "Autentizace", "Tržby", "Vratky", "Webhooky", "Chyby", "Limity", "Playground", "Co se eviduje", "Changelog API"]) expect(text, h).toContain(h);
    for (const lang of ["curl", "JavaScript", "PHP"]) expect(text, lang).toContain(lang);
    expect(text).toContain("/api/v1/openapi.json");
    // reference z OpenAPI: všechny cesty
    for (const p of ["/v1/account", "/v1/units", "/v1/sales", "/v1/sales/{id}", "/v1/sales/{id}/refund", "/v1/closings"]) expect(text, p).toContain(p);
    expect(text).toMatch(/končí na „ff“|končí na ff|na „ff“/);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/cdn\.|unpkg|jsdelivr/);
  });

  it("gate: /api-docs is in the page register (sitemap) and llms.txt has a line about the API", async () => {
    const { sitePages } = await import("@/lib/site-pages");
    expect(sitePages().some((p) => p.path === "/api-docs")).toBe(true);
    const { llmsTxt } = await import("@/lib/llms");
    expect(llmsTxt()).toMatch(/\/api-docs\).*REST API/);
    const robots = (await import("@/app/robots")).default();
    expect(JSON.stringify(robots)).not.toMatch(/"\/api-docs/);
  });
});
