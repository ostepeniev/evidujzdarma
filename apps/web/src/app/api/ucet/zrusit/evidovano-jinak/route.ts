import { z } from "zod";
import { settleElsewhere } from "@/lib/server/lifecycle";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

/**
 * „Evidováno jinak“ (Б7, R6.4): vlastník zrušeného účtu potvrdí, že neodeslané ostré tržby evidoval jinak.
 * Zapisuje se do auditu; účet se pak už kvůli nim nedrží.
 */
export const POST = ownerRoute(async ({ req, user, accountId }) => {
  const { confirm } = await parseJson(req, z.object({ confirm: z.boolean() }));
  return Response.json(await settleElsewhere(accountId, { confirm, actor: user.email }));
});
