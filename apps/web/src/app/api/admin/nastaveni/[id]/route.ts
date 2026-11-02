import { HttpError } from "@/lib/server/auth";
import { auditView, currentAdmin } from "@/lib/server/admin";
import { isJsonRequest, sameOrigin } from "@/lib/server/request-guard";
import { setServiceOrderStatus } from "@/lib/server/service-orders";

const NO_STORE = { "cache-control": "no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** S11: стан замовлення «Nastavení na klíč» (zadano / v_reseni / hotovo / zruseno) – лише адмін (інакше 404), лише JSON з нашого походження; в аудит. */
export async function POST(req: Request, { params }: RouteContext<"/api/admin/nastaveni/[id]">) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "Not Found" }, { status: 404, headers: NO_STORE });
  if (!isJsonRequest(req) || !sameOrigin(req)) return Response.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (!UUID_RE.test(id) || !body) return Response.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  try {
    await setServiceOrderStatus(id, body.status);
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    throw e;
  }
  await auditView(admin, `nastaveni:${id}`);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
