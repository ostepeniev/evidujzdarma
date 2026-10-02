/**
 * Ф9 (R4) – návody bez revize daňovým poradcem nevydává žádný strojový kanál: ani llms.txt, ani MCP.
 * Žádný nástroj MCP nevrátí slug ani odkaz na nerevidovaný návod; po revizi (příznak) se návod objeví sám.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { GUIDES, isIndexable } from "@/content/guides";
import { createEetMcpServer, type McpDeps } from "@/lib/mcp/server";

const deps: McpDeps = { lookupCompany: async () => null, fsStatus: async () => [], allow: () => true };
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

  it("gate: no MCP tool returns a slug or a link of a guide without review", async () => {
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
