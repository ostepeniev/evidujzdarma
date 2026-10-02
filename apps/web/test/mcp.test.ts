import { mapRzp, mapSubject } from "@ez/cz";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createEetMcpServer, type McpDeps } from "@/lib/mcp/server";
import { ARES_FIXTURES } from "@/lib/server/ares-fixtures";

const deps = (over: Partial<McpDeps> = {}): McpDeps => ({
  lookupCompany: async (ico) => {
    const f = ARES_FIXTURES[ico];
    return f ? { subject: mapSubject(f.subject), rzp: f.rzp ? mapRzp(f.rzp) : null, fetchedAt: "2026-10-01T10:00:00Z", source: "fixture" } : null;
  },
  fsStatus: async () => [
    {
      environment: "production",
      latest: { checkedAt: new Date("2027-01-05T10:00:00Z"), status: "up", latencyMs: 180 },
      uptime: { h24: 100, d7: 99.8, d30: 99.9 },
      incidents: [{ start: new Date("2027-01-03T08:00:00Z"), end: new Date("2027-01-03T08:20:00Z"), probes: 4 }],
    },
  ],
  allow: () => true,
  ...over,
});

let client: Client | null = null;
async function connect(d: McpDeps = deps()): Promise<Client> {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createEetMcpServer(d).connect(a);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(b);
  return client;
}
afterEach(async () => {
  await client?.close();
  client = null;
});

type Result = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, unknown> };
const call = async (c: Client, name: string, args: Record<string, unknown>) => (await c.callTool({ name, arguments: args })) as Result;

describe("EET MCP server", () => {
  it("advertises read-only tools with instructions", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["eet_calculate_eet_off", "eet_check_ico", "eet_classify_payment", "eet_get_facts", "eet_get_fs_status", "eet_get_guide", "eet_list_misconceptions", "eet_search_guides"].sort(),
    );
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.destructiveHint).toBe(false);
      expect(t.description!.length).toBeGreaterThan(100);
    }
    expect(c.getInstructions()).toContain("not operated by Finanční správa");
  });

  it("checks an IČO with answers and hides the street of a natural person", async () => {
    const c = await connect();
    const r = await call(c, "eet_check_ico", { ico: "12345679", accepts_in_person_payments: "yes", response_format: "json" });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent!;
    expect(s.verdict).toBe("likely");
    expect(String(s.url)).toContain("/kontrola-ico?ico=12345679");
    expect(Array.isArray(s.checklist)).toBe(true);
    const subject = s.subject as { natural_person: boolean; address: string | null };
    if (subject.natural_person) expect(subject.address ?? "").not.toMatch(/\d{3}\s?\d{2}/);
    expect(String(s.disclaimer)).toContain("není provozována Finanční správou");
  });

  it("returns actionable errors for bad or unknown IČO and rate limits", async () => {
    const c = await connect();
    expect((await call(c, "eet_check_ico", { ico: "12345678" })).content[0]!.text).toMatch(/není platné IČO/);
    expect((await call(c, "eet_check_ico", { ico: "00000019" })).isError).toBe(true);
    await client!.close();
    const limited = await connect(deps({ allow: () => false }));
    const r = await call(limited, "eet_check_ico", { ico: "12345679" });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Příliš mnoho dotazů/);
  });

  it("calculates EET OFF including mid-year start and ineligibility", async () => {
    const c = await connect();
    const r = await call(c, "eet_calculate_eet_off", { flat_tax_band: 1, yearly_income_czk: 600000, start_month: 7, response_format: "json" });
    expect(r.structuredContent!.months).toBe(6);
    expect(r.structuredContent!.surcharge_czk).toBe(1400 * 6);
    const no = await call(c, "eet_calculate_eet_off", { flat_tax_band: 2, yearly_income_czk: 600000 });
    expect(no.structuredContent!.eligible).toBe(false);
    expect(no.content[0]!.text).toContain("EET OFF není možný");
  });

  it("classifies payments", async () => {
    const c = await connect();
    expect((await call(c, "eet_classify_payment", { payment: "card", in_person: true, response_format: "json" })).structuredContent!.evidenced).toBe("yes");
    expect((await call(c, "eet_classify_payment", { payment: "online_gateway", in_person: false, response_format: "json" })).structuredContent!.evidenced).toBe("no");
    expect((await call(c, "eet_classify_payment", { payment: "bank_transfer", in_person: true, response_format: "json" })).structuredContent!.evidenced).toBe("uncertain");
    const qr = await call(c, "eet_classify_payment", { payment: "qr_code", in_person: false });
    expect(qr.content[0]!.text).toContain("Neeviduje se");
  });

  it("returns facts with the corrected January position and sources", async () => {
    const c = await connect();
    const r = await call(c, "eet_get_facts", { topics: ["january_pilot", "exemptions"], response_format: "json" });
    const facts = r.structuredContent!.facts as { topic: string; text: string; sources: unknown[] }[];
    expect(facts.map((f) => f.topic)).toEqual(["january_pilot", "exemptions"]);
    expect(facts[0]!.text).toContain("povinnost evidovat ale platí od prvního dne");
    expect(facts[0]!.text).not.toMatch(/dobrovoln|nanečisto|zkušebn/);
    expect(facts[1]!.text).toContain("50 000 Kč");
    expect(facts.every((f) => f.sources.length > 0)).toBe(true);
    const all = await call(c, "eet_get_facts", {});
    expect(all.content[0]!.text.length).toBeGreaterThan(2000);
  });

  it("filters misconceptions and searches/reads guides", async () => {
    const c = await connect();
    const m = await call(c, "eet_list_misconceptions", { query: "leden", response_format: "json" });
    expect((m.structuredContent!.items as { id: string }[]).map((i) => i.id)).toContain("leden-bez-pokut");
    expect((await call(c, "eet_list_misconceptions", { query: "xyzxyz" })).isError).toBe(true);

    // návody vydává MCP až po revizi (Ф9) – tady jako po revizi přes příznak
    process.env.GUIDES_INDEX_UNREVIEWED = "1";
    try {
      const s = await call(c, "eet_search_guides", { query: "certifikát DIS+", response_format: "json" });
      const results = s.structuredContent!.results as { slug: string }[];
      expect(results[0]!.slug).toBe("jak-aktivovat-dis-a-certifikat");
      const g = await call(c, "eet_get_guide", { slug: results[0]!.slug });
      expect(g.content[0]!.text).toContain("# ");
      expect((await call(c, "eet_get_guide", { slug: "neexistuje" })).content[0]!.text).toContain("Dostupné slugy");
    } finally {
      delete process.env.GUIDES_INDEX_UNREVIEWED;
    }
  });

  it("reports FS status and degrades without monitoring", async () => {
    const c = await connect();
    const r = await call(c, "eet_get_fs_status", { response_format: "json" });
    const env = (r.structuredContent!.environments as { status: string; incidents: unknown[] }[])[0]!;
    expect(env.status).toBe("up");
    expect(env.incidents).toHaveLength(1);
    await client!.close();
    const off = await connect(deps({ fsStatus: async () => null }));
    expect((await call(off, "eet_get_fs_status", {})).isError).toBe(true);
  });

  it("rejects unknown arguments (strict schemas)", async () => {
    const c = await connect();
    const r = await call(c, "eet_classify_payment", { payment: "cash", in_person: true, foo: 1 });
    expect(r.isError).toBe(true);
  });
});
