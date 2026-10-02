import { z } from "zod";
import { verifyEnvironment } from "@/lib/server/certificates";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/**
 * Testovací tržba v ověřovacím režimu (overeni=true): Finanční správa zprávu zkontroluje
 * (certifikát, EIČ, číslo jednotky), ale tržbu NEeviduje. Úspěch odemkne ostrý provoz.
 */
export const POST = ownerRoute(async ({ req, accountId }) => {
  const { unitId, environment } = await parseJson(req, z.object({ unitId: z.string().uuid(), environment: z.enum(["mock", "playground", "production"]).optional() }));
  return Response.json(await verifyEnvironment(accountId, unitId, environment));
});
