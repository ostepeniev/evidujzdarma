import { removeCertificate } from "@/lib/server/lifecycle";
import { ownerRoute } from "@/lib/server/route-helpers";

/** Odstranění certifikátu ze služby (podmínky čl. 9.2) – zneplatní ho a smaže šifrovaný klíč. */
export const DELETE = ownerRoute<{ id: string }>(async ({ accountId, params }) => {
  await removeCertificate(accountId, params.id);
  return Response.json({ ok: true });
});
