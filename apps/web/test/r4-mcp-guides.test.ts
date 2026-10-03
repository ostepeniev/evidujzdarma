/**
 * Ф9 (R4) – návody bez revize daňovým poradcem nevydává žádný strojový kanál: ani llms.txt, ani MCP.
 * Žádný nástroj MCP nevrátí slug ani odkaz na nerevidovaný návod; po revizi (příznak) se návod objeví sám.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { mapRzp, mapSubject } from "@ez/cz";
import { GUIDES, isIndexable } from "@/content/guides";
import { ARES_FIXTURES } from "@/lib/server/ares-fixtures";
import { createEetMcpServer, type McpDeps } from "@/lib/mcp/server";

// eet_check_ico s fixturou ARES (ne null) – jinak by gate neviděl checklist s odkazy (R6.5)
const deps: McpDeps = {
  lookupCompany: async (ico: string) => {
    const f = ARES_FIXTURES[ico];
    return f ? { subject: mapSubject(f.subject), rzp: f.rzp ? mapRzp(f.rzp) : null, fetchedAt: new Date().toISOString(), source: "fixture" as const } : null;
  },
  fsStatus: async () => [],
  allow: () => true,
} as McpDeps;
let client: Client | null = null;
async function connect(): Promise<Client> {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createEetMcpServer(deps).connect(a);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(b);
  return client;
}
afterEach(async () => {
  await client?.close();
  client = null;
  delete process.env.GUIDES_INDEX_UNREVIEWED;
});

type Result = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, unknown> };
const call = async (c: Client, name: string, args: Record<string, unknown>) => (await c.callTool({ name, arguments: args })) as Result;

/** Všechno, co nástroje vrátí (text i strukturovaná data), pro hledání slugů. */
async function everything(c: Client): Promise<string> {
  const calls: [string, Record<string, unknown>][] = [
    ["eet_search_guides", { query: "certifikát DIS+", response_format: "json" }],
    ["eet_search_guides", { query: "kadeřnictví hotovost karta", response_format: "markdown" }],
    ["eet_search_guides", { query: "xyzxyz" }],
    ["eet_get_guide", { slug: "jak-aktivovat-dis-a-certifikat" }],
    ["eet_get_guide", { slug: "neexistuje" }],
    ["eet_classify_payment", { payment: "card", in_person: true, response_format: "json" }],
    ["eet_classify_payment", { payment: "card", in_person: true, response_format: "markdown" }],
    ["eet_get_facts", { response_format: "json" }],
    ["eet_get_facts", {}],
    ["eet_list_misconceptions", { response_format: "json" }],
    ["eet_list_misconceptions", {}],
    // R6.5: všechny nástroje, eet_check_ico pro každou fixturu ARES (OSVČ, firma…)
    ...Object.keys(ARES_FIXTURES).flatMap((ico): [string, Record<string, unknown>][] => [
      ["eet_check_ico", { ico, response_format: "json" }],
      ["eet_check_ico", { ico }],
    ]),
    ["eet_calculate_eet_off", { flat_tax_band: 1, yearly_income_czk: 600_000, response_format: "json" }],
    ["eet_calculate_eet_off", { flat_tax_band: 1, yearly_income_czk: 600_000 }],
    ["eet_get_fs_status", { response_format: "json" }],
    ["eet_get_fs_status", {}],
  ];
  const out: string[] = [];
  for (const [name, args] of calls) {
    const r = await call(c, name, args);
    out.push(r.content.map((x) => x.text).join("\n"), JSON.stringify(r.structuredContent ?? {}));
  }
  return out.join("\n");
}

describe("Ф9 – MCP serves only reviewed guides", () => {
  const unreviewed = GUIDES.filter((g) => !g.reviewedBy);

  it("gate: no MCP tool (all of them, eet_check_ico with ARES fixtures) returns a slug or a link of a guide without review", async () => {
    expect(unreviewed.length).toBeGreaterThan(0);
    expect(unreviewed.every((g) => !isIndexable(g))).toBe(true);
    const all = await everything(await connect());
    // slug jako samostatné slovo nebo náš odkaz /navody/…; cesta v URL zdroje (eet.gov.cz/cs/eet-off/…) se nepočítá
    const leaked = unreviewed.filter((g) => all.includes(`/navody/${g.slug}`) || new RegExp(`(?<![\\w/.-])${g.slug}(?![\\w/-])`).test(all));
    expect(leaked.map((g) => g.slug)).toEqual([]);
  });

  it("once a guide is cleared (flag), it appears in search, can be read and is linked", async () => {
    process.env.GUIDES_INDEX_UNREVIEWED = "1";
    const c = await connect();
    const s = await call(c, "eet_search_guides", { query: "certifikát DIS+", response_format: "json" });
    expect((s.structuredContent!.results as { slug: string }[])[0]!.slug).toBe("jak-aktivovat-dis-a-certifikat");
    expect((await call(c, "eet_get_guide", { slug: "jak-aktivovat-dis-a-certifikat" })).isError).toBeFalsy();
    const p = await call(c, "eet_classify_payment", { payment: "card", in_person: true, response_format: "json" });
    expect(String(p.structuredContent!.guide_url)).toMatch(/\/navody\/kontaktni-platba$/);
  });
});
