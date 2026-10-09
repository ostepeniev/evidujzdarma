import { auditView, currentAdmin, isPreregStatus, updatePreregCrm } from "@/lib/server/admin";
import { isJsonRequest, sameOrigin } from "@/lib/server/request-guard";

const NO_STORE = { "cache-control": "no-store" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Статус і нотатка передреєстрації (R15.2) – лише адмін (інакше 404), лише JSON з нашого походження; пишеться в аудит. */
export async function POST(req: Request, { params }: RouteContext<"/api/admin/predregistrace/[id]">) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "Not Found" }, { status: 404, headers: NO_STORE });
  if (!isJsonRequest(req) || !sameOrigin(req)) return Response.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: unknown; note?: unknown } | null;
  if (!UUID_RE.test(id) || !body || !isPreregStatus(body.status)) return Response.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;
  if (!(await updatePreregCrm(id, { status: body.status, note }))) return Response.json({ error: "Not Found" }, { status: 404, headers: NO_STORE });
  await auditView(admin, `crm:${id}`);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
