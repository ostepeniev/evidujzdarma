import { hasDatabase } from "@ez/db";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createEetMcpServer } from "@/lib/mcp/server";
import { lookupCompany } from "@/lib/server/ares";
import { statusSummary } from "@/lib/server/fs-monitor";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { absoluteUrl } from "@/lib/site";
import { safeError } from "@/lib/server/log";

export const dynamic = "force-dynamic";

/**
 * Veřejný MCP server (Streamable HTTP, bezstavový, odpovědi v JSON).
 * Každý požadavek dostane vlastní instanci serveru i transportu – nic se nesdílí mezi klienty.
 */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id, authorization",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  headers.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function jsonRpcError(status: number, code: number, message: string): Response {
  return withCors(Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status }));
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`mcp:${ip}`, 120, 60)) return jsonRpcError(429, -32000, "Too many requests – limit is 120 per minute per client. Retry later.");

  const server = createEetMcpServer({
    lookupCompany: (ico: string) => lookupCompany(ico, { pool: "mcp" }),
    fsStatus: async () => (hasDatabase() ? statusSummary() : null),
    allow: (bucket, limit, perSeconds) => rateLimit(`mcp:${bucket}:${ip}`, limit, perSeconds),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 256 * 1024 });
  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(req));
  } catch (e) {
    console.error("[mcp]", safeError(e));
    return jsonRpcError(500, -32603, "Internal server error");
  } finally {
    // JSON režim: odpověď je hotová, spojení lze uvolnit
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  }
}

/** Bezstavový server nenabízí SSE stream – prohlížeči ukážeme, kde je návod. */
export function GET() {
  return withCors(
    Response.json(
      {
        name: "EvidujZdarma – EET 2.0 MCP server",
        transport: "streamable-http (POST JSON-RPC to this URL)",
        docs: absoluteUrl("/mcp"),
      },
      { status: 405, headers: { allow: "POST, OPTIONS" } },
    ),
  );
}

export function DELETE() {
  return jsonRpcError(405, -32000, "Method not allowed: the server is stateless, there is no session to delete.");
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
