import { z } from "zod";
import { requireFreshLogin } from "@/lib/server/auth";
import { closeAccount } from "@/lib/server/lifecycle";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/** Zrušení účtu (podmínky čl. 11): zařízení a certifikáty hned přestanou fungovat, data smažeme po 30 dnech. */
export const POST = ownerRoute(async ({ req, user, accountId }) => {
  requireFreshLogin(user);
  await parseJson(req, z.object({ confirm: z.literal("ZRUSIT") }));
  const deleteAt = await closeAccount(accountId);
  return Response.json({ ok: true, deleteAt: deleteAt.toISOString() });
});
