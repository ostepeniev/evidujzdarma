/**
 * R17.6 (docs/tasks/2026-10-10-r17.md) – tlačítko dole na telefonu nad „Hotovo“. MobileCta sbírá formuláře
 * s data-prereg-form jen při montování; poděkování se objeví později. Atribut proto patří na stabilní obal kolem
 * formuláře i <Success />, který zůstává i ve stavu „done“.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../src/components/prereg-form.tsx", import.meta.url), "utf8");

describe("R17.6 – a stable data-prereg-form wrapper", () => {
  it("gate: the attribute sits on a wrapper around both the form and <Success /> – not on the <form>", () => {
    expect(src.match(/data-prereg-form="true"/g)?.length).toBe(1);
    expect(src).not.toMatch(/<form[^>]*data-prereg-form/);
    expect(src).toMatch(/<div data-prereg-form="true">\s*\{state\.kind === "done" \? <Success \/> : form\}\s*<\/div>/);
    // žádný dřívější návrat jen s <Success /> mimo obal
    expect(src).not.toMatch(/return <Success \/>/);
  });

  it("gate: rendered, the wrapper holds the form", async () => {
    const { PreregForm } = await import("@/components/prereg-form");
    expect(renderToStaticMarkup(createElement(PreregForm))).toMatch(/^<div data-prereg-form="true"><form/);
  });
});
