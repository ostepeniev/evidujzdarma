/**
 * R7.11 (рецензія №4, B 5.3, M3, M5) – sliby, které ještě neplatí, a adresa OSVČ:
 *  - lendink bez „snímků obrazovky“, ceník bez „odešle sama do 48 hodin“ (texty doslovně);
 *  - úspěch předregistrace upozorní, že odhlášená adresa e-mail nedostane;
 *  - /api/ico/[ico] u fyzické osoby nevrací ulici sídla (ani provozoven) – jen obec a kraj (inv. 11).
 */
import { readFileSync } from "node:fs";
import { mapRzp, mapSubject } from "@ez/cz";
import { describe, expect, it, vi } from "vitest";

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

vi.mock("@/lib/server/ares", () => ({
  lookupCompany: async () => ({
    subject: mapSubject({
      ico: "12345679",
      obchodniJmeno: "Jana Testovací",
      pravniForma: "101",
      sidlo: { nazevObce: "Karlovy Vary", nazevUlice: "Domovská", cisloDomovni: 7, psc: 36001, kodKraje: 51, nazevKraje: "Karlovarský kraj", textovaAdresa: "Domovská 7, 360 01 Karlovy Vary" },
    }),
    rzp: mapRzp({ zaznamy: [{ primarniZaznam: true, zivnosti: [{ predmetPodnikani: "Holičství", provozovny: [{ identifikacniCisloProvozovny: "1001234567", sidloProvozovny: { nazevObce: "Karlovy Vary", nazevUlice: "Domovská", cisloDomovni: 7, psc: 36001 } }] }] }] }),
    fetchedAt: new Date().toISOString(),
    source: "fixture",
  }),
}));

describe("R7.11 – promises and the address of a sole trader", () => {
  it("gate: landing and pricing texts (verbatim)", () => {
    const landing = src("app/(site)/page.tsx");
    expect(landing).toContain("Návod k DIS+ a certifikátu krok za krokem");
    expect(landing).not.toMatch(/snímky obrazovky/);
    const pricing = src("content/pricing.ts");
    expect(pricing).toContain("hlídá lhůtu 48 hodin a tržby odešle, jakmile je pokladna online");
    expect(pricing).not.toMatch(/odešle sama do 48 hodin/);
  });

  it("gate M3: the pre-registration success says an unsubscribed address gets no e-mail (verbatim)", () => {
    const form = src("components/prereg-form.tsx");
    expect(form).toContain("Pokud jste se dříve z našich e-mailů odhlásili, e-mail vám nepřijde – napište nám na {SITE.email}.");
  });

  it("gate M5: /api/ico for a natural person returns only city and region – no street", async () => {
    const { GET } = await import("@/app/api/ico/[ico]/route");
    const res = await GET(new Request("http://localhost/api/ico/12345679", { headers: { "x-real-ip": "10.3.0.1" } }), { params: Promise.resolve({ ico: "12345679" }) } as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { subject: { address: Record<string, unknown> }; rzp: { establishments: { address: Record<string, unknown> }[] } };
    expect(body.subject.address).toEqual({ city: "Karlovy Vary", regionCode: 51, regionName: "Karlovarský kraj" });
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/Domovská|36001|"street"/);
    expect(body.rzp.establishments[0]!.address).toEqual({ city: "Karlovy Vary" });
  });
});
