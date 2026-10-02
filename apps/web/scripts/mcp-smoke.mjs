#!/usr/bin/env node
/**
 * Smoke test veřejného MCP serveru přes Streamable HTTP.
 *   node scripts/mcp-smoke.mjs https://evidujzdarma.cz/api/mcp
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.argv[2] ?? "http://localhost:3000/api/mcp");
const client = new Client({ name: "evidujzdarma-smoke", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url));
const { tools } = await client.listTools();
console.log(`server: ${client.getServerVersion()?.name} ${client.getServerVersion()?.version}`);
console.log(`tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);

const checks = [
  ["eet_get_facts", { topics: ["january_pilot"] }],
  ["eet_classify_payment", { payment: "card", in_person: true }],
  ["eet_calculate_eet_off", { flat_tax_band: 1, yearly_income_czk: 500000 }],
  ["eet_search_guides", { query: "ubytování" }],
  ["eet_list_misconceptions", { query: "POK" }],
  ["eet_get_fs_status", {}],
];
let failed = 0;
for (const [name, args] of checks) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text ?? "";
  console.log(`${r.isError ? "ERR " : "OK  "} ${name}: ${text.split("\n").find((l) => l.trim())?.slice(0, 100)}`);
  if (r.isError && name !== "eet_get_fs_status") failed++;
}
await client.close();
process.exit(failed ? 1 : 0);
