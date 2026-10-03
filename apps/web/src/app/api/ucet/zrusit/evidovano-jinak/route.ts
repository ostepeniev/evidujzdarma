import { z } from "zod";
import { SETTLE_IDS_LIMIT, settleElsewhere } from "@/lib/server/lifecycle";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/**
 * „Evidováno jinak“ (Б7, R6.4): vlastník zrušeného účtu potvrdí, že neodeslané ostré tržby evidoval jinak.
 * Zapisuje se do auditu; účet se pak už kvůli nim nedrží. `ids` = seznam, který vlastník viděl (R7.12) –
 * bez nich, nebo přibyla-li další tržba, odpoví 409 s aktuálním seznamem.
 */
export const POST = ownerRoute(async ({ req, user, accountId }) => {
  const { confirm, ids, seen } = await parseJson(
    req,
    z.object({
      confirm: z.boolean(),
      ids: z.array(z.string().uuid()).max(SETTLE_IDS_LIMIT).optional(),
      // dlouhý seznam: počet a čas posledního přijetí, které vlastník viděl (R8.7 N16)
      seen: z.object({ count: z.number().int().min(0), lastAt: z.string().datetime({ offset: true }).nullable() }).optional(),
    }),
  );
  return Response.json(await settleElsewhere(accountId, { confirm, actor: user.email, ids, seen }));
});
