import { HttpError } from "@/lib/server/auth";
import { auditView, currentAdmin } from "@/lib/server/admin";
import { createPartnerApp } from "@/lib/server/oauth";
import { isJsonRequest, sameOrigin } from "@/lib/server/request-guard";

const NO_STORE = { "cache-control": "no-store" };

/** Реєстрація партнерського застосунку для OAuth (S8, розд. 6) – лише адмін; client_secret повертається один раз. */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "Not Found" }, { status: 404, headers: NO_STORE });
  if (!isJsonRequest(req) || !sameOrigin(req)) return Response.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const body = (await req.json().catch(() => null)) as { name?: unknown; redirectUris?: unknown; logoUrl?: unknown } | null;
  try {
    const uris = typeof body?.redirectUris === "string" ? body.redirectUris.split(/\s+/) : [];
    const app = await createPartnerApp({ name: typeof body?.name === "string" ? body.name : "", redirectUris: uris, logoUrl: typeof body?.logoUrl === "string" && body.logoUrl ? body.logoUrl : null });
    await auditView(admin, `partner:${app.id}`);
    return Response.json(app, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: 400, headers: NO_STORE });
    throw e;
  }
}
