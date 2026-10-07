/**
 * R8.11 (власник) – JSON-LD organizace odkazuje na profily EvidujZdarma na sociálních sítích (sameAs), aby je vyhledávače
 * spojily s webem. Kontroluje se i vykreslený layout (JSON-LD je na každé stránce).
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const FACEBOOK = "https://www.facebook.com/profile.php?id=61595251222968";
const LINKEDIN = "https://www.linkedin.com/company/146665642/";

describe("R8.11 – Organization sameAs", () => {
  it("gate: organizationLd() contains both profile links", async () => {
    const { organizationLd } = await import("@/lib/jsonld");
    expect(organizationLd().sameAs).toEqual([FACEBOOK, LINKEDIN]);
  });

  it("gate: the JSON-LD rendered in the layout carries them", async () => {
    const { JsonLd, organizationLd } = await import("@/lib/jsonld");
    const html = renderToStaticMarkup(createElement(JsonLd, { data: [organizationLd()] }) as ReactElement);
    const [org] = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]!) as { "@type": string; sameAs: string[] }[];
    expect(org!["@type"]).toBe("Organization");
    expect(org!.sameAs).toContain(FACEBOOK);
    expect(org!.sameAs).toContain(LINKEDIN);
  });
});
