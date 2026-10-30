import { HttpError } from "@/lib/server/auth";
import { integrationDetail, revokeIntegration } from "@/lib/server/integrations";
import { ownerRoute } from "@/lib/server/route-helpers";

/** Detail integrace: poslední požadavky bez dat tržeb (S8, rozd. 7). */
export const GET = ownerRoute<{ id: string }>(async ({ accountId, params }) => Response.json(await integrationDetail(accountId, params.id), { headers: { "cache-control": "no-store" } }));

/** Odpojit: token přestane platit okamžitě, přijaté tržby se odešlou. */
export const DELETE = ownerRoute<{ id: string }>(async ({ accountId, params }) => {
  if (!(await revokeIntegration(accountId, params.id))) throw new HttpError(404, "Integrace neexistuje nebo už je odpojená.");
  return Response.json({ ok: true });
});
