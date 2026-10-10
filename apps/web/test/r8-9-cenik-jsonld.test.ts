/**
 * R8.9 (власник, Google Rich Results na /cenik: 1 kritická chyba) – strukturovaná data ceníku.
 *  - Product má image (PNG: /icons/512 a /opengraph-image), logo organizace není SVG;
 *  - každá Offer má availability: dokud je pokladna zavřená, PreOrder; po otevření Zdarma InStock, placené doplňky
 *    PreOrder, dokud nejsou v kódu;
 *  - shippingDetails a hasMerchantReturnPolicy se nepřidávají (digitální služba).
 */
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const launch = vi.hoisted(() => ({ posOpen: false }));
vi.mock("@/lib/launch", async (orig) => {
  const real = await orig<typeof import("@/lib/launch")>();
  // stav pokladny řídí test, ne skutečný seznam – commit otevření 2. 11. test nerozbije (R17.2)
  return { ...real, isClosed: (p: string) => (p === "/pokladna" ? !launch.posOpen : real.isClosed(p)) };
});

const { default: PricingPage } = await import("@/app/(site)/cenik/page");
const { organizationLd } = await import("@/lib/jsonld");
const { SITE_URL } = await import("@/lib/site");

type Offer = { name: string; availability?: string; price: string };
function product(): { image?: string[]; offers: Offer[]; shippingDetails?: unknown; hasMerchantReturnPolicy?: unknown } {
  const html = renderToStaticMarkup(createElement(PricingPage as FC));
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1]!)].flat());
  return blocks.find((b: { "@type": string }) => b["@type"] === "Product");
}

describe("R8.9 – structured data on /cenik", () => {
  it("gate: Product has a PNG image (no SVG) and no shipping/return policy", () => {
    const p = product();
    expect(p.image).toEqual([`${SITE_URL}/icons/512`, `${SITE_URL}/opengraph-image`]);
    expect(p.image!.some((u) => u.endsWith(".svg"))).toBe(false);
    expect(p.shippingDetails).toBeUndefined();
    expect(p.hasMerchantReturnPolicy).toBeUndefined();
  });

  it("gate: the organization logo is a PNG, not .svg", () => {
    const logo = organizationLd().logo as string;
    expect(logo).toBe(`${SITE_URL}/icons/512`);
    expect(logo.endsWith(".svg")).toBe(false);
  });

  it("gate: every Offer has availability – PreOrder for all while the cash register is closed", () => {
    launch.posOpen = false;
    const offers = product().offers;
    expect(offers.length).toBeGreaterThan(3);
    for (const o of offers) expect(o.availability, o.name).toBe("https://schema.org/PreOrder");
  });

  it("gate: once the cash register opens, Zdarma is InStock and paid add-ons stay PreOrder", () => {
    launch.posOpen = true;
    try {
      const offers = product().offers;
      for (const o of offers) expect(o.availability, o.name).toBe(o.price === "0" ? "https://schema.org/InStock" : "https://schema.org/PreOrder");
      expect(offers.filter((o) => o.availability === "https://schema.org/InStock").map((o) => o.name)).toEqual(["Zdarma"]);
    } finally {
      launch.posOpen = false;
    }
  });
});
