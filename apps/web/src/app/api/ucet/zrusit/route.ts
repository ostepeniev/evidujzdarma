import { z } from "zod";
import { requireFreshLogin } from "@/lib/server/auth";
import { closeAccount } from "@/lib/server/lifecycle";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/** Zrušení účtu (podmínky čl. 11): zařízení a certifikáty hned přestanou fungovat, data smažeme po 30 dnech. */
export const POST = ownerRoute(async ({ req, user, accountId }) => {
  requireFreshLogin(user);
  // acknowledgeUnsent: vlastník viděl seznam neodeslaných tržeb a ruší účet přesto (R5.8)
  const body = await parseJson(req, z.object({ confirm: z.literal("ZRUSIT"), acknowledgeUnsent: z.boolean().optional() }));
  const deleteAt = await closeAccount(accountId, { confirm: body.acknowledgeUnsent === true });
  return Response.json({ ok: true, deleteAt: deleteAt.toISOString() });
});
