/**
 * R7.7 (рецензія №4, B M10) – i stránka 404 a stránky odhlášení nesou plášku „Nezávislá služba…“ a provozovatele
 * (inv. 9, § 435 OZ).
 */
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SITE, operatorLine } from "@/lib/site";

describe("R7.7 – 404 and unsubscribe pages carry the independence notice and the operator", () => {
  it("gate: app/not-found renders the independence notice and the operator", async () => {
    const path = new URL("../src/app/not-found.tsx", import.meta.url);
    expect(existsSync(path)).toBe(true);
    const { default: NotFound } = await import("@/app/not-found");
    const html = renderToStaticMarkup(createElement(NotFound));
    expect(html).toContain(SITE.independenceNotice);
    expect(html).toContain(operatorLine().replace(/&/g, "&amp;"));
  });

  it("gate: /api/odhlasit HTML pages carry the notice and the operator", async () => {
    const { GET } = await import("@/app/api/odhlasit/route");
    const html = await (await GET(new Request("http://localhost/api/odhlasit?token=bad"))).text();
    expect(html).toContain(SITE.independenceNotice);
    expect(html).toContain(operatorLine());
  });
});
