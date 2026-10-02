import { unlinkAccountant } from "@/lib/server/lifecycle";
import { ownerRoute } from "@/lib/server/route-helpers";

/** Klient zruší propojení s účetní – účetní ztratí přístup ke stavu a exportu tržeb. */
export const DELETE = ownerRoute<{ id: string }>(async ({ accountId, params }) => {
  await unlinkAccountant(accountId, params.id);
  return Response.json({ ok: true });
});
