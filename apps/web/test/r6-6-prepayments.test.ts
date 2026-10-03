/**
 * R6.6 (рецензія №3, B В3-5; rozhodnutí Ф11) – fakt o zálohách, kreditu a poukazech podle semináře FS pro vývojáře.
 * Text faktu je doslovně z recenze; MCP rozlišuje stravenku, kredit, dárkový poukaz a zálohu jako pokladna.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { FACTS, SOURCES } from "@/content/facts";
import { classifyPayment } from "@/lib/mcp/payments";
import { createEetMcpServer, type McpDeps } from "@/lib/mcp/server";

const TEXT =
  "Záloha i doplatek zaplacené při osobním kontaktu se evidují jako dvě samostatné běžné platby. Dobití kreditu (např. čipu nebo předplacené karty) a jeho pozdější čerpání se evidují obě – datová zpráva pak obsahuje i částku určenou k následnému čerpání, resp. částku čerpání. Jinak je to u dárkového poukazu na konkrétní zboží nebo službu: eviduje se jen jeho prodej, samotné uplatnění poukazu není platbou a neeviduje se. Platba stravenkou nebo poukázkou vydanou jinou firmou je běžná evidovaná platba.";

describe("R6.6 – the prepayments fact", () => {
  it("gate: the fact is verbatim from the review and cites the FS developer seminar", () => {
    expect(FACTS.evidenced.prepayments).toBe(TEXT);
    const seminar = (SOURCES as Record<string, { label: string; url: string }>).seminarVyvojari;
    expect(seminar).toEqual({
      label: "MF a FS: Seminář pro vývojáře EET 2.0 (prezentace, „Specifické případy“)",
      url: "https://eet.gov.cz/assets/cs/cmsmedia/pro-vyvojare/EET2_Prezentace_Seminar_pro_vyvojare_23-.pdf",
    });
    expect(FACTS.evidenced.sources).toEqual([SOURCES.kdoMusi, seminar]);
  });

  it("gate: MCP classify – gift voucher is not evidenced; meal voucher, credit and deposit are", () => {
    expect(classifyPayment("gift_voucher" as never, true).evidenced).toBe("no");
    expect(classifyPayment("meal_voucher" as never, true).evidenced).toBe("yes");
    expect(classifyPayment("credit" as never, true).evidenced).toBe("yes");
    expect(classifyPayment("deposit" as never, true).evidenced).toBe("yes");
    const legacy = classifyPayment("voucher" as never, true);
    expect(legacy.evidenced).toBe("uncertain");
    expect(legacy.explanation).toMatch(/záleží na druhu/i);
  });

  it("gate: no MCP text says the redemption of a gift voucher is evidenced", async () => {
    const deps = { lookupCompany: async () => null, fsStatus: async () => [], allow: () => true } as McpDeps;
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createEetMcpServer(deps).connect(a);
    const c = new Client({ name: "t", version: "1" });
    await c.connect(b);
    const out: string[] = [];
    for (const args of [{ topics: ["evidenced_payments"], response_format: "json" }, { topics: ["evidenced_payments"] }]) {
      const r = (await c.callTool({ name: "eet_get_facts", arguments: args })) as { content: { text: string }[]; structuredContent?: unknown };
      out.push(r.content.map((x) => x.text).join("\n"), JSON.stringify(r.structuredContent ?? {}));
    }
    const r = (await c.callTool({ name: "eet_classify_payment", arguments: { payment: "gift_voucher", in_person: true, response_format: "json" } })) as { structuredContent?: { evidenced?: string } };
    expect(r.structuredContent?.evidenced).toBe("no");
    await c.close();
    expect(out.join("\n")).not.toMatch(/dárkových poukazů[\s\S]{0,120}i samotné čerpání/);
  });
});
