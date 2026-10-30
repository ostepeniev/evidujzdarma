import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@ez/db";
import { HttpError } from "@/lib/server/auth";
import { ownerRoute } from "@/lib/server/route-helpers";
import { emitTest } from "@/lib/server/webhooks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** „Poslat testovací událost“ z detailu integrace (S8, rozd. 7). */
export const POST = ownerRoute<{ id: string; wid: string }>(async ({ accountId, params }) => {
  if (!UUID_RE.test(params.wid)) throw new HttpError(404, "Nenalezeno");
  const integration = await getDb().query.integrations.findFirst({ where: and(eq(schema.integrations.id, params.id), eq(schema.integrations.accountId, accountId)) });
  if (!integration || !(await emitTest(integration.id, params.wid))) throw new HttpError(404, "Webhook neexistuje.");
  return Response.json({ ok: true });
});
