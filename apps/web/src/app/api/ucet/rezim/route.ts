import { z } from "zod";
import { setEetMode } from "@/lib/server/account";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

export const POST = ownerRoute(async ({ req, accountId }) => {
  const { mode, confirm } = await parseJson(req, z.object({ mode: z.enum(["mock", "playground", "production"]), confirm: z.boolean().optional() }));
  await setEetMode(accountId, mode, { confirm });
  return Response.json({ ok: true, mode });
});
