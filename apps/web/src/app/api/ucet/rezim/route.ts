import { z } from "zod";
import { setEetMode } from "@/lib/server/account";
import { requireFreshLogin } from "@/lib/server/auth";
import { ownerRoute, parseJson } from "@/lib/server/route-helpers";

export const POST = ownerRoute(async ({ req, user, accountId }) => {
  const { mode, confirm } = await parseJson(req, z.object({ mode: z.enum(["mock", "playground", "production"]), confirm: z.boolean().optional() }));
  // přechod na ostrý provoz jen s čerstvým přihlášením (R3.7)
  if (mode === "production") requireFreshLogin(user);
  await setEetMode(accountId, mode, { confirm });
  return Response.json({ ok: true, mode });
});
